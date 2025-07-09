export class LLMGenerator {
  constructor(watsonxService) {
    this.watsonxService = watsonxService;
    this.promptTemplate = this.getEnhancedPromptTemplate();
  }

  getEnhancedPromptTemplate() {
    return `You are EduBot AI, a helpful educational assistant. Use the provided context to answer the student's question accurately and educationally.

**IMPORTANT INSTRUCTIONS:**
- ONLY answer based on the provided context from uploaded documents
- If the context doesn't contain relevant information for the question, clearly state this
- Do NOT use general knowledge if it's not in the provided context
- Be specific about which document or subject area your answer comes from
- If there's a subject mismatch (e.g., math question but history context), acknowledge this

Context from documents:
{context}

Student question: {question}

**Response Guidelines:**
- Provide clear, educational responses using the context above
- Use markdown formatting for better readability
- Keep responses concise but informative
- If context is insufficient, suggest asking about topics covered in the available documents
- Encourage further learning and questions about the available material

Answer:`;
  }

  // Enhanced context formatting with subject awareness
  formatContext(documents) {
    if (!documents || documents.length === 0) {
      return "No specific documents found for this query.";
    }
    
    // Group documents by subject for better organization
    const documentsBySubject = {};
    documents.forEach((doc, index) => {
      const subject = doc.metadata?.subject || 'General';
      if (!documentsBySubject[subject]) {
        documentsBySubject[subject] = [];
      }
      documentsBySubject[subject].push({ ...doc, index });
    });
    
    // Format context with subject grouping
    const contextParts = [];
    
    Object.entries(documentsBySubject).forEach(([subject, docs]) => {
      contextParts.push(`**${subject} Documents:**`);
      docs.forEach((doc) => {
        const title = doc.metadata?.title || 'Unknown Document';
        const relevanceInfo = doc.rerankScore ? ` (Relevance: ${doc.rerankScore.toFixed(2)})` : '';
        
        contextParts.push(`Document: "${title}"${relevanceInfo}`);
        contextParts.push(doc.content);
        contextParts.push('---');
      });
    });
    
    return contextParts.join('\n\n');
  }

  // Generate response using the LLM with enhanced error handling
  async generate(context, question) {
    try {
      const formattedContext = this.formatContext(context);
      const prompt = this.promptTemplate
        .replace('{context}', formattedContext)
        .replace('{question}', question);
      
      console.log('🤖 Generating response with enhanced context from', context.length, 'documents');
      
      // Log context subjects for debugging
      if (context.length > 0) {
        const subjects = [...new Set(context.map(doc => doc.metadata?.subject).filter(Boolean))];
        console.log('📚 Context subjects:', subjects.join(', '));
      }
      
      // Use the existing Watsonx service
      const response = await this.watsonxService.sendMessage(prompt);
      
      // Enhanced response validation
      if (!response || response.trim().length === 0) {
        return this.generateNoResponseFallback(question, context);
      }
      
      // Check if response indicates lack of relevant context
      if (this.isInsufficientContextResponse(response)) {
        return this.generateInsufficientContextResponse(question, context);
      }
      
      return response;
    } catch (error) {
      console.error('Error generating enhanced LLM response:', error);
      return this.generateErrorResponse(question, context, error);
    }
  }

  // Check if the response indicates insufficient context
  isInsufficientContextResponse(response) {
    const insufficientIndicators = [
      'i don\'t have enough information',
      'the context doesn\'t contain',
      'not enough information',
      'cannot answer based on',
      'insufficient information',
      'no relevant information'
    ];
    
    const lowerResponse = response.toLowerCase();
    return insufficientIndicators.some(indicator => lowerResponse.includes(indicator));
  }

  // Generate response when no relevant context is available
  generateInsufficientContextResponse(question, context) {
    const availableSubjects = context.length > 0 
      ? [...new Set(context.map(doc => doc.metadata?.subject).filter(Boolean))]
      : [];
    
    let response = `I don't have sufficient information in the uploaded documents to answer your question about "${question}".`;
    
    if (availableSubjects.length > 0) {
      response += `\n\n**Available subjects in the knowledge base:**\n${availableSubjects.map(s => `• ${s}`).join('\n')}`;
      response += `\n\n**Suggestions:**\n• Try asking about topics related to: ${availableSubjects.join(', ')}\n• Ask your teacher if materials for this topic have been uploaded\n• Rephrase your question to be more specific`;
    } else {
      response += '\n\n**Suggestions:**\n• Ask your teacher to upload relevant study materials\n• Try asking about a different topic\n• Check if your question relates to available course content';
    }
    
    response += '\n\n**Study Tips:**\n• Review your textbooks for this topic\n• Take notes on key concepts to ask about later\n• Connect new topics to what you already know';
    
    return response;
  }

  // Generate fallback when no response is received
  generateNoResponseFallback(question, context) {
    return `I'm having trouble generating a response to your question about "${question}".

**What you can try:**
• Rephrase your question to be more specific
• Break complex questions into smaller parts
• Ask about topics covered in the uploaded materials
• Try again in a moment

**Study Tips:**
• Review your course materials for related information
• Take notes on specific concepts you want to understand
• Ask follow-up questions about particular aspects

Please try asking your question again!`;
  }

  // Generate error response
  generateErrorResponse(question, context, error) {
    const availableSubjects = context.length > 0 
      ? [...new Set(context.map(doc => doc.metadata?.subject).filter(Boolean))]
      : [];
    
    let response = `I encountered an error while processing your question about "${question}".`;
    
    if (availableSubjects.length > 0) {
      response += `\n\n**Available subjects:** ${availableSubjects.join(', ')}`;
    }
    
    response += `\n\n**What you can do:**
• Try asking your question again in a moment
• Rephrase your question to be more specific
• Ask about topics from the available subjects above
• Check your internet connection

**Study Tips while I recover:**
• Review your textbooks and notes
• Prepare specific questions about concepts you want to understand
• Take notes on topics you'd like to explore further

Please try again!`;
    
    return response;
  }

  // Update prompt template
  updatePromptTemplate(template) {
    this.promptTemplate = template;
  }
}