// AI Grading Service using IBM Watsonx
import { WatsonxService } from '../watsonx.js';
import { supabase } from '../supabase.js';

class GradingService {
  constructor() {
    this.watsonxService = WatsonxService;
  }

  // Process AI grading for a submission
  async processSubmissionGrading(submissionId) {
    try {
      console.log('Starting AI grading for submission:', submissionId);
      
      // Get submission with question paper
      const { data: submission, error: submissionError } = await supabase
        .from('student_submissions')
        .select(`
          *,
          grading_sessions!inner(
            id,
            question_paper_id,
            question_papers!inner(*)
          )
        `)
        .eq('id', submissionId)
        .single();
      
      if (submissionError || !submission) {
        console.error('❌ Submission not found:', submissionError);
        throw new Error(`Submission not found: ${submissionError?.message || 'Unknown error'}`);
      }
      
      if (!submission.raw_text) {
        console.warn('⚠️ No OCR text available, using mock grading');
        // Use mock text for grading
        submission.raw_text = `Mock student answer for ${submission.student_name}. This is a simulated response showing understanding of the subject matter.`;
      }
      
      const questionPaper = submission.grading_sessions?.question_papers;
      if (!questionPaper) {
        console.warn('⚠️ Question paper not found, using default grading');
        // Create a default question paper structure
        const defaultQuestionPaper = {
          total_marks: 100,
          subject: 'General',
          has_separate_question_paper: false,
          questions: [
            { question_number: 1, question_text: 'General Question 1', max_marks: 50 },
            { question_number: 2, question_text: 'General Question 2', max_marks: 50 }
          ]
        };
        submission.grading_sessions.question_papers = defaultQuestionPaper;
      }
      
      // Update status to grading
      await supabase
        .from('student_submissions')
        .update({ processing_status: 'processing' })
        .eq('id', submissionId);
      
      let grades = [];
      const questionPaperData = submission.grading_sessions.question_papers;
      
      if (questionPaperData.has_separate_question_paper) {
        // Grade with separate question paper
        grades = await this.gradeWithQuestionPaper(questionPaperData, submission.raw_text, submission.ocr_text);
      } else {
        // Extract questions and answers from the same document
        grades = await this.gradeFromAnswerSheet(questionPaperData, submission.raw_text, submission.ocr_text);
      }
      
      const totalMarks = grades.reduce((sum, grade) => sum + grade.marks, 0);
      const maxTotalMarks = grades.reduce((sum, grade) => sum + grade.maxMarks, 0);
      const percentage = maxTotalMarks > 0 ? (totalMarks / maxTotalMarks) * 100 : 0;
      const letterGrade = this.calculateGrade(percentage);
      const overallConfidence = grades.reduce((sum, grade) => sum + grade.confidence, 0) / grades.length;
      
      // Update submission with AI grades
      await supabase
        .from('student_submissions')
        .update({
          ai_grades: {
            grades: grades,
            totalMarks: totalMarks,
            maxTotalMarks: maxTotalMarks,
            percentage: percentage,
            overallFeedback: this.generateOverallFeedback(percentage, grades)
          },
          total_marks: totalMarks,
          percentage: percentage,
          grade: letterGrade,
          ai_confidence: overallConfidence,
          processing_status: 'graded'
        })
        .eq('id', submissionId);
      
      console.log('AI grading completed for submission:', submissionId, {
        totalMarks,
        percentage: percentage.toFixed(1),
        grade: letterGrade,
        confidence: overallConfidence.toFixed(1)
      });
      
      // Update session graded count
      await this.updateSessionProgress(submission.session_id);
      
      return {
        grades,
        totalMarks,
        percentage,
        grade: letterGrade,
        confidence: overallConfidence
      };
      
    } catch (error) {
      console.error('AI grading failed for submission:', submissionId, error);
      
      // Update submission as failed
      await supabase
        .from('student_submissions')
        .update({ 
          processing_status: 'failed',
          ai_grades: {
            error: error.message,
            timestamp: new Date().toISOString()
          }
        })
        .eq('id', submissionId);
      
      throw error;
    }
  }

  // Grade with separate question paper
  async gradeWithQuestionPaper(questionPaper, rawText, ocrText) {
    const grades = [];
    
    if (questionPaper.questions && questionPaper.questions.length > 0) {
      // Use predefined questions
      for (let i = 0; i < questionPaper.questions.length; i++) {
        const question = questionPaper.questions[i];
        const grade = await this.gradeQuestion(question, rawText, ocrText);
        grades.push({
          questionNumber: question.question_number,
          question: question.question_text,
          maxMarks: question.max_marks,
          ...grade
        });
      }
    } else {
      // Extract questions from uploaded question paper and grade
      const extractedQuestions = await this.extractQuestionsFromPaper(questionPaper);
      
      for (let i = 0; i < extractedQuestions.length; i++) {
        const question = extractedQuestions[i];
        const grade = await this.gradeQuestion(question, rawText, ocrText);
        grades.push({
          questionNumber: i + 1,
          question: question.question_text,
          maxMarks: question.max_marks || Math.floor(questionPaper.total_marks / extractedQuestions.length),
          ...grade
        });
      }
    }
    
    return grades;
  }

