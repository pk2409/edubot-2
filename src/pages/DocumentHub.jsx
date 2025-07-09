import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Layout from '../components/Layout';
import { DatabaseService, SUBJECTS } from '../services/supabase';
import { WatsonxService } from '../services/watsonx';
import { 
  Upload, 
  FileText, 
  Plus, 
  Search, 
  Tag, 
  Calendar,
  Download,
  Eye,
  Trash2,
  BookOpen,
  Brain,
  Zap,
  CheckCircle,
  AlertCircle,
  Wifi,
  WifiOff
} from 'lucide-react';

const DocumentHub = () => {
  const { user } = useAuth();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('all');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showQuizModal, setShowQuizModal] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [quizGenerating, setQuizGenerating] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('connected');
  const [uploadForm, setUploadForm] = useState({
    title: '',
    subject: '',
    file: null
  });
  const [quizForm, setQuizForm] = useState({
    numQuestions: 5,
    difficulty: 'medium',
    questionTypes: ['multiple-choice']
  });

  useEffect(() => {
    loadDocuments();
    checkNetworkStatus();
    
    // Check network status periodically
    const networkInterval = setInterval(checkNetworkStatus, 30000);
    return () => clearInterval(networkInterval);
  }, []);

  const checkNetworkStatus = () => {
    if (navigator.onLine) {
      setConnectionStatus('connected');
    } else {
      setConnectionStatus('offline');
    }
  };

  const loadDocuments = async () => {
    setLoading(true);
    const { data } = await DatabaseService.getDocuments(user?.id);
    if (data) {
      setDocuments(data);
    }
    setLoading(false);
  };

  const handleFileUpload = async (e) => {
    e.preventDefault();
    if (!uploadForm.file || !uploadForm.title || !uploadForm.subject) return;

    setLoading(true);
    try {
      const { error } = await DatabaseService.uploadDocument(uploadForm.file, {
        title: uploadForm.title,
        subject: uploadForm.subject,
        uploaded_by: user.id
      });

      if (!error) {
        setShowUploadModal(false);
        setUploadForm({ title: '', subject: '', file: null });
        await loadDocuments();
      }
    } catch (error) {
      console.error('Upload error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDocument = async (documentId) => {
    if (!confirm('Are you sure you want to delete this document?')) return;
    
    setLoading(true);
    try {
      const { error } = await DatabaseService.deleteDocument(documentId);
      if (!error) {
        await loadDocuments();
      }
    } catch (error) {
      console.error('Delete error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateQuiz = async (document) => {
    setSelectedDocument(document);
    setShowQuizModal(true);
  };

  const generateQuizFromDocument = async () => {
    if (!selectedDocument) return;

    setQuizGenerating(true);
    setConnectionStatus('connecting');
    
    try {
      console.log('Starting quiz generation for document:', selectedDocument.title);
      
      // Generate quiz using WatsonxService with enhanced document context
      const questions = await WatsonxService.generateQuizFromDocument(selectedDocument);
      
      console.log('Generated questions:', questions);
      setConnectionStatus('connected');
      
      if (!questions || questions.length === 0) {
        throw new Error('No questions were generated');
      }
      
      // Create quiz data
      const quizData = {
        title: `AI Quiz: ${selectedDocument.title}`,
        document_id: selectedDocument.id,
        questions: questions.slice(0, quizForm.numQuestions),
        created_by: user.id
      };

      console.log('Creating quiz with data:', quizData);

      // Save the generated quiz
      const { data, error } = await DatabaseService.createQuiz(quizData);

      if (error) {
        console.error('Error saving quiz:', error);
        throw error;
      }

      console.log('Quiz created successfully:', data);
      
      setShowQuizModal(false);
      setSelectedDocument(null);
      
      // Show success message with more details
      alert(`🎉 Quiz "${quizData.title}" generated successfully!\n\n` +
            `📝 ${questions.length} questions created\n` +
            `📚 Subject: ${selectedDocument.subject}\n\n` +
            `You can find it in the Quiz Center to review and share with students.`);
            
    } catch (error) {
      console.error('Quiz generation error:', error);
      setConnectionStatus('error');
      
      let errorMessage = 'Failed to generate quiz. ';
      
      if (error.message?.includes('network') || error.message?.includes('fetch')) {
        errorMessage += 'Please check your internet connection and try again.';
      } else if (error.message?.includes('timeout')) {
        errorMessage += 'The request took too long. Please try again.';
      } else if (error.message?.includes('authentication')) {
        errorMessage += 'There was an authentication issue with the AI service.';
      } else {
        errorMessage += 'Please try again in a moment.';
      }
      
      alert(`❌ ${errorMessage}\n\n💡 Tip: Make sure your document has a clear title and subject for better AI quiz generation.`);
    } finally {
      setQuizGenerating(false);
    }
  };

  const getConnectionIcon = () => {
    switch (connectionStatus) {
      case 'connected':
        return <Wifi className="text-green-500" size={16} />;
      case 'connecting':
        return <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>;
      case 'offline':
        return <WifiOff className="text-red-500" size={16} />;
      case 'error':
        return <AlertCircle className="text-red-500" size={16} />;
      default:
        return <Wifi className="text-gray-500" size={16} />;
    }
  };

  const getConnectionText = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'AI Connected';
      case 'connecting':
        return 'Generating...';
      case 'offline':
        return 'Offline';
      case 'error':
        return 'AI Error';
      default:
        return 'Unknown';
    }
  };

  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         doc.subject.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSubject = selectedSubject === 'all' || doc.subject === selectedSubject;
    return matchesSearch && matchesSubject;
  });

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Document Hub</h1>
            <p className="text-gray-600 mt-2">Manage your learning materials and generate AI-powered quizzes</p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 text-sm">
              {getConnectionIcon()}
              <span className={`font-medium ${
                connectionStatus === 'connected' ? 'text-green-600' :
                connectionStatus === 'connecting' ? 'text-blue-600' :
                connectionStatus === 'offline' ? 'text-red-600' :
                'text-red-600'
              }`}>
                {getConnectionText()}
              </span>
            </div>
            <button
              onClick={() => setShowUploadModal(true)}
              className="flex items-center space-x-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white px-6 py-3 rounded-lg hover:from-blue-600 hover:to-purple-600 transform hover:scale-105 transition-all duration-200 shadow-lg"
            >
              <Plus size={20} />
              <span>Upload Document</span>
            </button>
          </div>
        </div>

        {/* Network Status Warning */}
        {connectionStatus === 'offline' && (
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded">
            <div className="flex items-center">
              <WifiOff className="text-yellow-400 mr-2" size={20} />
              <p className="text-yellow-700">
                You're currently offline. Document management is available, but AI quiz generation requires an internet connection.
              </p>
            </div>
          </div>
        )}

        {connectionStatus === 'error' && (
          <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded">
            <div className="flex items-center">
              <AlertCircle className="text-red-400 mr-2" size={20} />
              <p className="text-red-700">
                AI service is temporarily unavailable. You can still manage documents, but quiz generation may not work properly.
              </p>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
          <div className="flex flex-col md:flex-row space-y-4 md:space-y-0 md:space-x-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Search documents..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
            <div className="relative">
              <Tag className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <select
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent appearance-none bg-white"
              >
                <option value="all">All Subjects</option>
                {SUBJECTS.map(subject => (
                  <option key={subject} value={subject}>{subject}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">Total Documents</p>
                <p className="text-2xl font-bold text-gray-800">{documents.length}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <FileText className="text-blue-600" size={24} />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">Subjects</p>
                <p className="text-2xl font-bold text-gray-800">
                  {new Set(documents.map(d => d.subject)).size}
                </p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <BookOpen className="text-green-600" size={24} />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">AI Quizzes</p>
                <p className="text-2xl font-bold text-gray-800">12</p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <Brain className="text-purple-600" size={24} />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">Total Views</p>
                <p className="text-2xl font-bold text-gray-800">156</p>
              </div>
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                <Eye className="text-orange-600" size={24} />
              </div>
            </div>
          </div>
        </div>

        {/* Documents Grid */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-100">
          <div className="p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">
              Your Documents ({filteredDocuments.length})
            </h2>
            
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                <span className="ml-3 text-gray-600">Loading documents...</span>
              </div>
            ) : filteredDocuments.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredDocuments.map((doc) => (
                  <div key={doc.id} className="bg-gray-50 rounded-lg p-6 border border-gray-200 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-4">
                      <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                        <FileText className="text-blue-600" size={24} />
                      </div>
                      <div className="flex space-x-2">
                        <button 
                          onClick={() => handleGenerateQuiz(doc)}
                          disabled={connectionStatus === 'offline'}
                          className="p-2 text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title={connectionStatus === 'offline' ? 'AI quiz generation requires internet connection' : 'Generate AI Quiz'}
                        >
                          <Brain size={16} />
                        </button>
                        <button className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                          <Eye size={16} />
                        </button>
                        <button className="p-2 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors">
                          <Download size={16} />
                        </button>
                        <button 
                          onClick={() => handleDeleteDocument(doc.id)}
                          className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                    
                    <h3 className="font-bold text-gray-800 mb-2">{doc.title}</h3>
                    
                    <div className="space-y-2 mb-4">
                      <div className="flex items-center text-sm text-gray-600">
                        <Tag size={14} className="mr-2" />
                        <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded-full text-xs">
                          {doc.subject}
                        </span>
                      </div>
                      <div className="flex items-center text-sm text-gray-600">
                        <Calendar size={14} className="mr-2" />
                        <span>{new Date(doc.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Ready for AI quiz</span>
                      <span className="text-gray-500">Document</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <FileText className="mx-auto text-gray-300 mb-4" size={64} />
                <h3 className="text-xl font-medium text-gray-600 mb-2">No documents found</h3>
                <p className="text-gray-500 mb-6">
                  {searchTerm || selectedSubject !== 'all' 
                    ? 'Try adjusting your search or filters'
                    : 'Upload your first document to get started'
                  }
                </p>
                <button
                  onClick={() => setShowUploadModal(true)}
                  className="bg-gradient-to-r from-blue-500 to-purple-500 text-white px-6 py-3 rounded-lg hover:from-blue-600 hover:to-purple-600 transition-all duration-200"
                >
                  Upload Document
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Upload Modal */}
        {showUploadModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl p-8 max-w-md w-full">
              <h2 className="text-2xl font-bold text-gray-800 mb-6">Upload Document</h2>
              
              <form onSubmit={handleFileUpload} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Document Title
                  </label>
                  <input
                    type="text"
                    value={uploadForm.title}
                    onChange={(e) => setUploadForm({...uploadForm, title: e.target.value})}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="Enter document title"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Subject
                  </label>
                  <select
                    value={uploadForm.subject}
                    onChange={(e) => setUploadForm({...uploadForm, subject: e.target.value})}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
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
                    Document File
                  </label>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.txt"
                    onChange={(e) => setUploadForm({...uploadForm, file: e.target.files[0]})}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Supported formats: PDF, DOC, DOCX, TXT
                  </p>
                </div>

                <div className="flex space-x-4 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowUploadModal(false)}
                    className="flex-1 bg-gray-100 text-gray-700 py-3 px-4 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 bg-gradient-to-r from-blue-500 to-purple-500 text-white py-3 px-4 rounded-lg hover:from-blue-600 hover:to-purple-600 transition-all duration-200 disabled:opacity-50"
                  >
                    {loading ? 'Uploading...' : 'Upload'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Quiz Generation Modal */}
        {showQuizModal && selectedDocument && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl p-8 max-w-md w-full">
              <div className="flex items-center mb-6">
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mr-4">
                  <Brain className="text-purple-600" size={24} />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-800">Generate AI Quiz</h2>
                  <p className="text-gray-600 text-sm">From: {selectedDocument.title}</p>
                </div>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Number of Questions
                  </label>
                  <select
                    value={quizForm.numQuestions}
                    onChange={(e) => setQuizForm({...quizForm, numQuestions: parseInt(e.target.value)})}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value={3}>3 Questions</option>
                    <option value={5}>5 Questions</option>
                    <option value={10}>10 Questions</option>
                    <option value={15}>15 Questions</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Difficulty Level
                  </label>
                  <select
                    value={quizForm.difficulty}
                    onChange={(e) => setQuizForm({...quizForm, difficulty: e.target.value})}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </div>

                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="flex items-center text-blue-800 mb-2">
                    <Zap size={16} className="mr-2" />
                    <span className="font-medium">AI-Powered Generation</span>
                  </div>
                  <p className="text-blue-700 text-sm">
                    Our AI will analyze your document "{selectedDocument.title}" and create relevant {selectedDocument.subject} questions based on the content.
                  </p>
                </div>

                {connectionStatus !== 'connected' && (
                  <div className="bg-yellow-50 p-4 rounded-lg">
                    <div className="flex items-center text-yellow-800 mb-2">
                      <AlertCircle size={16} className="mr-2" />
                      <span className="font-medium">Connection Issue</span>
                    </div>
                    <p className="text-yellow-700 text-sm">
                      {connectionStatus === 'offline' 
                        ? 'You\'re offline. Please check your internet connection.'
                        : 'AI service is experiencing issues. Quiz generation may use fallback questions.'
                      }
                    </p>
                  </div>
                )}

                <div className="flex space-x-4 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowQuizModal(false);
                      setSelectedDocument(null);
                    }}
                    className="flex-1 bg-gray-100 text-gray-700 py-3 px-4 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={generateQuizFromDocument}
                    disabled={quizGenerating || connectionStatus === 'offline'}
                    className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 px-4 rounded-lg hover:from-purple-600 hover:to-pink-600 transition-all duration-200 disabled:opacity-50 flex items-center justify-center"
                  >
                    {quizGenerating ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                        Generating...
                      </>
                    ) : (
                      <>
                        <Brain size={16} className="mr-2" />
                        Generate Quiz
                      </>
                    )}
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

export default DocumentHub;