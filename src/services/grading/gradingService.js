// Vision-First AI Grading Service using IBM Watsonx
import { WatsonxService } from '../watsonx.js';
import { supabase } from '../supabase.js';

class GradingService {
  constructor() {
    this.watsonxService = WatsonxService;
  }

  // Process AI grading for a submission using its image
  async processSubmissionGrading(submissionId) {
    try {
      console.log('Starting Vision-AI grading for submission:', submissionId);
      
      // Get submission with all necessary details
      const { data: submission, error: submissionError } = await supabase
        .from('student_submissions')
        .select(`
          *,
          grading_sessions (
            id,
            question_paper_id,
            question_papers (*)
          )
        `)
        .eq('id', submissionId)
        .single();
      
      if (submissionError || !submission) {
        throw new Error(`Submission not found: ${submissionError?.message || 'Unknown error'}`);
      }

      if (!submission.file_url) {
        throw new Error('Submission has no image file_url for vision grading.');
      }
      
      const questionPaper = submission.grading_sessions?.question_papers;
      if (!questionPaper) {
        throw new Error('Question paper/grading context not found for the submission.');
      }
      
      await supabase
        .from('student_submissions')
        .update({ processing_status: 'processing' })
        .eq('id', submissionId);
      
      const grades = await this.gradeFromAnswerSheetImage(questionPaper, submission);
      
      const totalMarks = grades.reduce((sum, grade) => sum + (grade.marks || 0), 0);
      const maxTotalMarks = grades.reduce((sum, grade) => sum + (grade.maxMarks || 0), 0);
      const percentage = maxTotalMarks > 0 ? (totalMarks / maxTotalMarks) * 100 : 0;
      const letterGrade = this.calculateGrade(percentage);
      const overallConfidence = grades.length > 0 ? grades.reduce((sum, grade) => sum + (grade.confidence || 0), 0) / grades.length : 0;
      
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
      
      console.log('✅ Vision-AI grading completed for submission:', submissionId);
      await this.updateSessionProgress(submission.session_id);
      
      return { grades, totalMarks, percentage, grade: letterGrade, confidence: overallConfidence };
      
    } catch (error) {
      console.error('❌ Vision-AI grading failed for submission:', submissionId, error);
      await supabase
        .from('student_submissions')
        .update({ 
          processing_status: 'failed',
          ai_grades: { error: error.message, timestamp: new Date().toISOString() }
        })
        .eq('id', submissionId);
      throw error;
    }
  }

  // NEW CORE FUNCTION: Grade directly from the answer sheet image
  async gradeFromAnswerSheetImage(questionPaper, submission) {
    try {
      const prompt = this.buildVisionGradingPrompt(questionPaper, submission);
      
      // Call Watsonx service with the prompt AND the image URL
      const response = await this.watsonxService.sendMessage(
        prompt,               // The user message/prompt
        '',                   // No document context needed
        false,                // isTeacher = false
        submission.file_url   // The image to analyze
      );
      
      return this.parseGradingResponse(response, questionPaper.total_marks);

    } catch (error) {
      console.error('Error during vision grading:', error);
      if (submission.raw_text) {
        console.warn('⚠️ Vision grading failed, falling back to OCR text-based grading.');
        const textPrompt = this.buildTextFallbackPrompt(questionPaper, submission.raw_text);
        const textResponse = await this.watsonxService.sendMessage(textPrompt);
        return this.parseGradingResponse(textResponse, questionPaper.total_marks);
      }
      throw error;
    }
  }

  // NEW PROMPT: Specifically for grading from an image
  buildVisionGradingPrompt(questionPaper, submission) {
    return `You are an expert AI teacher grading a student's handwritten answer sheet. You will be given an IMAGE of the answer sheet. The questions and the student's answers are on this single image.

**EXAM DETAILS:**
- Subject: ${questionPaper.subject || 'Not specified'}
- Total Marks: ${questionPaper.total_marks || 100}
- Student: ${submission.student_name || 'N/A'}

**GRADING INSTRUCTIONS:**
1.  **Analyze the provided IMAGE** of the handwritten answer sheet.
2.  Identify all the distinct questions and their corresponding handwritten answers from the image.
3.  Evaluate each answer based on correctness, completeness, and demonstrated understanding.
4.  Be fair and thorough. Award partial marks where appropriate.
5.  Provide constructive feedback for each question to help the student learn.

**Output your final grading in this EXACT JSON format. Do not include any other text or explanations outside of the JSON structure.**

\`\`\`json
{
  "questions": [
    {
      "questionNumber": 1,
      "questionText": "[The full question text you identified from the image]",
      "studentAnswer": "[The student's full answer you identified from the image]",
      "maxMarks": "[Your estimate of the marks for this question, distribute the total marks appropriately]",
      "marks": "[The marks you are awarding for this answer]",
      "feedback": "[Brief, constructive feedback for this specific answer]",
      "strengths": "[What the student did well in this answer]",
      "improvements": "[How the student can improve this answer]",
      "confidence": "[A number from 1-10 on your confidence in grading this specific answer from the image]"
    }
  ],
  "overallFeedback": "[Your overall assessment of the student's performance based on all answers]",
  "totalMarks": "[The sum of all 'marks' you awarded]",
  "estimatedMaxMarks": "[The sum of all 'maxMarks' you estimated]"
}
\`\`\`

**IMPORTANT:**
- If the handwriting is unclear, do your best to interpret it.
- If you cannot separate questions, treat the entire sheet as one long answer.
- Ensure the sum of "maxMarks" equals the exam's "Total Marks".`;
  }