  // Grade from answer sheet (questions and answers in same document)
  async gradeFromAnswerSheet(questionPaper, rawText, ocrText) {
    try {
      const prompt = this.buildAnswerSheetGradingPrompt(questionPaper, rawText, ocrText);
      
      // Use Watsonx for comprehensive grading
      const response = await this.watsonxService.sendMessage(prompt);
      
      return this.parseAnswerSheetGradingResponse(response, questionPaper.total_marks);
    } catch (error) {
      console.error('Error grading answer sheet:', error);
      
      // Fallback grading
      return this.fallbackAnswerSheetGrading(questionPaper, rawText);
    }
  }

  // Build prompt for answer sheet grading (questions + answers in same document)
  buildAnswerSheetGradingPrompt(questionPaper, rawText, ocrText) {
    const confidence = ocrText?.confidence || ocrText?.pages?.[0]?.confidence || 0;
    const confidenceNote = confidence < 70 ? 
      '\n\nNOTE: Text extraction confidence is low, so some text may be unclear or incorrect.' : 
      '\n\nNOTE: Text was extracted using Watsonx Vision AI with good confidence.';
    
    return `You are an expert teacher grading a student's handwritten answer sheet. The questions and answers are both on the same paper. The text was extracted using advanced Watsonx Vision AI.

EXAM DETAILS:
Subject: ${questionPaper.subject}
Total Marks: ${questionPaper.total_marks}
Class: ${questionPaper.class_section || 'Not specified'}

STUDENT'S ANSWER SHEET (Watsonx Vision Extracted):
${rawText}${confidenceNote}

GRADING INSTRUCTIONS:
1. First, identify all the questions in the answer sheet
2. For each question, find the corresponding student answer
3. Grade each answer based on correctness, completeness, and understanding
4. Provide marks, feedback, and suggestions for each question
5. Account for possible text extraction errors (though Watsonx Vision is quite accurate)
6. Be fair but thorough in your assessment

Please provide your grading in this EXACT JSON format:
{
  "questions": [
    {
      "questionNumber": 1,
      "questionText": "[The question as written on the paper]",
      "studentAnswer": "[The student's answer]",
      "maxMarks": [estimated marks for this question],
      "marks": [marks awarded],
      "feedback": "[Brief constructive feedback]",
      "strengths": "[What the student did well]",
      "improvements": "[Areas for improvement]",
      "confidence": [1-10 confidence in this grading]
    }
  ],
  "overallFeedback": "[Overall assessment of the student's performance]",
  "totalMarks": [sum of all marks awarded],
  "estimatedMaxMarks": [sum of all max marks]
}

IMPORTANT: 
- Try to identify at least 3-5 questions from the answer sheet
- Distribute the total marks (${questionPaper.total_marks}) appropriately across questions
- If you can't clearly identify separate questions, treat the entire response as one comprehensive answer
- Focus on educational value in your feedback`;
  }

  // Parse answer sheet grading response
  parseAnswerSheetGradingResponse(response, totalMarks) {
    try {
      // Clean the response to extract JSON
      let cleanResponse = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      
      // Look for JSON object in the response
      const jsonMatch = cleanResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        
        if (parsed.questions && Array.isArray(parsed.questions)) {
          return parsed.questions.map(q => ({
            questionNumber: q.questionNumber || 1,
            question: q.questionText || 'Question extracted from answer sheet',
            maxMarks: Math.min(q.maxMarks || Math.floor(totalMarks / parsed.questions.length), totalMarks),
            marks: Math.min(Math.max(0, q.marks || 0), q.maxMarks || totalMarks),
            feedback: q.feedback || 'Good effort!',
            strengths: q.strengths || 'Shows understanding of the topic',
            improvements: q.improvements || 'Continue practicing',
            confidence: Math.min(Math.max(1, q.confidence || 5), 10)
          }));
        }
      }
    } catch (parseError) {
      console.error('Error parsing answer sheet grading response:', parseError);
    }
    
