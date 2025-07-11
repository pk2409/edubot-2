import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import Layout from '../../components/Layout';
import { 
  ChevronLeft, 
  ChevronRight, 
  Save, 
  Eye,
  FileText,
  User,
  CheckCircle,
  AlertCircle,
  ArrowLeft,
  Download
} from 'lucide-react';
import { DatabaseService } from '../../services/supabase';

const GradingInterface = () => {
  const { sessionId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [session, setSession] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [grades, setGrades] = useState({});
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    loadGradingSession();
  }, [sessionId]);

  const loadGradingSession = async () => {
    setLoading(true);
    try {
      const { data: sessionData, error: sessionError } = await DatabaseService.getGradingSessionById(sessionId);
       console.log("🔍 Requested sessionId:", sessionId);
    console.log("📦 Fetched session data:", sessionData);
    console.log("⚠️ Session fetch error:", sessionError);

if (sessionError) throw sessionError;


const { data: submissionsData, error: submissionsError } = await DatabaseService.getSubmissionsForSession(sessionId);
if (submissionsError) throw submissionsError;

setSession(sessionData);
setSubmissions(submissionsData);
console.log("📃 Submissions fetched:", submissionsData);
console.log("🔢 currentIndex:", currentIndex);
console.log("📌 currentSubmission:", submissionsData[currentIndex]);

// Load initial grades
if (submissionsData.length > 0) {
  const currentSubmission = submissionsData[0];
  const initialGrades = {};
  const gradesSource = currentSubmission.final_grades?.grades || currentSubmission.ai_grades?.grades || [];

  gradesSource.forEach(grade => {
    initialGrades[grade.questionNumber] = {
      marks: grade.marks,
      feedback: grade.feedback,
    };
  });
  if (!sessionError) {
  console.log("✅ Session loaded");
  console.log("🧪 Submissions:", submissionsData);
}


  setGrades(initialGrades);
  setFeedback(currentSubmission.teacher_feedback || '');
}

    } catch (error) {
      console.error('Error loading grading session:', error);
    } finally {
      setLoading(false);
    }
  };

  const currentSubmission = submissions[currentIndex];

  const handleGradeChange = (questionNumber, field, value) => {
    setGrades(prev => ({
      ...prev,
      [questionNumber]: {
        ...prev[questionNumber],
        [field]: field === 'marks' ? Math.max(0, parseInt(value) || 0) : value
      }
    }));
  };

  const handleSaveGrades = async () => {
    setSaving(true);
    try {
      // Convert grades to the expected format
      const finalGrades = session.question_papers.questions.map(question => ({
        questionNumber: question.question_number,
        question: question.question_text,
        maxMarks: question.max_marks,
        marks: grades[question.question_number]?.marks || 0,
        feedback: grades[question.question_number]?.feedback || ''
      }));

      const totalMarks = finalGrades.reduce((sum, grade) => sum + grade.marks, 0);
      const percentage = (totalMarks / session.question_papers.total_marks) * 100;
      const grade = percentage >= 90 ? 'A' : percentage >= 80 ? 'B' : percentage >= 70 ? 'C' : percentage >= 60 ? 'D' : 'F';

      // Update submission
      const updatedSubmissions = [...submissions];
      updatedSubmissions[currentIndex] = {
        ...currentSubmission,
        final_grades: { grades: finalGrades },
        total_marks: totalMarks,
        percentage: percentage,
        grade: grade,
        teacher_feedback: feedback,
        is_reviewed: true,
        reviewed_at: new Date().toISOString()
      };

      setSubmissions(updatedSubmissions);

      // Move to next submission
      if (currentIndex < submissions.length - 1) {
        setCurrentIndex(currentIndex + 1);
        // Load grades for next submission
        const nextSubmission = updatedSubmissions[currentIndex + 1];
        if (nextSubmission.ai_grades) {
          const nextGrades = {};
          nextSubmission.ai_grades.grades.forEach(grade => {
            nextGrades[grade.questionNumber] = {
              marks: grade.marks,
              feedback: grade.feedback
            };
          });
          setGrades(nextGrades);
        }
        setFeedback('');
      }

      console.log('Grades saved successfully');
    } catch (error) {
      console.error('Error saving grades:', error);
    } finally {
      setSaving(false);
    }
  };

  const navigateSubmission = (direction) => {
    const newIndex = direction === 'next' 
      ? Math.min(currentIndex + 1, submissions.length - 1)
      : Math.max(currentIndex - 1, 0);
    
    if (newIndex !== currentIndex) {
      setCurrentIndex(newIndex);
      
      // Load grades for the new submission
      const submission = submissions[newIndex];
      if (submission.final_grades) {
        // Load saved grades
        const savedGrades = {};
        submission.final_grades.grades.forEach(grade => {
          savedGrades[grade.questionNumber] = {
            marks: grade.marks,
            feedback: grade.feedback
          };
        });
        setGrades(savedGrades);
        setFeedback(submission.teacher_feedback || '');
      } else if (submission.ai_grades) {
        // Load AI grades
        const aiGrades = {};
        submission.ai_grades.grades.forEach(grade => {
          aiGrades[grade.questionNumber] = {
            marks: grade.marks,
            feedback: grade.feedback
          };
        });
        setGrades(aiGrades);
        setFeedback('');
      }
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">Loading grading interface...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (!session || !currentSubmission) {
    if(!session){
    return (
      <Layout>
        <div className="max-w-7xl mx-auto text-center py-12">
          <AlertCircle className="mx-auto text-red-500 mb-4" size={48} />
          <h2 className="text-xl font-bold text-gray-800 mb-2">Session Not Found</h2>
          <p className="text-gray-600 mb-6">The grading session could not be loaded.</p>
          <button
            onClick={() => navigate('/grading')}
            className="bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 transition-colors"
          >
            Back to Grading Hub
          </button>
        </div>
      </Layout>
    );
  }
  if (submissions.length === 0) {
  return <Layout>
        <div className="max-w-7xl mx-auto text-center py-12">
          <AlertCircle className="mx-auto text-red-500 mb-4" size={48} />
          <h2 className="text-xl font-bold text-gray-800 mb-2">NO SUBMISSION</h2>
          <p className="text-gray-600 mb-6">Upload student answer images here</p>
          <button
            onClick={() => navigate('/grading')}
            className="bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 transition-colors"
          >
            Back to Grading Hub
          </button>
        </div>
      </Layout>
}

  }

  return (
    <Layout>
      <div className="h-screen flex flex-col bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/grading')}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft size={20} />
              </button>
              <div>
                <h1 className="text-xl font-bold text-gray-800">{session.session_name}</h1>
                <p className="text-sm text-gray-600">{session.question_papers.subject} • {session.question_papers.total_marks} marks</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">
                {currentIndex + 1} of {submissions.length} submissions
              </span>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => navigateSubmission('prev')}
                  disabled={currentIndex === 0}
                  className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft size={20} />
                </button>
                <button
                  onClick={() => navigateSubmission('next')}
                  disabled={currentIndex === submissions.length - 1}
                  className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight size={20} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex">
          {/* Document Viewer */}
          <div className="w-1/3 bg-white border-r border-gray-200">
            <div className="p-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-800">Answer Sheet</h3>
              <p className="text-sm text-gray-600">{currentSubmission.file_name}</p>
            </div>
            <div className="p-4">
              <div className="bg-gray-100 rounded-lg p-8 text-center">
                <FileText className="mx-auto text-gray-400 mb-2" size={48} />
                <p className="text-gray-600">Document Preview</p>
                <p className="text-sm text-gray-500 mt-2">
                  {currentSubmission.file_name}
                </p>
              </div>
            </div>
          </div>

          {/* OCR Text Panel */}
          <div className="w-1/3 bg-white border-r border-gray-200">
            <div className="p-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-800">Extracted Text</h3>
              <p className="text-sm text-gray-600">
                OCR Confidence: {currentSubmission.ocr_text?.pages?.[0]?.confidence || 0}%
              </p>
            </div>
            <div className="p-4 h-full overflow-y-auto">
              <div className="bg-gray-50 rounded-lg p-4">
                <pre className="text-sm text-gray-700 whitespace-pre-wrap font-mono">
                  {currentSubmission.ocr_text?.pages?.[0]?.text || 'No text extracted'}
                </pre>
              </div>
            </div>
          </div>

          {/* Grading Panel */}
          <div className="w-1/3 bg-white">
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-gray-800">Grading</h3>
                  <p className="text-sm text-gray-600">
                    {currentSubmission.student_name} ({currentSubmission.roll_number})
                  </p>
                </div>
                {currentSubmission.is_reviewed && (
                  <CheckCircle className="text-green-500" size={20} />
                )}
              </div>
            </div>
            
            <div className="p-4 h-full overflow-y-auto">
              <div className="space-y-6">
                {/* Questions */}
                {session.question_papers.questions.map((question) => {
                  const currentGrade = grades[question.question_number] || {};
                  const aiGrade = currentSubmission.ai_grades?.grades?.find(g => g.questionNumber === question.question_number);
                  
                  return (
                    <div key={question.question_number} className="border border-gray-200 rounded-lg p-4">
                      <div className="mb-3">
                        <h4 className="font-medium text-gray-800 mb-2">
                          Question {question.question_number} ({question.max_marks} marks)
                        </h4>
                        <p className="text-sm text-gray-600 mb-2">{question.question_text}</p>
                        {aiGrade && (
                          <div className="bg-blue-50 rounded p-2 mb-3">
                            <p className="text-xs text-blue-600 font-medium">AI Suggestion:</p>
                            <p className="text-sm text-blue-700">{aiGrade.marks}/{question.max_marks} marks</p>
                            <p className="text-xs text-blue-600">{aiGrade.feedback}</p>
                          </div>
                        )}
                      </div>
                      
                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Marks
                          </label>
                          <input
                            type="number"
                            min="0"
                            max={question.max_marks}
                            value={currentGrade.marks || 0}
                            onChange={(e) => handleGradeChange(question.question_number, 'marks', e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Feedback
                          </label>
                          <textarea
                            value={currentGrade.feedback || ''}
                            onChange={(e) => handleGradeChange(question.question_number, 'feedback', e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            rows="2"
                            placeholder="Feedback for this question..."
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Overall Feedback */}
                <div className="border border-gray-200 rounded-lg p-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Overall Feedback
                  </label>
                  <textarea
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows="3"
                    placeholder="Overall feedback for the student..."
                  />
                </div>

                {/* Summary */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium text-gray-800 mb-2">Summary</h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>Total Marks:</span>
                      <span className="font-medium">
                        {Object.values(grades).reduce((sum, grade) => sum + (grade.marks || 0), 0)} / {session.question_papers.total_marks}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Percentage:</span>
                      <span className="font-medium">
                        {Math.round((Object.values(grades).reduce((sum, grade) => sum + (grade.marks || 0), 0) / session.question_papers.total_marks) * 100)}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* Save Button */}
                <button
                  onClick={handleSaveGrades}
                  disabled={saving}
                  className="w-full bg-green-500 text-white py-3 px-4 rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50 flex items-center justify-center space-x-2"
                >
                  {saving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Save size={16} />
                      <span>Save & Next</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default GradingInterface;