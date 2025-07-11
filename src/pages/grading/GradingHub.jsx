import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import Layout from '../../components/Layout';
import { DatabaseService } from '../../services/supabase';
import { 
  Plus, 
  FileText, 
  Users, 
  Clock, 
  TrendingUp,
  CheckCircle,
  AlertCircle,
  BarChart3,
  Download,
  Eye,
  Edit3,
  Trash2,
  Play,
  Upload,
  TestTube
} from 'lucide-react';

const GradingHub = () => {
  const { user } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [stats, setStats] = useState({
    totalSessions: 0,
    totalSubmissions: 0,
    gradedSubmissions: 0,
    averageScore: 0
  });
  const [loading, setLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [showQuickOCR, setShowQuickOCR] = useState(false);
  const [ocrTestFiles, setOcrTestFiles] = useState([]);
  const [ocrLoading, setOcrLoading] = useState(false);

  useEffect(() => {
    if (user) {
      loadGradingSessions();
    }
  }, [user]);

  const loadGradingSessions = async () => {
    setLoading(true);
    try {
      const { data, error } = await DatabaseService.getGradingSessions(user.id);
      console.log('Raw grading sessions data:', data);
      console.log('Grading sessions fetch error:', error);

      if (error) throw error;

      setSessions(data);
      if (data.length > 0) {
        console.log('Sample session:', data[0]);
        console.log('Has question_paper relation:', data[0]?.question_paper);
      } else {
        console.warn('No grading sessions found for this user.');
      } 

      const totalSessions = data.length;
      const totalSubmissions = data.reduce((sum, session) => sum + session.total_submissions, 0);
      const gradedSubmissions = data.reduce((sum, session) => sum + session.graded_submissions, 0);

      setStats({
        totalSessions,
        totalSubmissions,
        gradedSubmissions,
        averageScore: 0,
      });
    } catch (error) {
      console.error('Error loading grading sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSession = async (sessionId) => {
    try {
      // In production, this would delete from database
      setSessions(sessions.filter(session => session.id !== sessionId));
      setDeleteConfirm(null);
    } catch (error) {
      console.error('Error deleting session:', error);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return 'text-green-600 bg-green-100';
      case 'in_progress':
        return 'text-blue-600 bg-blue-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getProgressPercentage = (session) => {
    if (session.total_submissions === 0) return 0;
    return Math.round((session.graded_submissions / session.total_submissions) * 100);
  };

  const startOCR = async (sessionId) => {
    try {
      const { data: submissions, error } = await DatabaseService.getSessionSubmissions(sessionId);

      if (error) {
        console.error('❌ Failed to fetch submissions:', error);
        return;
      }

      if (!Array.isArray(submissions)) {
        console.error('❌ submissions is not an array:', submissions);
        return;
      }

      console.log(`📦 Submissions received (${submissions.length}):`, submissions);

      for (const sub of submissions) {
        if (!sub.file_url) {
          console.warn('⚠️ Skipping submission due to missing data:', sub);
          continue;
        }

        const jobPayload = {
          file_url: sub.file_url,
          session_id: sessionId,
          student_id: sub.student_id
        };

        console.log('📨 Creating OCR job with payload:', jobPayload);

        const { error: jobError } = await DatabaseService.createOCRJobForSubmission(jobPayload);
        if (jobError) {
          console.warn(`❌ Failed to create job for student ${sub.student_id}:`, jobError);
        } else {
          console.log(`✅ OCR job created for student ${sub.student_id}`);
        }
      }

      alert('✅ OCR jobs created successfully!');
    } catch (err) {
      console.error('❌ Error starting OCR:', err);
    }
  };

  // New function for quick OCR testing
  const handleQuickOCRUpload = (event) => {
    const files = Array.from(event.target.files);
    setOcrTestFiles(files);
  };

  const runQuickOCR = async () => {
    if (ocrTestFiles.length === 0) {
      alert('Please select files first');
      return;
    }

    setOcrLoading(true);
    try {
      const results = [];
      
      for (let i = 0; i < ocrTestFiles.length; i++) {
        const file = ocrTestFiles[i];
        console.log(`🔍 Processing file ${i + 1}/${ocrTestFiles.length}: ${file.name}`);
        
        // Create a temporary file URL (in real implementation, you'd upload to your storage)
        const tempFileUrl = URL.createObjectURL(file);
        
        const jobPayload = {
          file_url: tempFileUrl,
          session_id: null, // No session for quick test
          student_id: `test_student_${i + 1}`, // Generate test student ID
          file_name: file.name,
          test_mode: true // Flag to indicate this is a test
        };

        console.log('📨 Creating quick OCR job with payload:', jobPayload);

        try {
          const { data, error } = await DatabaseService.createOCRJobForSubmission(jobPayload);
          if (error) {
            console.warn(`❌ Failed to create OCR job for ${file.name}:`, error);
            results.push({ file: file.name, status: 'failed', error: error.message });
          } else {
            console.log(`✅ OCR job created for ${file.name}`);
            results.push({ file: file.name, status: 'success', jobId: data?.id });
          }
        } catch (fileError) {
          console.error(`❌ Error processing ${file.name}:`, fileError);
          results.push({ file: file.name, status: 'failed', error: fileError.message });
        }
      }

      // Show results
      const successCount = results.filter(r => r.status === 'success').length;
      const failedCount = results.filter(r => r.status === 'failed').length;
      
      alert(`✅ OCR Test Results:\n${successCount} files processed successfully\n${failedCount} files failed`);
      console.log('📊 Quick OCR Results:', results);
      
    } catch (err) {
      console.error('❌ Error in quick OCR:', err);
      alert('❌ Error running OCR test: ' + err.message);
    } finally {
      setOcrLoading(false);
      setOcrTestFiles([]);
      setShowQuickOCR(false);
    }
  };

  // Alternative: Direct OCR test with minimal payload
  const runDirectOCR = async () => {
    if (ocrTestFiles.length === 0) {
      alert('Please select files first');
      return;
    }

    setOcrLoading(true);
    try {
      for (const file of ocrTestFiles) {
        console.log(`🔍 Direct OCR test for: ${file.name}`);
        
        // Create FormData for direct upload/processing
        const formData = new FormData();
        formData.append('file', file);
        formData.append('test_mode', 'true');
        
        // If you have a direct OCR endpoint, call it here
        // const response = await fetch('/api/ocr/test', {
        //   method: 'POST',
        //   body: formData
        // });
        
        // For now, just simulate the process
        console.log(`📄 File: ${file.name}, Size: ${file.size} bytes, Type: ${file.type}`);
      }
      
      alert(`✅ Direct OCR test completed for ${ocrTestFiles.length} files`);
    } catch (err) {
      console.error('❌ Error in direct OCR:', err);
      alert('❌ Error running direct OCR: ' + err.message);
    } finally {
      setOcrLoading(false);
      setOcrTestFiles([]);
      setShowQuickOCR(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">Loading grading sessions...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Grading Hub</h1>
            <p className="text-gray-600 mt-2">AI-powered grading system for handwritten assignments</p>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={() => setShowQuickOCR(true)}
              className="flex items-center space-x-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white px-6 py-3 rounded-lg hover:from-purple-600 hover:to-pink-600 transform hover:scale-105 transition-all duration-200 shadow-lg"
            >
              <TestTube size={20} />
              <span>Quick OCR Test</span>
            </button>
            <Link
              to="/grading/create"
              className="flex items-center space-x-2 bg-gradient-to-r from-green-500 to-teal-500 text-white px-6 py-3 rounded-lg hover:from-green-600 hover:to-teal-600 transform hover:scale-105 transition-all duration-200 shadow-lg"
            >
              <Plus size={20} />
              <span>New Grading Session</span>
            </Link>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">Total Sessions</p>
                <p className="text-2xl font-bold text-gray-800">{stats.totalSessions}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <FileText className="text-blue-600" size={24} />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">Total Submissions</p>
                <p className="text-2xl font-bold text-gray-800">{stats.totalSubmissions}</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <Users className="text-green-600" size={24} />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">Graded Papers</p>
                <p className="text-2xl font-bold text-gray-800">{stats.gradedSubmissions}</p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <CheckCircle className="text-purple-600" size={24} />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">Average Score</p>
                <p className="text-2xl font-bold text-gray-800">{stats.averageScore}%</p>
              </div>
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="text-orange-600" size={24} />
              </div>
            </div>
          </div>
        </div>

        {/* Grading Sessions */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-100">
          <div className="p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">
              Grading Sessions ({sessions.length})
            </h2>
            
            {sessions.length > 0 ? (
              <div className="space-y-4">
                {sessions.map((session) => (
                  <div key={session.id} className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h3 className="text-lg font-semibold text-gray-800">{session.session_name}</h3>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(session.status)}`}>
                            {session.status === 'completed' ? 'Completed' : 'In Progress'}
                          </span>
                        </div>
                        <div className="flex items-center space-x-4 text-sm text-gray-600">
                          <span>{session.question_paper?.subject}</span>
                          <span>•</span>
                          <span>{session.question_paper?.total_marks} marks</span>
                          <span>•</span>
                          <span>{session.total_submissions} submissions</span>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        {session.status === 'in_progress' && (
                          <Link
                            to={`/grading/session/${session.id}`}
                            className="flex items-center space-x-1 text-green-600 hover:text-green-800 text-sm font-medium bg-green-50 hover:bg-green-100 px-3 py-2 rounded-lg transition-colors"
                          >
                            <Play size={14} />
                            <span>Continue</span>
                          </Link>
                        )}
                        <Link
                          to={`/grading/analytics/${session.id}`}
                          className="flex items-center space-x-1 text-blue-600 hover:text-blue-800 text-sm font-medium bg-blue-50 hover:bg-blue-100 px-3 py-2 rounded-lg transition-colors"
                        >
                          <BarChart3 size={14} />
                          <span>Analytics</span>
                        </Link>
                        <button 
                          onClick={() => setDeleteConfirm(session.id)}
                          className="flex items-center space-x-1 text-red-600 hover:text-red-800 text-sm font-medium bg-red-50 hover:bg-red-100 px-3 py-2 rounded-lg transition-colors"
                        >
                          <Trash2 size={14} />
                          <span>Delete</span>
                        </button>
                        <button
                          onClick={() => startOCR(session.id)}
                          className="flex items-center space-x-1 text-purple-600 hover:text-purple-800 text-sm font-medium bg-purple-50 hover:bg-purple-100 px-3 py-2 rounded-lg transition-colors"
                        >
                          <Eye size={14} />
                          <span>Start OCR</span>
                        </button>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="mb-4">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium text-gray-700">Grading Progress</span>
                        <span className="text-sm text-gray-600">
                          {session.graded_submissions}/{session.total_submissions} ({getProgressPercentage(session)}%)
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-gradient-to-r from-green-500 to-teal-500 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${getProgressPercentage(session)}%` }}
                        ></div>
                      </div>
                    </div>

                    {/* Session Details */}
                    <div className="flex items-center justify-between text-sm text-gray-500">
                      <div className="flex items-center space-x-4">
                        <span className="flex items-center">
                          <Clock size={14} className="mr-1" />
                          Created {new Date(session.created_at).toLocaleDateString()}
                        </span>
                        {session.completed_at && (
                          <span className="flex items-center">
                            <CheckCircle size={14} className="mr-1" />
                            Completed {new Date(session.completed_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        {session.status === 'completed' && (
                          <button className="flex items-center space-x-1 text-gray-600 hover:text-gray-800">
                            <Download size={14} />
                            <span>Export</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <FileText className="mx-auto text-gray-300 mb-4" size={64} />
                <h3 className="text-xl font-medium text-gray-600 mb-2">No grading sessions yet</h3>
                <p className="text-gray-500 mb-6">
                  Create your first grading session to start using AI-powered grading
                </p>
                <Link
                  to="/grading/create"
                  className="bg-gradient-to-r from-green-500 to-teal-500 text-white px-6 py-3 rounded-lg hover:from-green-600 hover:to-teal-600 transition-all duration-200"
                >
                  Create Grading Session
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Quick OCR Test Modal */}
        {showQuickOCR && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl p-8 max-w-md w-full">
              <div className="text-center">
                <TestTube className="mx-auto text-purple-500 mb-4" size={48} />
                <h2 className="text-xl font-bold text-gray-800 mb-4">Quick OCR Test</h2>
                <p className="text-gray-600 mb-6">
                  Upload files to test OCR functionality without creating a full grading session
                </p>
                
                <div className="mb-6">
                  <label className="block w-full border-2 border-dashed border-gray-300 rounded-lg p-6 hover:border-purple-500 cursor-pointer transition-colors">
                    <Upload className="mx-auto text-gray-400 mb-2" size={32} />
                    <span className="text-sm text-gray-600">
                      Click to select files or drag and drop
                    </span>
                    <input
                      type="file"
                      multiple
                      accept="image/*,.pdf"
                      onChange={handleQuickOCRUpload}
                      className="hidden"
                    />
                  </label>
                </div>

                {ocrTestFiles.length > 0 && (
                  <div className="mb-6">
                    <p className="text-sm text-gray-600 mb-2">
                      {ocrTestFiles.length} file(s) selected:
                    </p>
                    <div className="max-h-32 overflow-y-auto">
                      {ocrTestFiles.map((file, index) => (
                        <div key={index} className="text-xs text-gray-500 py-1">
                          {file.name}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex space-x-4">
                  <button
                    onClick={() => {
                      setShowQuickOCR(false);
                      setOcrTestFiles([]);
                    }}
                    className="flex-1 bg-gray-100 text-gray-700 py-3 px-4 rounded-lg hover:bg-gray-200 transition-colors"
                    disabled={ocrLoading}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={runQuickOCR}
                    disabled={ocrTestFiles.length === 0 || ocrLoading}
                    className="flex-1 bg-purple-500 text-white py-3 px-4 rounded-lg hover:bg-purple-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {ocrLoading ? 'Processing...' : 'Run OCR Test'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {deleteConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl p-8 max-w-md w-full">
              <div className="text-center">
                <AlertCircle className="mx-auto text-red-500 mb-4" size={48} />
                <h2 className="text-xl font-bold text-gray-800 mb-2">Delete Grading Session</h2>
                <p className="text-gray-600 mb-6">
                  Are you sure you want to delete this grading session? This action cannot be undone and will remove all submissions and grades.
                </p>
                <div className="flex space-x-4">
                  <button
                    onClick={() => setDeleteConfirm(null)}
                    className="flex-1 bg-gray-100 text-gray-700 py-3 px-4 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleDeleteSession(deleteConfirm)}
                    className="flex-1 bg-red-500 text-white py-3 px-4 rounded-lg hover:bg-red-600 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default GradingHub;