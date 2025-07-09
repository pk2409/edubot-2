import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'your-anon-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Hardcoded subjects as requested
export const SUBJECTS = ['Mathematics', 'Science', 'History', 'English', 'Computer Science'];

// Database helper functions
export const DatabaseService = {
  // Utility function to validate UUID format
  isValidUUID(uuid) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  },

  // Initialize storage bucket if it doesn't exist - simplified approach
  async initializeStorage() {
    try {
      // Try to upload a test file to check if bucket exists
      const testFile = new Blob(['test'], { type: 'text/plain' });
      const testPath = `test-${Date.now()}.txt`;
      
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(testPath, testFile);

      if (uploadError) {
        if (uploadError.message.includes('Bucket not found')) {
          console.log('Documents bucket does not exist, will use alternative storage method');
          return false;
        }
        // If it's an RLS error, the bucket exists but we don't have permission
        if (uploadError.message.includes('row-level security')) {
          console.log('Documents bucket exists but RLS is blocking access');
          return true; // Bucket exists, just RLS issue
        }
      } else {
        // Clean up test file
        await supabase.storage.from('documents').remove([testPath]);
        console.log('Documents bucket is accessible');
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error checking storage:', error);
      return false;
    }
  },

  // Documents - with fallback for storage issues
  async uploadDocument(file, metadata) {
    try {
      // For now, we'll store documents as base64 in the database as a fallback
      // This is not ideal for production but works for testing
      const fileReader = new FileReader();
      
      return new Promise((resolve, reject) => {
        fileReader.onload = async (e) => {
          try {
            const base64Content = e.target.result;
            
            // Save document metadata with base64 content
            const { data, error } = await supabase
              .from('documents')
              .insert([
                {
                  ...metadata,
                  file_url: base64Content, // Store as base64 for now
                  vector: [] // Placeholder for embeddings
                }
              ])
              .select()
              .single();

            if (error) throw error;
            resolve({ data, error: null });
          } catch (error) {
            console.error('Error saving document:', error);
            reject({ data: null, error });
          }
        };
        
        fileReader.onerror = () => {
          reject({ data: null, error: new Error('Failed to read file') });
        };
        
        fileReader.readAsDataURL(file);
      });
    } catch (error) {
      console.error('Error uploading document:', error);
      return { data: null, error };
    }
  },

  async getDocuments(teacherId = null) {
    try {
      let query = supabase.from('documents').select('*');
      
      if (teacherId) {
        query = query.eq('uploaded_by', teacherId);
      }

      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Error getting documents:', error);
      return { data: null, error };
    }
  },

  async deleteDocument(documentId) {
    try {
      // Delete document record (file is stored as base64 in database)
      const { error } = await supabase
        .from('documents')
        .delete()
        .eq('id', documentId);

      if (error) throw error;
      return { error: null };
    } catch (error) {
      console.error('Error deleting document:', error);
      return { error };
    }
  },

  // Quizzes - Enhanced for teacher/student visibility
  async createQuiz(quizData) {
    try {
      const { data, error } = await supabase
        .from('quizzes')
        .insert([quizData])
        .select()
        .single();

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Error creating quiz:', error);
      return { data: null, error };
    }
  },

  async getQuizzes(createdBy = null) {
    try {
      let query = supabase.from('quizzes').select(`
        *,
        created_by_user:users!quizzes_created_by_fkey(name),
        document:documents(title, subject)
      `);
      
      if (createdBy) {
        query = query.eq('created_by', createdBy);
      }

      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Error getting quizzes:', error);
      return { data: null, error };
    }
  },

  async getQuizzesByCreator(teacherId) {
    try {
      return await this.getQuizzes(teacherId);
    } catch (error) {
      console.error('Error getting quizzes by creator:', error);
      return { data: null, error };
    }
  },

  async updateQuiz(quizId, updateData) {
    try {
      const { data, error } = await supabase
        .from('quizzes')
        .update(updateData)
        .eq('id', quizId)
        .select()
        .single();

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Error updating quiz:', error);
      return { data: null, error };
    }
  },

  async deleteQuiz(quizId) {
    try {
      const { error } = await supabase
        .from('quizzes')
        .delete()
        .eq('id', quizId);

      if (error) throw error;
      return { error: null };
    } catch (error) {
      console.error('Error deleting quiz:', error);
      return { error };
    }
  },

  // Quiz attempts - Enhanced with analytics
  async submitQuizAttempt(attemptData) {
    try {
      const { data, error } = await supabase
        .from('quiz_attempts')
        .insert([attemptData])
        .select()
        .single();

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Error submitting quiz attempt:', error);
      return { data: null, error };
    }
  },

  async getQuizAttempts(quizId = null, userId = null) {
    try {
      let query = supabase.from('quiz_attempts').select(`
        *,
        quiz:quizzes(title),
        user:users(name)
      `);
      
      if (quizId) {
        query = query.eq('quiz_id', quizId);
      }
      
      if (userId) {
        query = query.eq('user_id', userId);
      }

      const { data, error } = await query.order('timestamp', { ascending: false });
      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Error getting quiz attempts:', error);
      return { data: null, error };
    }
  },

  // Get quiz analytics for teachers (anonymous student data)
  async getQuizAnalytics(quizId) {
    try {
      const { data, error } = await supabase
        .from('quiz_attempts')
        .select('score, timestamp')
        .eq('quiz_id', quizId);

      if (error) throw error;

      // Calculate analytics without exposing student names
      const analytics = {
        totalAttempts: data.length,
        averageScore: data.length > 0 ? data.reduce((sum, attempt) => sum + attempt.score, 0) / data.length : 0,
        highestScore: data.length > 0 ? Math.max(...data.map(a => a.score)) : 0,
        lowestScore: data.length > 0 ? Math.min(...data.map(a => a.score)) : 0,
        scoreDistribution: {
          excellent: data.filter(a => a.score >= 90).length,
          good: data.filter(a => a.score >= 70 && a.score < 90).length,
          needsImprovement: data.filter(a => a.score < 70).length
        }
      };

      return { data: analytics, error: null };
    } catch (error) {
      console.error('Error getting quiz analytics:', error);
      return { data: null, error };
    }
  },

  // Get overall class performance for teachers
  async getClassPerformance() {
    try {
      const { data, error } = await supabase
        .from('quiz_attempts')
        .select(`
          score,
          quiz:quizzes(title, document:documents(subject))
        `);

      if (error) throw error;

      // Group by subject and calculate averages
      const subjectPerformance = {};
      
      data.forEach(attempt => {
        const subject = attempt.quiz?.document?.subject || 'General';
        if (!subjectPerformance[subject]) {
          subjectPerformance[subject] = {
            totalScore: 0,
            attempts: 0,
            averageScore: 0
          };
        }
        subjectPerformance[subject].totalScore += attempt.score;
        subjectPerformance[subject].attempts += 1;
      });

      // Calculate averages
      Object.keys(subjectPerformance).forEach(subject => {
        const perf = subjectPerformance[subject];
        perf.averageScore = perf.totalScore / perf.attempts;
      });

      return { data: subjectPerformance, error: null };
    } catch (error) {
      console.error('Error getting class performance:', error);
      return { data: null, error };
    }
  },

  // Chats
  async saveChatMessage(chatData) {
    try {
      // Validate UUID format before saving
      if (!this.isValidUUID(chatData.user_id)) {
        console.warn('Invalid UUID format for user_id:', chatData.user_id);
        throw new Error('Invalid user ID format');
      }

      const { data, error } = await supabase
        .from('chats')
        .insert([chatData])
        .select()
        .single();

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Error saving chat message:', error);
      return { data: null, error };
    }
  },

  async getChatHistory(userId) {
    try {
      // Validate UUID format before querying
      if (!this.isValidUUID(userId)) {
        console.warn('Invalid UUID format for userId:', userId);
        return { data: [], error: null }; // Return empty array for mock users
      }

      const { data, error } = await supabase
        .from('chats')
        .select('*')
        .eq('user_id', userId)
        .order('timestamp', { ascending: true });

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Error getting chat history:', error);
      return { data: [], error };
    }
  },

  // Grading System Methods
  async createQuestionPaper(paperData) {
    try {
      const { data, error } = await supabase
        .from('question_papers')
        .insert([paperData])
        .select()
        .single();

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Error creating question paper:', error);
      return { data: null, error };
    }
  },

  async createGradingSession(sessionData) {
    try {
      const { data, error } = await supabase
        .from('grading_sessions')
        .insert([sessionData])
        .select()
        .single();

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Error creating grading session:', error);
      return { data: null, error };
    }
  },

  async getGradingSessions(teacherId) {
    try {
      const { data, error } = await supabase
        .from('grading_sessions')
        .select(`
          *,
          question_paper:question_papers(*),
          student_submissions(count)
        `)
        .eq('teacher_id', teacherId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Error getting grading sessions:', error);
      return { data: null, error };
    }
  },

  async createStudentSubmission(submissionData) {
    try {
      const { data, error } = await supabase
        .from('student_submissions')
        .insert([submissionData])
        .select()
        .single();

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Error creating student submission:', error);
      return { data: null, error };
    }
  },

  async updateSubmissionGrades(submissionId, gradeData) {
    try {
      const { data, error } = await supabase
        .from('student_submissions')
        .update(gradeData)
        .eq('id', submissionId)
        .select()
        .single();

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Error updating submission grades:', error);
      return { data: null, error };
    }
  },

  async getSessionSubmissions(sessionId) {
    try {
      const { data, error } = await supabase
        .from('student_submissions')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Error getting session submissions:', error);
      return { data: null, error };
    }
  },

  async saveGradingAnalytics(sessionId, analyticsData) {
    try {
      const { data, error } = await supabase
        .from('grading_analytics')
        .insert([{
          session_id: sessionId,
          analytics_data: analyticsData
        }])
        .select()
        .single();

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Error saving grading analytics:', error);
      return { data: null, error };
    }
  }
};