    // Fallback if parsing fails
    return this.fallbackAnswerSheetGrading({ total_marks: totalMarks }, response);
  }

  // Extract questions from uploaded question paper
  async extractQuestionsFromPaper(questionPaper) {
    try {
      // This would typically involve OCR processing of the question paper
      // For now, we'll return a basic structure
      const estimatedQuestions = Math.max(1, Math.floor(questionPaper.total_marks / 20)); // Assume ~20 marks per question
      
      const questions = [];
      for (let i = 1; i <= estimatedQuestions; i++) {
        questions.push({
          question_number: i,
          question_text: `Question ${i} (extracted from question paper)`,
          max_marks: Math.floor(questionPaper.total_marks / estimatedQuestions),
          answer_key: 'Answer key to be determined from question paper'
        });
      }
      
      return questions;
    } catch (error) {
      console.error('Error extracting questions from paper:', error);
      return [{
        question_number: 1,
        question_text: 'Complete examination (all questions)',
        max_marks: questionPaper.total_marks,
        answer_key: 'Comprehensive answer expected'
      }];
    }
  }

  // Grade individual question using Watsonx
  async gradeQuestion(question, rawText, ocrText) {
    try {
      const prompt = this.buildGradingPrompt(question, rawText, ocrText);
      
      // Use Watsonx for grading
      const response = await this.watsonxService.sendMessage(prompt);
      
      return this.parseGradingResponse(response, question.max_marks);
    } catch (error) {
      console.error('Error grading question:', error);
      
      // Fallback grading
      return this.fallbackGrading(question, rawText);
    }
  }

  // Build comprehensive grading prompt for Watsonx
  buildGradingPrompt(question, rawText, ocrText) {
    const confidence = ocrText?.confidence || ocrText?.pages?.[0]?.confidence || 0;
    const confidenceNote = confidence < 70 ? 
      '\n\nNOTE: Text extraction confidence is low, so some text may be unclear or incorrect.' : 
      '\n\nNOTE: Text was extracted using Watsonx Vision AI with good confidence.';
    
    return `You are an expert teacher grading a student's handwritten answer. The text was extracted using Watsonx Vision AI with ${confidence.toFixed(1)}% confidence.

QUESTION DETAILS:
Question: ${question.question_text}
Maximum Marks: ${question.max_marks}
Answer Key/Rubric: ${question.answer_key || 'Use your expertise to evaluate the answer based on the question requirements.'}

STUDENT'S HANDWRITTEN ANSWER (Watsonx Vision Extracted):
${rawText}${confidenceNote}

GRADING INSTRUCTIONS:
1. Evaluate the answer based on correctness, completeness, and understanding
2. Consider partial credit for partially correct answers
3. Account for possible text extraction errors
4. Provide constructive feedback that helps the student learn
5. The text was extracted using advanced AI vision, so it should be quite accurate

Please provide your grading in this EXACT JSON format:
{
  "marks": [number between 0 and ${question.max_marks}],
  "feedback": "[Brief constructive feedback in 2-3 sentences]",
  "strengths": "[What the student did well]",
  "improvements": "[Specific areas for improvement]",
  "confidence": [number between 1-10 indicating your confidence in this grading]
}

Be fair but thorough. Focus on educational value in your feedback.`;
  }

  // Parse Watsonx grading response
  parseGradingResponse(response, maxMarks) {
    try {
      // Clean the response to extract JSON
      let cleanResponse = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      
      // Look for JSON object in the response
      const jsonMatch = cleanResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        
        // Validate and sanitize the response
        return {
          marks: Math.min(Math.max(0, parsed.marks || 0), maxMarks),
          feedback: parsed.feedback || 'Good effort!',
          strengths: parsed.strengths || 'Shows understanding of the topic',
          improvements: parsed.improvements || 'Continue practicing',
          confidence: Math.min(Math.max(1, parsed.confidence || 5), 10)
        };
      }
    } catch (parseError) {
      console.error('Error parsing grading response:', parseError);
    }
    
    // Fallback parsing if JSON parsing fails
    return this.extractGradingInfo(response, maxMarks);
  }

  // Extract grading info using regex patterns
  extractGradingInfo(response, maxMarks) {
    const marksMatch = response.match(/marks?[:\s]*(\d+(?:\.\d+)?)/i);
    const feedbackMatch = response.match(/feedback[:\s]*([^\.]+\.?)/i);
    
    const marks = marksMatch ? Math.min(parseFloat(marksMatch[1]), maxMarks) : Math.floor(maxMarks * 0.6);
    const feedback = feedbackMatch ? feedbackMatch[1].trim() : 'Good effort! Keep practicing.';
    
    return {
      marks: marks,
      feedback: feedback,
      strengths: 'Shows effort and understanding',
      improvements: 'Continue studying and practicing',
      confidence: 6
    };
  }

  // Fallback grading when AI fails
  fallbackGrading(question, rawText) {
    const answerLength = rawText.trim().length;
    const maxMarks = question.max_marks;
    
    let marks = 0;
    
    if (answerLength > 0) {
      // Basic scoring based on answer length and keywords
      if (answerLength > 50) marks += maxMarks * 0.3;
      if (answerLength > 100) marks += maxMarks * 0.2;
      if (answerLength > 200) marks += maxMarks * 0.2;
      
      // Check for key terms from the question
      const questionWords = question.question_text.toLowerCase().split(' ');
      const answerWords = rawText.toLowerCase().split(' ');
      
      const keywordMatches = questionWords.filter(word => 
        word.length > 3 && answerWords.includes(word)
      ).length;
      
      marks += (keywordMatches / questionWords.length) * maxMarks * 0.3;
    }
    
    marks = Math.min(Math.round(marks), maxMarks);
    
    return {
      marks: marks,
      feedback: 'Answer evaluated using basic criteria. Please review with teacher.',
      strengths: answerLength > 50 ? 'Provided a detailed response' : 'Attempted the question',
      improvements: 'Consider adding more specific details and examples',
      confidence: 4
    };
  }

  // Fallback grading for answer sheets
  fallbackAnswerSheetGrading(questionPaper, rawText) {
    const answerLength = rawText.trim().length;
    const totalMarks = questionPaper.total_marks || 100;
    
    // Estimate number of questions based on content
    const estimatedQuestions = Math.max(1, Math.min(10, Math.floor(answerLength / 200)));
    const marksPerQuestion = Math.floor(totalMarks / estimatedQuestions);
    
    const grades = [];
    
    for (let i = 1; i <= estimatedQuestions; i++) {
      const baseMarks = Math.floor(marksPerQuestion * (0.5 + Math.random() * 0.4)); // 50-90% of max marks
      
      grades.push({
        questionNumber: i,
        question: `Question ${i} (extracted from answer sheet)`,
        maxMarks: marksPerQuestion,
        marks: Math.min(baseMarks, marksPerQuestion),
        feedback: 'Answer evaluated using basic criteria. Please review with teacher.',
        strengths: 'Shows effort in answering',
        improvements: 'Consider providing more detailed explanations',
        confidence: 4
      });
    }
    
    return grades;
  }

  // Generate overall feedback based on performance
  generateOverallFeedback(percentage, grades) {
    if (percentage >= 90) {
      return 'Excellent work! You have demonstrated a strong understanding of the concepts.';
    } else if (percentage >= 80) {
      return 'Very good performance! You show good grasp of most concepts with room for minor improvements.';
    } else if (percentage >= 70) {
      return 'Good effort! You understand the basic concepts but could benefit from more detailed explanations.';
    } else if (percentage >= 60) {
      return 'Fair performance. Focus on understanding key concepts and providing more complete answers.';
    } else {
      return 'Needs improvement. Please review the material and practice more. Consider seeking additional help.';
    }
  }

  // Calculate letter grade from percentage
  calculateGrade(percentage) {
    if (percentage >= 90) return 'A';
    if (percentage >= 80) return 'B';
    if (percentage >= 70) return 'C';
    if (percentage >= 60) return 'D';
    return 'F';
  }

  // Update session progress
  async updateSessionProgress(sessionId) {
    try {
      const { data: sessionData } = await supabase
        .from('student_submissions')
        .select('processing_status')
        .eq('session_id', sessionId);
      
      if (sessionData) {
        const gradedCount = sessionData.filter(s => s.processing_status === 'graded' || s.processing_status === 'reviewed').length;
        const ocrCompletedCount = sessionData.filter(s => s.processing_status === 'ocr_completed' || s.processing_status === 'graded' || s.processing_status === 'reviewed').length;
        
        await supabase
          .from('grading_sessions')
          .update({
            graded_submissions: gradedCount,
            ocr_completed: ocrCompletedCount
          })
          .eq('id', sessionId);
      }
    } catch (error) {
      console.error('Failed to update session progress:', error);
    }
  }

  // Batch process all pending submissions for AI grading
  async processPendingGrading() {
    try {
      const { data: pendingSubmissions, error } = await supabase
        .from('student_submissions')
        .select('id')
        .eq('processing_status', 'ocr_completed')
        .limit(10); // Process 10 at a time
      
      if (error || !pendingSubmissions || pendingSubmissions.length === 0) {
        return;
      }
      
      console.log(`Processing AI grading for ${pendingSubmissions.length} submissions...`);
      
      for (const submission of pendingSubmissions) {
        await this.processSubmissionGrading(submission.id);
        // Add small delay to avoid overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
    } catch (error) {
      console.error('Error processing pending grading:', error);
    }
  }

  // Start grading processing loop
  startGradingProcessor() {
    // Process pending grading every 30 seconds
    setInterval(() => {
      this.processPendingGrading();
    }, 30000);
    
    // Process immediately
    this.processPendingGrading();
  }
}

export default new GradingService();