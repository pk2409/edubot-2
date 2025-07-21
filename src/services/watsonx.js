// Enhanced IBM Watsonx API integration with Vision support and existing RAG pipeline
import { RAGPipeline } from './rag/ragPipeline';
import.meta.env.VITE_WATSONX_API_KEY

const WATSONX_URL = '/api/watsonx';
const IAM_URL = '/api/iam';

export const WatsonxService = {
  // Cache for access token to avoid repeated IAM calls
  accessTokenCache: {
    token: null,
    expiry: null
  },

  // RAG Pipeline instance
  ragPipeline: null,

  // Enhanced fallback responses for when API is unavailable
  fallbackResponses: [
    "I'm having trouble connecting to the AI service right now. Here's what I can tell you: This appears to be a great question! While I work on reconnecting, try rephrasing your question or check back in a moment.",
    "The AI service is temporarily unavailable, but I'd love to help! Your question seems important - could you try asking it in a different way? I'll do my best to assist you.",
    "I'm experiencing some connectivity issues with the main AI service. In the meantime, I recommend checking your course materials or asking your teacher for immediate help with this topic.",
    "Network connectivity is currently limited. While I work on reconnecting, consider breaking down your question into smaller parts or consulting your textbooks for this subject.",
    "The AI service is temporarily offline. This looks like an interesting learning question! Try exploring related topics in your study materials while I reconnect."
  ],

  getRandomFallback() {
    return this.fallbackResponses[Math.floor(Math.random() * this.fallbackResponses.length)];
  },

  // Initialize RAG Pipeline
  initializeRAG() {
    if (!this.ragPipeline) {
      console.log('Initializing RAG Pipeline...');
      this.ragPipeline = new RAGPipeline(this, {
        chunkSize: 500,
        chunkOverlap: 50,
        retrievalTopK: 8,
        rerankerTopN: 3,
        embeddingModel: 'enhanced',
        minRelevanceThreshold: 0.3
      });
    }
    return this.ragPipeline;
  },

  // Image processing utilities
  async processImage(imageInput) {
    try {
      let imageData = null;
      
      if (typeof imageInput === 'string') {
        // Handle base64 string
        if (imageInput.startsWith('data:image/')) {
          imageData = imageInput;
        } else {
          // Handle URL - convert to base64
          const response = await fetch(imageInput);
          const blob = await response.blob();
          imageData = await this.blobToBase64(blob);
        }
      } else if (imageInput instanceof File) {
        // Handle File object
        imageData = await this.fileToBase64(imageInput);
      } else if (imageInput instanceof Blob) {
        // Handle Blob object
        imageData = await this.blobToBase64(imageInput);
      }
      
      // Validate image format
      const validFormats = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      const mimeType = imageData.split(';')[0].split(':')[1];
      
      if (!validFormats.includes(mimeType)) {
        throw new Error(`Unsupported image format: ${mimeType}. Supported formats: ${validFormats.join(', ')}`);
      }
      
      // Check image size (Watson X has limits)
      const sizeInMB = (imageData.length * 3) / (4 * 1024 * 1024); // Approximate size in MB
      if (sizeInMB > 10) {
        throw new Error('Image size too large. Please use an image smaller than 10MB.');
      }
      
      return imageData;
    } catch (error) {
      console.error('Error processing image:', error);
      throw new Error(`Failed to process image: ${error.message}`);
    }
  },

  // Utility functions for image conversion
  fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  },

  blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  },

  // Retry function with exponential backoff
  async retryWithBackoff(fn, maxRetries = 1, baseDelay = 2000) {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        if (attempt === maxRetries) {
          throw error;
        }
        
        // Don't retry on certain error types
        if (error.name === 'AbortError' || 
            error.message.includes('401') || 
            error.message.includes('403')) {
          throw error;
        }
        
        const delay = baseDelay * Math.pow(2, attempt);
        console.log(`Attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  },

  async getIAMToken(apiKey) {
    try {
      // Check if we have a valid cached token
      if (this.accessTokenCache.token && this.accessTokenCache.expiry > Date.now()) {
        console.log('Using cached IAM token');
        return this.accessTokenCache.token;
      }

      console.log('Getting new IAM token...');

      const tokenRequest = async () => {
        // Create request with reasonable timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

        try {
          const response = await fetch(IAM_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'Accept': 'application/json'
            },
            body: new URLSearchParams({
              'grant_type': 'urn:ibm:params:oauth:grant-type:apikey',
              'apikey': apiKey
            }),
            signal: controller.signal
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            const errorText = await response.text();
            console.error('IAM token request failed:', response.status, errorText);
            throw new Error(`IAM authentication failed (${response.status}): ${errorText}`);
          }

          const data = await response.json();
          
          if (!data.access_token) {
            throw new Error('No access token received from IAM service');
          }

          return data;
        } catch (error) {
          clearTimeout(timeoutId);
          throw error;
        }
      };

      // Retry the token request with backoff
      const data = await this.retryWithBackoff(tokenRequest, 1, 2000);

      // Cache the token with expiry (subtract 5 minutes for safety)
      this.accessTokenCache.token = data.access_token;
      this.accessTokenCache.expiry = Date.now() + ((data.expires_in - 300) * 1000);

      console.log('IAM token obtained successfully');
      return data.access_token;
    } catch (error) {
      console.error('Error getting IAM token:', error);
      
      // Clear cache on error
      this.accessTokenCache.token = null;
      this.accessTokenCache.expiry = null;
      
      if (error.name === 'AbortError') {
        throw new Error('Authentication timeout - please check your internet connection');
      }
      
      throw error;
    }
  },

  // Enhanced sendMessage with vision support
    // --- Start of Corrected sendMessage function ---

  async sendMessage(userMessage, documentContext = '', isTeacher = false, imageInput = null , isDiagnosticTest = false) {

     let modelToUse = 'meta-llama/llama-3-2-11b-vision-instruct';
      if (isDiagnosticTest) {
            modelToUse = 'meta-llama/llama-3-2-11b-vision-instruct'; // Override model for the test
            console.log(`[DIAGNOSTIC] Overriding model to: ${modelToUse}`);
        } else {
            modelToUse = 'meta-llama/llama-3-2-90b-vision-instruct'; // Default vision model
        }
    try {
      // It's better practice to not have hardcoded fallbacks here.
      // The code should fail if the .env variables are missing.
      const apiKey = import.meta.env.VITE_WATSONX_API_KEY;
      const projectId = import.meta.env.VITE_WATSONX_PROJECT_ID;

      if (!apiKey || !projectId) {
      console.error('CRITICAL: Watsonx credentials not found in .env file. Halting execution.');
      console.error('VITE_WATSONX_API_KEY is:', apiKey);
      console.error('VITE_WATSONX_PROJECT_ID is:', projectId);
      throw new Error('Watsonx credentials are not configured in your .env file. Please check VITE_WATSONX_API_KEY and VITE_WATSONX_PROJECT_ID.');
    }

      


      // More robust check. This will stop execution if credentials are not found.
      if (!apiKey || !projectId) {
        console.error('Watsonx credentials not configured. Please check your .env file for VITE_WATSONX_API_KEY and VITE_WATSONX_PROJECT_ID.');
        throw new Error('Watsonx credentials not configured.');
      }

      console.log('Sending message to Watsonx...', imageInput ? 'with image' : 'text only');

      // Get IAM access token with retry logic
      let accessToken;
      try {
        accessToken = await this.getIAMToken(apiKey);
      } catch (tokenError) {
        console.error('Failed to get IAM token:', tokenError);
        // Let the error bubble up instead of returning a fallback message
        throw new Error(`Authentication failed: ${tokenError.message}`);
      }

      // Process image if provided
      let processedImage = null;
      if (imageInput) {
        try {
          processedImage = await this.processImage(imageInput);
          console.log('Image processed successfully');
        } catch (imageError) {
          console.error('Error processing image:', imageError);
          throw new Error(`Image processing failed: ${imageError.message}`);
        }
      }

      // Enhanced system prompt (your existing logic is fine here)
      const systemPrompt = isTeacher 
        ? `You are EduBot AI, an expert educational assistant for teachers. ${processedImage ? 'You can analyze images and visual content to help with teaching materials, diagrams, charts, and educational content.' : ''} Provide comprehensive, professional responses that help with teaching, curriculum development, educational best practices, content creation, and student assessment. Use markdown formatting for clarity. Focus on practical, actionable advice for educators.`
        : `You are EduBot AI, a helpful educational assistant for students. ${processedImage ? 'You can analyze images, diagrams,charts, and visual content to help explain concepts and answer questions.' : ''} Always provide clear, educational responses using markdown formatting. Focus on helping students learn with explanations, examples, and encouraging content. Keep responses concise but informative. If you cannot answer based on available information, suggest alternative learning approaches.`;

      const userPrompt = documentContext 
        ? `Context from document: ${documentContext}\n\nQuestion: ${userMessage}`
        : userMessage;

      // --- START OF MAJOR CORRECTIONS ---
      
      // 1. Correctly prepare the messages array for both text and vision
      const messages = [
        {
          role: 'system',
          content: systemPrompt
        }
      ];

      if (processedImage) {
        // For vision models, the user's message content is an ARRAY
        messages.push({
          role: 'user',
          content: [
            { type: 'text', text: userPrompt },
            {
              type: 'image_url',
              image_url: {
                // The image needs to be the base64 data URL string
                url: processedImage
              }
            }
          ]
        });
      } else {
        // For text-only models, the content is just a string
        messages.push({
          role: 'user',
          content: userPrompt
        });
      }

      // 2. Correctly structure the entire request body
      const requestBody = {
        model_id: modelToUse,
        project_id: projectId, // project_id is at the top level
        messages: messages,
        parameters: {
           // messages array goes inside parameters
          max_tokens: 1200,
          temperature: 0.7,
          top_p: 1,
          frequency_penalty: 0,
          presence_penalty: 0,
        }
      };
      
      // 3. Remove the old, incorrect 'images' key from the top level.

      // --- END OF MAJOR CORRECTIONS ---

      console.log('Sending request to Watsonx API with Project ID:', projectId);
      // Helpful log to see the structure of what you're sending
      console.log('Request Body Structure:', JSON.stringify(requestBody, (key, value) => key === 'url' ? value.substring(0, 40) + '...' : value, 2));


      const watsonxRequest = async () => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000);

        try {
          const response = await fetch(WATSONX_URL, {
            method: 'POST',
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify(requestBody),
            signal: controller.signal
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            const errorText = await response.text();
            console.error('Watsonx API error details:', response.status, errorText);
            
            if (response.status === 401 || response.status === 403) {
              this.accessTokenCache.token = null;
              this.accessTokenCache.expiry = null;
            }
            
            // Re-throw with the actual API error message for better debugging
            throw new Error(`API Error (${response.status}): ${errorText}`);
          }

          return await response.json();
        } catch (error) {
          clearTimeout(timeoutId);
          throw error;
        }
      };

      const data = await this.retryWithBackoff(watsonxRequest, 2, 3000);

      console.log('Watsonx response received successfully');

      // 4. More robust response parsing for the new payload structure.
      // The result is often nested under 'results'.
      let content = '';
      if (data.results && data.results.length > 0) {
        content = data.results[0].generated_text || '';
      } else if (data.choices && data.choices.length > 0) { // Fallback for other formats
        content = data.choices[0].message?.content || data.choices[0].text || '';
      }

      if (!content) {
        console.warn('No content found in Watsonx response:', data);
        throw new Error('Received an empty response from the AI service.');
      }

      content = content.trim();
      
      if (content.length < 50) {
        content += "\n\nFeel free to ask follow-up questions or request more details about this topic!";
      }

      return content;

    } catch (error) {
      console.error('Error in WatsonxService.sendMessage:', error);
      // Re-throw the error so the calling function can handle it,
      // for example by showing an error message to the user.
      throw error;
    }
  },
  
  // --- End of Corrected sendMessage function ---



  // in watsonx.js
// in watsonx.js
// --- PASTE AND REPLACE YOUR ENTIRE sendMessage FUNCTION WITH THIS ---



  
  // Build OCR extraction prompt


  // New method specifically for vision-based tasks
  async analyzeImage(imageInput, prompt = "What do you see in this image?", isTeacher = false) {
    console.log('Analyzing image with prompt:', prompt);
    
    if (!imageInput) {
      throw new Error("Please provide an image to analyze.");
    }

    // This is the prompt that will be sent to the AI
    const visionPrompt = `${prompt}\n\nPlease provide a detailed analysis of this image, focusing on educational content if present. Describe what you see, any text, diagrams, charts, or educational materials, and explain how this might be useful for learning.`;

    // --- START OF DIAGNOSTIC CHECK ---

    // For this test, we will force a call to a reliable TEXT model first.
    // We will ask it a simple question to see if the basic API connection works.
    // This completely bypasses the vision model to test the core service.

    try {
      console.log('--- 🧪 DIAGNOSTIC TEST RUNNING ---');
      console.log('--- Testing with a simple text model (ibm/granite-13b-chat-v2) to confirm connectivity. ---');
      
      // We call sendMessage, but we pass NULL for the imageInput.
      // This will force it to use a text-only payload.
      // We will also override the model_id inside sendMessage for this test.
      const testResponse = await this.sendMessage(
        "Hello! Are you working? Please respond with 'Yes, I am working.'", // Simple test prompt
        '',     // No document context
        false,  // isTeacher = false
        null,   // IMPORTANT: imageInput is null for this test
        true    // A new flag to indicate this is a diagnostic test
      );

      console.log('--- ✅ DIAGNOSTIC TEST SUCCEEDED ---');
      console.log('--- Text model response:', testResponse);
      console.log('--- This confirms your API key, Project ID, and basic connection are all working correctly. ---');
      console.log('--- The 500 error is specific to the Llama Vision model or the vision prompt. Proceeding with the original vision call... ---');

    } catch (testError) {
      console.error('--- ❌ DIAGNOSTIC TEST FAILED ---');
      console.error('--- The simple text model also failed. This points to a wider issue with your account, region, or a major IBM outage. ---');
      console.error('--- Test Error Details:', testError);
      
      // If the basic test fails, there's no point in trying the vision model.
      // We throw the error to stop the process.
      throw new Error(`Core API connectivity test failed: ${testError.message}`);
    }

    // --- END OF DIAGNOSTIC CHECK ---

    // Now, we continue with the original call to the vision model.
    console.log('--- Continuing with original vision model call... ---');
    return await this.sendMessage(visionPrompt, '', isTeacher, imageInput);
  },

  // in watsonx.js


  // Enhanced RAG implementation with vision support
  async performRAG(userMessage, documents, imageInput = null) {
    try {
      console.log('🔍 Performing RAG search for:', userMessage);
      console.log('📚 Available documents:', documents.length);
      console.log('🖼️ Has image input:', !!imageInput);

      // If no documents available, use direct message with image if provided
      if (!documents || documents.length === 0) {
        console.log('📭 No documents available for RAG, using general knowledge');
        const response = await this.sendMessage(userMessage, '', false, imageInput);
        return {
          response: response,
          sourceDocument: null
        };
      }

      // Initialize RAG pipeline if not already done
      const ragPipeline = this.initializeRAG();

      // If image is provided, combine image analysis with RAG
      if (imageInput) {
        console.log('🖼️ Processing image with RAG...');
        
        // First, analyze the image
        const imageAnalysis = await this.analyzeImage(imageInput, 
          `Analyze this image in the context of the following question: ${userMessage}`, 
          false
        );
        
        // Then perform RAG with enhanced context
        const enhancedMessage = `${userMessage}\n\nImage Analysis: ${imageAnalysis}`;
        const result = await ragPipeline.query(enhancedMessage, documents);
        
        // Find the source document
        let sourceDocument = null;
        if (result.sourceDocuments && result.sourceDocuments.length > 0) {
          const sourceDocId = result.sourceDocuments[0].id;
          sourceDocument = documents.find(doc => doc.id === sourceDocId);
        }

        return {
          response: result.response || result,
          sourceDocument: sourceDocument,
          imageAnalysis: imageAnalysis
        };
      } else {
        // Regular RAG without image
        const result = await ragPipeline.query(userMessage, documents);
        
        console.log('✅ RAG pipeline result:', {
          hasResponse: !!result.response,
          sourceDocuments: result.sourceDocuments?.length || 0
        });

        // Find the actual source document from the original documents array
        let sourceDocument = null;
        if (result.sourceDocuments && result.sourceDocuments.length > 0) {
          const sourceDocId = result.sourceDocuments[0].id;
          sourceDocument = documents.find(doc => doc.id === sourceDocId);
          
          if (sourceDocument) {
            console.log('📖 Source document found:', {
              id: sourceDocument.id,
              title: sourceDocument.title,
              subject: sourceDocument.subject
            });
          } else {
            console.warn('⚠️ Source document ID not found in original documents:', sourceDocId);
          }
        } else {
          console.log('ℹ️ No source documents returned from RAG pipeline');
        }

        return {
          response: result.response || result,
          sourceDocument: sourceDocument
        };
      }
    } catch (error) {
      console.error('❌ RAG error:', error);
      
      // If image was provided, try to at least analyze the image
      if (imageInput) {
        try {
          const imageAnalysis = await this.analyzeImage(imageInput, userMessage, false);
          return {
            response: `I had trouble accessing the document database, but I can analyze your image:\n\n${imageAnalysis}`,
            sourceDocument: null,
            imageAnalysis: imageAnalysis
          };
        } catch (imageError) {
          console.error('Failed to analyze image in fallback:', imageError);
        }
      }
      
      // Provide educational fallback response
      const fallbackResponse = `I'm having trouble accessing the AI service right now, but I can see you're asking about: "${userMessage}"\n\n` +
        `Here are some general study tips while I reconnect:\n` +
        `• Break down complex topics into smaller parts\n` +
        `• Review your course materials for related information\n` +
        `• Try rephrasing your question in different ways\n` +
        `• Ask your teacher or classmates for additional perspectives\n\n` +
        `Please try asking your question again in a moment!`;
      
      return {
        response: fallbackResponse,
        sourceDocument: null
      };
    }
  },

  // Rest of your existing methods remain the same...
  async generateQuizFromDocument(document) {
    try {
      console.log('Generating quiz for document:', document.title);

      // Check if AI service is available by testing with a simple request first
      const testPrompt = "Test connection";
      try {
        await this.sendMessage(testPrompt);
        console.log('AI service connection test successful');
      } catch (testError) {
        console.warn('AI service connection test failed, using fallback quiz');
        return this.generateFallbackQuiz(document);
      }

      // Extract document content for better context
      const documentContent = this.extractDocumentContent(document);
      
      const prompt = `Based on the following document information, create 5 multiple choice questions:

${documentContent}

Create educational questions that test understanding of ${document.subject} concepts. 

IMPORTANT: Respond with ONLY a valid JSON array in this exact format:
[
  {
    "question": "What is the main concept discussed in this ${document.subject} material?",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correct_answer": 0
  }
]

Requirements:
- Each question should test understanding of ${document.subject}
- All 4 options must be plausible but only one correct
- correct_answer is the index (0-3) of the correct option
- Questions should be appropriate for the subject: ${document.subject}
- Return ONLY the JSON array, no other text`;

      const response = await this.sendMessage(prompt);
      
      console.log('Quiz generation response received:', response);

      // Try to extract JSON from the response
      let quizData = [];
      try {
        // Clean the response - remove any markdown formatting
        let cleanResponse = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        
        // Look for JSON array in the response
        const jsonMatch = cleanResponse.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          quizData = JSON.parse(jsonMatch[0]);
        } else {
          // Try parsing the entire cleaned response
          quizData = JSON.parse(cleanResponse);
        }

        // Validate the structure
        if (Array.isArray(quizData) && quizData.length > 0) {
          // Ensure each question has the required fields
          const validQuestions = quizData.filter(q => 
            q.question && 
            Array.isArray(q.options) && 
            q.options.length === 4 &&
            typeof q.correct_answer === 'number' &&
            q.correct_answer >= 0 && 
            q.correct_answer < 4
          );

          console.log('Generated valid questions:', validQuestions.length);
          if (validQuestions.length > 0) {
            return validQuestions.slice(0, 5); // Ensure max 5 questions
          }
        }
      } catch (parseError) {
        console.error('Error parsing quiz JSON:', parseError);
        console.log('Raw response:', response);
        
        // If response contains fallback text, use fallback quiz
        if (response.includes("I'm having") || response.includes("trouble") || response.includes("unavailable")) {
          console.log('AI service returned fallback response, using fallback quiz');
          return this.generateFallbackQuiz(document);
        }
      }

      // Fallback: create sample questions based on document info if AI generation fails
      console.log('Using fallback quiz questions for:', document.title);
      return this.generateFallbackQuiz(document);
    } catch (error) {
      console.error('Error generating quiz:', error);
      
      // Return basic fallback questions
      return this.generateFallbackQuiz(document);
    }
  },

  // Extract text content from document for better context
  extractDocumentContent(document) {
    try {
      // If document has base64 content, try to extract text
      if (document.file_url && document.file_url.startsWith('data:')) {
        // For now, we'll use the document metadata as context
        // In production, you'd want to extract actual text from PDFs/docs
        return `Document Title: ${document.title}\nSubject: ${document.subject}\nThis document contains educational content about ${document.subject}.`;
      }
      
      // Fallback to basic document info
      return `Document: "${document.title}" - Subject: ${document.subject}`;
    } catch (error) {
      console.error('Error extracting document content:', error);
      return `Document: "${document.title}" - Subject: ${document.subject}`;
    }
  },

  // Generate fallback quiz questions when AI fails
  generateFallbackQuiz(document) {
    const subjectQuestions = {
      'Mathematics': [
        {
          question: `What type of mathematical concepts might be covered in "${document.title}"?`,
          options: ["Basic arithmetic", "Advanced calculus", "Geometry", "All of the above"],
          correct_answer: 3
        },
        {
          question: `In mathematics, what is typically the first step in problem solving?`,
          options: ["Calculate immediately", "Understand the problem", "Guess the answer", "Use a calculator"],
          correct_answer: 1
        },
        {
          question: `Which mathematical principle is fundamental to most calculations?`,
          options: ["Order of operations", "Random guessing", "Using only addition", "Avoiding fractions"],
          correct_answer: 0
        }
      ],
      'Science': [
        {
          question: `What scientific method step comes after forming a hypothesis?`,
          options: ["Conclusion", "Experimentation", "Observation", "Theory"],
          correct_answer: 1
        },
        {
          question: `Which of these is a fundamental concept in science?`,
          options: ["Observation", "Hypothesis", "Experimentation", "All of the above"],
          correct_answer: 3
        },
        {
          question: `In scientific research, what makes a good hypothesis?`,
          options: ["It's always correct", "It can be tested", "It's very complex", "It's based on opinion"],
          correct_answer: 1
        }
      ],
      'History': [
        {
          question: `What is the primary purpose of studying historical documents?`,
          options: ["Entertainment", "Understanding the past", "Memorizing dates", "Learning languages"],
          correct_answer: 1
        },
        {
          question: `Why is it important to consider multiple sources when studying history?`,
          options: ["To get different perspectives", "To fill time", "To confuse students", "To make it harder"],
          correct_answer: 0
        },
        {
          question: `What helps historians determine the reliability of a source?`,
          options: ["Its age", "Who wrote it and when", "Its length", "Its language"],
          correct_answer: 1
        }
      ],
      'English': [
        {
          question: `What is the main purpose of analyzing literature?`,
          options: ["To memorize plots", "To understand themes and meanings", "To count words", "To practice reading"],
          correct_answer: 1
        },
        {
          question: `Which element is crucial in effective writing?`,
          options: ["Length", "Clarity", "Complexity", "Speed"],
          correct_answer: 1
        },
        {
          question: `What makes a strong thesis statement?`,
          options: ["It's very long", "It states a clear argument", "It asks questions", "It's at the end"],
          correct_answer: 1
        }
      ],
      'Computer Science': [
        {
          question: `What is the first step in solving a programming problem?`,
          options: ["Write code immediately", "Understand the requirements", "Choose a language", "Test the solution"],
          correct_answer: 1
        },
        {
          question: `Which concept is fundamental to computer science?`,
          options: ["Algorithms", "Data structures", "Problem solving", "All of the above"],
          correct_answer: 3
        },
        {
          question: `What is the purpose of debugging in programming?`,
          options: ["To make code longer", "To find and fix errors", "To add features", "To change languages"],
          correct_answer: 1
        }
      ]
    };

    // Get subject-specific questions or use general ones
    const questions = subjectQuestions[document.subject] || [
      {
        question: `What is the main focus of the document "${document.title}"?`,
        options: ["Basic concepts", "Advanced theory", "Practical applications", "All of the above"],
        correct_answer: 3
      },
      {
        question: `This document belongs to which subject area?`,
        options: [document.subject, "General studies", "Mixed topics", "Unknown"],
        correct_answer: 0
      },
      {
        question: `When studying this material, what approach is most effective?`,
        options: ["Memorization only", "Understanding concepts", "Skipping difficult parts", "Reading once"],
        correct_answer: 1
      }
    ];

    // Add a document-specific question
    questions.unshift({
      question: `Based on the title "${document.title}", what would you expect to learn?`,
      options: [
        `${document.subject} fundamentals`,
        "Unrelated topics",
        "Historical facts only",
        "Mathematical formulas only"
      ],
      correct_answer: 0
    });

    console.log(`Generated ${questions.length} fallback questions for ${document.subject}`);
    return questions.slice(0, 5);
  }
};





