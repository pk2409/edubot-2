import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import Layout from '../../components/Layout';
import BulkUploader from '../../components/grading/BulkUploader';
import { DatabaseService, SUBJECTS } from '../../services/supabase';
import { 
  ArrowLeft, 
  Upload, 
  FileText, 
  Users, 
  Clock,
  Save,
  CheckCircle,
  AlertCircle
} from 'lucide-react';

const CreateSession = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1); // 1: Session Setup, 2: Upload Submissions
  
  const [sessionData, setSessionData] = useState({
    session_name: '',
    subject: '',
    class_section: '',
    total_marks: 100,
    question_paper_type: 'upload', // 'upload' or 'in_answers'
    question_paper_file: null,
    instructions: '',
    auto_grade_enabled: true
  });

  const [createdSession, setCreatedSession] = useState(null);

  const handleCreateSession = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      let questionPaperData = null;
      
      if (sessionData.question_paper_type === 'upload' && sessionData.question_paper_file) {
        // Upload question paper file to storage
        const { data: uploadData, error: uploadError } = await DatabaseService.uploadDocument(
          sessionData.question_paper_file,
          {
            title: `Question Paper - ${sessionData.session_name}`,
            subject: sessionData.subject,
            uploaded_by: user.id
          }
        );
        
        if (uploadError) throw uploadError;
        
        // Create question paper record
        const { data: paperData, error: paperError } = await DatabaseService.createQuestionPaper({
          created_by: user.id,
          title: sessionData.session_name,
          subject: sessionData.subject,
          class_section: sessionData.class_section,
          total_marks: sessionData.total_marks,
          question_paper_file_id: uploadData.id,
          has_separate_question_paper: true,
          questions: [] // Will be extracted via OCR if needed
        });
        
        if (paperError) throw paperError;
        questionPaperData = paperData;
      } else {
        // Questions are in answer sheets
        const { data: paperData, error: paperError } = await DatabaseService.createQuestionPaper({
          created_by: user.id,
          title: sessionData.session_name,
          subject: sessionData.subject,
          class_section: sessionData.class_section,
          total_marks: sessionData.total_marks,
          has_separate_question_paper: false,
          questions: [] // Questions will be extracted from answer sheets
        });
        
        if (paperError) throw paperError;
        questionPaperData = paperData;
      }

      // Create grading session
      const { data: sessionDataResult, error: sessionError } = await DatabaseService.createGradingSession({
        teacher_id: user.id,
        question_paper_id: questionPaperData.id,
        session_name: sessionData.session_name,
        auto_grade_enabled: sessionData.auto_grade_enabled,
        status: 'in_progress'
      });

      if (sessionError) throw sessionError;

      setCreatedSession(sessionDataResult);
      setStep(2); // Move to upload step
    } catch (error) {
      console.error('Error creating session:', error);
      alert('Failed to create grading session: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUploadComplete = (results) => {
    console.log('Upload completed:', results);
    // Navigate to grading interface
    navigate(`/grading/session/${createdSession.id}`);
  };

  const canCreateSession = () => {
    const basicFieldsValid = sessionData.session_name && 
                            sessionData.subject && 
                            sessionData.total_marks > 0;
    
    if (sessionData.question_paper_type === 'upload') {
      return basicFieldsValid && sessionData.question_paper_file;
    }
    
    return basicFieldsValid;
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/grading')}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Create Grading Session</h1>
            <p className="text-gray-600 mt-2">Set up a new AI-powered grading session</p>
          </div>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center space-x-8">
          {[
            { number: 1, title: 'Session Setup', icon: FileText },
            { number: 2, title: 'Upload Submissions', icon: Upload }
          ].map((stepInfo) => {
            const Icon = stepInfo.icon;
            const isActive = step === stepInfo.number;
            const isCompleted = step > stepInfo.number;
            
            return (
              <div key={stepInfo.number} className="flex items-center">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                  isCompleted ? 'bg-green-500 text-white' :
                  isActive ? 'bg-blue-500 text-white' :
                  'bg-gray-200 text-gray-500'
                }`}>
                  <Icon size={20} />
                </div>
                <span className={`ml-3 font-medium ${
                  isActive ? 'text-blue-600' : 'text-gray-600'
                }`}>
                  {stepInfo.title}
                </span>
                {stepInfo.number < 2 && (
                  <div className={`w-16 h-1 mx-4 ${
                    step > stepInfo.number ? 'bg-green-500' : 'bg-gray-200'
                  }`} />
                )}
              </div>
            );
          })}
        </div>

        {/* Step Content */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-8">
          {step === 1 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-800">Session Setup</h2>
              
              <form onSubmit={handleCreateSession} className="space-y-6">
                {/* Basic Session Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Session Name
                    </label>
                    <input
                      type="text"
                      value={sessionData.session_name}
                      onChange={(e) => setSessionData(prev => ({ ...prev, session_name: e.target.value }))}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="e.g., Mid-term Mathematics Exam"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Subject
                    </label>
                    <select
                      value={sessionData.subject}
                      onChange={(e) => setSessionData(prev => ({ ...prev, subject: e.target.value }))}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    >
                      <option value="">Select subject</option>
                      {SUBJECTS.map(subject => (
                        <option key={subject} value={subject}>{subject}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Class Section
                    </label>
                    <input
                      type="text"
                      value={sessionData.class_section}
                      onChange={(e) => setSessionData(prev => ({ ...prev, class_section: e.target.value }))}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="e.g., 10-A"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Total Marks
                    </label>
                    <input
                      type="number"
                      value={sessionData.total_marks}
                      onChange={(e) => setSessionData(prev => ({ ...prev, total_marks: parseInt(e.target.value) || 0 }))}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      min="1"
                      required
                    />
                  </div>
                </div>

                {/* Question Paper Type Selection */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-800">Question Paper Setup</h3>
                  
                  <div className="space-y-4">
                    {/* Option 1: Upload Question Paper */}
                    <div className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                      sessionData.question_paper_type === 'upload' 
                        ? 'border-blue-500 bg-blue-50' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}>
                      <label className="flex items-start space-x-3 cursor-pointer">
                        <input
                          type="radio"
                          name="question_paper_type"
                          value="upload"
                          checked={sessionData.question_paper_type === 'upload'}
                          onChange={(e) => setSessionData(prev => ({ 
                            ...prev, 
                            question_paper_type: e.target.value,
                            question_paper_file: null 
                          }))}
                          className="mt-1"
                        />
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <FileText className="text-blue-600" size={20} />
                            <span className="font-medium text-gray-800">Upload Question Paper</span>
                          </div>
                          <p className="text-sm text-gray-600 mb-3">
                            Upload a separate question paper PDF. The AI will use this to understand the questions and grade accordingly.
                          </p>
                          
                          {sessionData.question_paper_type === 'upload' && (
                            <div className="mt-3">
                              <input
                                type="file"
                                accept=".pdf"
                                onChange={(e) => setSessionData(prev => ({ 
                                  ...prev, 
                                  question_paper_file: e.target.files[0] 
                                }))}
                                className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                required={sessionData.question_paper_type === 'upload'}
                              />
                              <p className="text-xs text-gray-500 mt-1">
                                Upload the question paper PDF (Max 50MB)
                              </p>
                            </div>
                          )}
                        </div>
                      </label>
                    </div>

                    {/* Option 2: Questions in Answer Sheets */}
                    <div className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                      sessionData.question_paper_type === 'in_answers' 
                        ? 'border-green-500 bg-green-50' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}>
                      <label className="flex items-start space-x-3 cursor-pointer">
                        <input
                          type="radio"
                          name="question_paper_type"
                          value="in_answers"
                          checked={sessionData.question_paper_type === 'in_answers'}
                          onChange={(e) => setSessionData(prev => ({ 
                            ...prev, 
                            question_paper_type: e.target.value,
                            question_paper_file: null 
                          }))}
                          className="mt-1"
                        />
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <CheckCircle className="text-green-600" size={20} />
                            <span className="font-medium text-gray-800">Questions in Answer Sheets</span>
                          </div>
                          <p className="text-sm text-gray-600">
                            The questions are printed on the answer sheets themselves. The AI will extract both questions and answers from the submitted papers.
                          </p>
                          
                          {sessionData.question_paper_type === 'in_answers' && (
                            <div className="mt-3 p-3 bg-green-100 rounded-lg">
                              <div className="flex items-center text-green-800 mb-2">
                                <AlertCircle size={16} className="mr-2" />
                                <span className="font-medium text-sm">How it works:</span>
                              </div>
                              <ul className="text-green-700 text-sm space-y-1">
                                <li>• AI will scan each answer sheet to identify questions</li>
                                <li>• Questions and answers will be extracted together</li>
                                <li>• Grading will be based on the context of each question</li>
                                <li>• Works best with clearly formatted question papers</li>
                              </ul>
                            </div>
                          )}
                        </div>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Additional Settings */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Grading Instructions (Optional)
                    </label>
                    <textarea
                      value={sessionData.instructions}
                      onChange={(e) => setSessionData(prev => ({ ...prev, instructions: e.target.value }))}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      rows="3"
                      placeholder="Any specific instructions for AI grading or manual review..."
                    />
                  </div>

                  <div className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      id="auto_grade"
                      checked={sessionData.auto_grade_enabled}
                      onChange={(e) => setSessionData(prev => ({ ...prev, auto_grade_enabled: e.target.checked }))}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="auto_grade" className="text-sm font-medium text-gray-700">
                      Enable automatic AI grading after OCR completion
                    </label>
                  </div>
                </div>

                {/* Summary */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-800 mb-3">Session Summary</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Session Name:</span>
                      <span className="ml-2 font-medium">{sessionData.session_name || 'Not set'}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Subject:</span>
                      <span className="ml-2 font-medium">{sessionData.subject || 'Not set'}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Total Marks:</span>
                      <span className="ml-2 font-medium">{sessionData.total_marks}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Question Paper:</span>
                      <span className="ml-2 font-medium">
                        {sessionData.question_paper_type === 'upload' 
                          ? (sessionData.question_paper_file ? 'File uploaded' : 'Upload required')
                          : 'In answer sheets'
                        }
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={!canCreateSession() || loading}
                    className="bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                  >
                    {loading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>Creating...</span>
                      </>
                    ) : (
                      <>
                        <Save size={16} />
                        <span>Create Session</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}

          {step === 2 && createdSession && (
            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-2xl font-bold text-gray-800 mb-2">Upload Student Submissions</h2>
                <p className="text-gray-600">
                  Session "{createdSession.session_name}" has been created successfully!
                </p>
              </div>

              <div className="bg-blue-50 rounded-lg p-4">
                <h3 className="font-medium text-blue-800 mb-2">What happens next:</h3>
                <div className="text-blue-700 text-sm space-y-1">
                  <div>1. Upload PDF files of student answer sheets</div>
                  <div>2. OCR processing will extract text automatically</div>
                  {sessionData.question_paper_type === 'in_answers' ? (
                    <div>3. AI will identify questions and answers from each sheet</div>
                  ) : (
                    <div>3. AI will match answers with the uploaded question paper</div>
                  )}
                  <div>4. AI grading will analyze and score each submission</div>
                  <div>5. You can review and adjust grades in the grading interface</div>
                </div>
              </div>

              <BulkUploader 
                sessionId={createdSession.id}
                onUploadComplete={handleUploadComplete}
              />

              <div className="flex justify-between">
                <button
                  onClick={() => navigate('/grading')}
                  className="bg-gray-100 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Skip Upload (Do Later)
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default CreateSession;