  // Parse the structured JSON response from the AI
  parseGradingResponse(response, totalMarks) {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.questions && Array.isArray(parsed.questions)) {
          return parsed.questions.map(q => ({
            questionNumber: q.questionNumber || 1,
            questionText: q.questionText || 'Question identified from image.',
            studentAnswer: q.studentAnswer || 'Answer identified from image.',
            maxMarks: q.maxMarks || Math.floor(totalMarks / (parsed.questions.length || 1)),
            marks: Math.min(Math.max(0, q.marks || 0), q.maxMarks || totalMarks),
            feedback: q.feedback || 'Good effort.',
            strengths: q.strengths || 'Shows understanding.',
            improvements: q.improvements || 'Continue practicing.',
            confidence: Math.min(Math.max(1, q.confidence || 5), 10)
          }));
        }
      }
    } catch (parseError) {
      console.error('Error parsing AI grading JSON response:', parseError);
    }
    console.warn('⚠️ Could not parse JSON from AI response. Creating a fallback grade.');
    return [{
      questionNumber: 1,
      questionText: 'Entire Answer Sheet',
      studentAnswer: 'Could not parse AI response.',
      maxMarks: totalMarks,
      marks: 0,
      feedback: 'AI grading failed due to a response format error. Please review manually.',
      strengths: 'N/A',
      improvements: 'N/A',
      confidence: 1
    }];
  }

  // Fallback prompt if vision fails and we must use OCR text
  buildTextFallbackPrompt(questionPaper, rawText) {
    return `You are an expert AI teacher. A previous vision-based grading attempt failed. As a fallback, you will now grade based on pre-extracted OCR text from a student's answer sheet. The text may be imperfect.

**EXAM DETAILS:**
- Subject: ${questionPaper.subject || 'Not specified'}
- Total Marks: ${questionPaper.total_marks || 100}

**EXTRACTED TEXT FROM ANSWER SHEET:**
${rawText}

**GRADING INSTRUCTIONS:**
Based on the text provided, please identify questions and answers, grade them, and provide your response in the same JSON format as previously requested. Acknowledge in your feedback that you are working with imperfect text.`;
  }

  generateOverallFeedback(percentage, grades) {
    if (percentage >= 90) return 'Excellent work! A strong understanding of the concepts is demonstrated.';
    if (percentage >= 80) return 'Very good performance! A solid grasp of the material.';
    if (percentage >= 70) return 'Good effort! Key concepts are understood, but work on providing more detail.';
    if (percentage >= 60) return 'Fair performance. Focus on reviewing the key concepts to build a stronger foundation.';
    return 'Needs improvement. Please review the course material thoroughly and seek help on challenging topics.';
  }

  calculateGrade(percentage) {
    if (percentage >= 90) return 'A';
    if (percentage >= 80) return 'B';
    if (percentage >= 70) return 'C';
    if (percentage >= 60) return 'D';
    return 'F';
  }

  async updateSessionProgress(sessionId) {
    try {
      const { data: sessionData, error } = await supabase
        .from('student_submissions')
        .select('processing_status')
        .eq('session_id', sessionId);
      
      if (error) throw error;

      if (sessionData) {
        const gradedCount = sessionData.filter(s => ['graded', 'reviewed'].includes(s.processing_status)).length;
        const totalCount = sessionData.length;
        
        await supabase
          .from('grading_sessions')
          .update({ graded_submissions: gradedCount, total_submissions: totalCount })
          .eq('id', sessionId);
      }
    } catch (error) {
      console.error('Failed to update session progress:', error);
    }
  }

  async processPendingGrading() {
    try {
      const { data: pendingSubmissions, error } = await supabase
        .from('student_submissions')
        .select('id')
        .eq('processing_status', 'ocr_completed') // This status means it's ready for grading
        .limit(5); 
      
      if (error) throw error;
      if (!pendingSubmissions || pendingSubmissions.length === 0) return;
      
      console.log(`Processing AI grading for ${pendingSubmissions.length} submissions...`);
      
      const gradingPromises = pendingSubmissions.map(submission => 
        this.processSubmissionGrading(submission.id)
      );
      
      await Promise.all(gradingPromises);
      
    } catch (error) {
      console.error('Error processing pending grading:', error);
    }
  }

  startGradingProcessor() {
    console.log('🚀 Grading Service Processor Started. Checking for jobs every 30 seconds.');
    setInterval(() => {
      this.processPendingGrading();
    }, 30000);
    this.processPendingGrading();
  }
}

export default new GradingService();