import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Layout from '../components/Layout';
import { DatabaseService } from '../services/supabase';
import { WatsonxService } from '../services/watsonx';
import { 
  Brain, 
  Plus, 
  Play, 
  Trophy, 
  Clock, 
  Target,
  CheckCircle,
  XCircle,
  Star,
  Sparkles,
  FileText,
  Edit3,
  Trash2,
  AlertCircle,
  Users,
  BarChart3
} from 'lucide-react';

const QuizCenter = () => {
  const { user, profile, updateXP } = useAuth();
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showQuizModal, setShowQuizModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAnalyticsModal, setShowAnalyticsModal] = useState(false);
  const [currentQuiz, setCurrentQuiz] = useState(null);
  const [editingQuiz, setEditingQuiz] = useState(null);
  const [selectedQuizAnalytics, setSelectedQuizAnalytics] = useState(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [quizResults, setQuizResults] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [quizAnalytics, setQuizAnalytics] = useState({});
  
  const [createForm, setCreateForm] = useState({
    title: '',
    document_id: '',
    questions: [
      {
        question: '',
        options: ['', '', '', ''],
        correct_answer: 0
      }
    ]
  });

  useEffect(() => {
    // Separate function to avoid re-running on every 'quizzes' change
    const fetchInitialData = async () => {
        setLoading(true);
        await Promise.all([
          loadQuizzes(),
          loadDocuments()
        ]);
        setLoading(false);
    };
    fetchInitialData();
  }, [profile]); // Rerun if profile changes (e.g., on login)

  useEffect(() => {
    if (profile?.role === 'teacher' && quizzes.length > 0) {
      loadQuizAnalytics();
    }
  }, [quizzes, profile]);

  const loadQuizzes = async () => {
    try {
      const { data } = profile?.role === 'teacher' 
        ? await DatabaseService.getQuizzesByCreator(user?.id)
        : await DatabaseService.getQuizzes();
      
      if (data) {
        setQuizzes(data);
      }
    } catch (error) {
      console.error('Error loading quizzes:', error);
    }
  };

  const loadDocuments = async () => {
    try {
      const { data } = await DatabaseService.getDocuments();
      if (data) {
        setDocuments(data);
      }
    } catch (error) {
      console.error('Error loading documents:', error);
    }
  };

  const loadQuizAnalytics = async () => {
    try {
      const analytics = {};
      const analyticsPromises = quizzes.map(async (quiz) => {
        const { data } = await DatabaseService.getQuizAnalytics(quiz.id);
        if (data) {
          analytics[quiz.id] = data;
        }
      });
      await Promise.all(analyticsPromises);
      setQuizAnalytics(analytics);
    } catch (error) {
      console.error('Error loading quiz analytics:', error);
    }
  };

  const showQuizAnalytics = async (quiz) => {
    try {
      const { data } = await DatabaseService.getQuizAnalytics(quiz.id);
      if (data) {
        setSelectedQuizAnalytics({ quiz, analytics: data });
        setShowAnalyticsModal(true);
      }
    } catch (error) {
      console.error('Error loading quiz analytics:', error);
    }
  };

  const handleCreateQuiz = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await DatabaseService.createQuiz({
        ...createForm,
        created_by: user.id,
        document_id: createForm.document_id || null
      });

      if (!error) {
        setShowCreateModal(false);
        resetCreateForm();
        await loadQuizzes();
      }
    } catch (error) {
      console.error('Create quiz error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEditQuiz = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await DatabaseService.updateQuiz(editingQuiz.id, {
        title: editingQuiz.title,
        questions: editingQuiz.questions,
        document_id: editingQuiz.document_id || null
      });

      if (!error) {
        setShowEditModal(false);
        setEditingQuiz(null);
        await loadQuizzes();
      }
    } catch (error) {
      console.error('Update quiz error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteQuiz = async (quizId) => {
    setLoading(true);
    try {
      const { error } = await DatabaseService.deleteQuiz(quizId);
      if (!error) {
        await loadQuizzes();
        setDeleteConfirm(null);
      }
    } catch (error) {
      console.error('Delete quiz error:', error);
    } finally {
      setLoading(false);
    }
  };

  const resetCreateForm = () => {
    setCreateForm({
      title: '',
      document_id: '',
      questions: [{
        question: '',
        options: ['', '', '', ''],
        correct_answer: 0
      }]
    });
  };

  const generateQuizFromDocument = async (documentId) => {
    setLoading(true);
    const document = documents.find(d => d.id === documentId);
    
    if (document) {
      try {
        const questions = await WatsonxService.generateQuizFromDocument(document);
        
        setCreateForm({
          title: `Quiz: ${document.title}`,
          document_id: documentId,
          questions: questions.length > 0 ? questions : [{
            question: '',
            options: ['', '', '', ''],
            correct_answer: 0
          }]
        });
      } catch (error) {
        console.error('Error generating quiz:', error);
      }
    }
    setLoading(false);
  };

  const startQuiz = (quiz) => {
    setCurrentQuiz(quiz);
    setCurrentQuestionIndex(0);
    setSelectedAnswers({});
    setQuizResults(null);
    setShowQuizModal(true);
  };

  const startEditQuiz = (quiz) => {
    setEditingQuiz({
      ...quiz,
      questions: quiz.questions || []
    });
    setShowEditModal(true);
  };

  const handleAnswerSelect = (questionIndex, answerIndex) => {
    setSelectedAnswers({
      ...selectedAnswers,
      [questionIndex]: answerIndex
    });
  };

  const nextQuestion = () => {
    if (currentQuestionIndex < currentQuiz.questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      finishQuiz();
    }
  };

  const finishQuiz = async () => {
    const questions = currentQuiz.questions;
    let correctAnswers = 0;

    questions.forEach((question, index) => {
      if (selectedAnswers[index] === question.correct_answer) {
        correctAnswers++;
      }
    });

    const score = questions.length > 0 ? (correctAnswers / questions.length) * 100 : 0;
    const xpEarned = score >= 90 ? 30 : score >= 70 ? 20 : 10;

    try {
      await DatabaseService.submitQuizAttempt({
        quiz_id: currentQuiz.id,
        user_id: user.id,
        score: score,
        answers: Object.keys(selectedAnswers).map(qIndex => ({
          question_index: parseInt(qIndex),
          selected_answer: selectedAnswers[qIndex]
        })),
        timestamp: new Date().toISOString()
      });

      await updateXP(xpEarned);
    } catch (error) {
      console.error('Error saving quiz attempt:', error);
    }

    setQuizResults({
      score,
      correctAnswers,
      totalQuestions: questions.length,
      xpEarned
    });
  };

  const addQuestion = (isEdit = false) => {
    const newQuestion = {
      question: '',
      options: ['', '', '', ''],
      correct_answer: 0
    };

    if (isEdit) {
      setEditingQuiz({
        ...editingQuiz,
        questions: [...editingQuiz.questions, newQuestion]
      });
    } else {
      setCreateForm({
        ...createForm,
        questions: [...createForm.questions, newQuestion]
      });
    }
  };

  const updateQuestion = (index, field, value, isEdit = false) => {
    const targetForm = isEdit ? editingQuiz : createForm;
    const setTargetForm = isEdit ? setEditingQuiz : setCreateForm;
    
    const updatedQuestions = [...targetForm.questions];
    updatedQuestions[index] = {
      ...updatedQuestions[index],
      [field]: value
    };
    
    setTargetForm({
      ...targetForm,
      questions: updatedQuestions
    });
  };

  const updateOption = (questionIndex, optionIndex, value, isEdit = false) => {
    const targetForm = isEdit ? editingQuiz : createForm;
    const setTargetForm = isEdit ? setEditingQuiz : setCreateForm;
    
    const updatedQuestions = [...targetForm.questions];
    updatedQuestions[questionIndex].options[optionIndex] = value;
    
    setTargetForm({
      ...targetForm,
      questions: updatedQuestions
    });
  };

  const removeQuestion = (index, isEdit = false) => {
    const targetForm = isEdit ? editingQuiz : createForm;
    const setTargetForm = isEdit ? setEditingQuiz : setCreateForm;
    
    if (targetForm.questions.length > 1) {
      const updatedQuestions = targetForm.questions.filter((_, i) => i !== index);
      setTargetForm({
        ...targetForm,
        questions: updatedQuestions
      });
    }
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-8 p-4 sm:p-6 lg:p-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Quiz Center</h1>
            <p className="text-gray-600 mt-2">
              {profile?.role === 'teacher' 
                ? 'Create and manage quizzes for your students'
                : 'Test your knowledge and earn XP points'
              }
            </p>
          </div>
          {profile?.role === 'teacher' && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center space-x-2 bg-gradient-to-r from-green-500 to-teal-500 text-white px-6 py-3 rounded-lg hover:from-green-600 hover:to-teal-600 transform hover:scale-105 transition-all duration-200 shadow-lg"
            >
              <Plus size={20} />
              <span>Create Quiz</span>
            </button>
          )}
        </div>

        {/* Stats for Students */}
        {profile?.role === 'student' && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm">Quizzes Available</p>
                  <p className="text-2xl font-bold text-gray-800">{quizzes.length}</p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Brain className="text-blue-600" size={24} />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm">Average Score</p>
                  <p className="text-2xl font-bold text-gray-800">87%</p>
                </div>
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <Target className="text-green-600" size={24} />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm">Perfect Scores</p>
                  <p className="text-2xl font-bold text-gray-800">3</p>
                </div>
                <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                  <Trophy className="text-yellow-600" size={24} />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm">XP Earned</p>
                  <p className="text-2xl font-bold text-gray-800">240</p>
                </div>
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Star className="text-purple-600" size={24} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Quizzes Grid */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-100">
          <div className="p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">
              {profile?.role === 'teacher' ? 'Your Quizzes' : 'Available Quizzes'} ({quizzes.length})
            </h2>
            
            {loading && quizzes.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                <span className="ml-3 text-gray-600">Loading quizzes...</span>
              </div>
            ) : quizzes.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {quizzes.map((quiz) => {
                  const analytics = quizAnalytics[quiz.id];
                  return (
                    <div key={quiz.id} className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg p-6 border border-blue-100 hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between mb-4">
                        <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg flex items-center justify-center">
                          <Brain className="text-white" size={24} />
                        </div>
                        <div className="text-right">
                          <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs">
                            {quiz.questions?.length || 0} questions
                          </span>
                        </div>
                      </div>
                      
                      <h3 className="font-bold text-gray-800 mb-2 truncate">{quiz.title}</h3>
                      
                      <div className="space-y-2 mb-4">
                        <div className="flex items-center text-sm text-gray-600">
                          <Clock size={14} className="mr-2" />
                          <span>~{(quiz.questions?.length || 0) * 1} minute</span>
                        </div>
                        {quiz.document_id && (
                          <div className="flex items-center text-sm text-gray-600">
                            <FileText size={14} className="mr-2" />
                            <span>Based on document</span>
                          </div>
                        )}
                        {profile?.role === 'teacher' && analytics && (
                          <div className="flex items-center text-sm text-gray-600">
                            <Users size={14} className="mr-2" />
                            <span>{analytics.totalAttempts} attempts • {Math.round(analytics.averageScore)}% avg</span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between">
                        {profile?.role === 'student' ? (
                          <button
                            onClick={() => startQuiz(quiz)}
                            className="flex items-center space-x-2 bg-gradient-to-r from-green-500 to-teal-500 text-white px-4 py-2 rounded-lg hover:from-green-600 hover:to-teal-600 transition-all duration-200"
                          >
                            <Play size={16} />
                            <span>Start Quiz</span>
                          </button>
                        ) : (
                          <div className="flex space-x-2">
                            <button 
                              onClick={() => showQuizAnalytics(quiz)}
                              className="flex items-center space-x-1 text-purple-600 hover:text-purple-800 text-sm font-medium bg-purple-50 hover:bg-purple-100 px-3 py-2 rounded-lg transition-colors"
                            >
                              <BarChart3 size={14} />
                              <span>Analytics</span>
                            </button>
                            <button 
                              onClick={() => startEditQuiz(quiz)}
                              className="flex items-center space-x-1 text-blue-600 hover:text-blue-800 text-sm font-medium bg-blue-50 hover:bg-blue-100 px-3 py-2 rounded-lg transition-colors"
                            >
                              <Edit3 size={14} />
                              <span>Edit</span>
                            </button>
                            <button 
                              onClick={() => setDeleteConfirm(quiz.id)}
                              className="flex items-center space-x-1 text-red-600 hover:text-red-800 text-sm font-medium bg-red-50 hover:bg-red-100 px-3 py-2 rounded-lg transition-colors"
                            >
                              <Trash2 size={14} />
                              <span>Delete</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12">
                <Brain className="mx-auto text-gray-300 mb-4" size={64} />
                <h3 className="text-xl font-medium text-gray-600 mb-2">No quizzes available</h3>
                <p className="text-gray-500 mb-6">
                  {profile?.role === 'teacher' 
                    ? 'Create your first quiz to get started'
                    : 'Check back later for new quizzes'
                  }
                </p>
                {profile?.role === 'teacher' && (
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="bg-gradient-to-r from-green-500 to-teal-500 text-white px-6 py-3 rounded-lg hover:from-green-600 hover:to-teal-600 transition-all duration-200"
                  >
                    Create Quiz
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Analytics Modal */}
        {showAnalyticsModal && selectedQuizAnalytics && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl p-8 max-w-2xl w-full">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-800">Quiz Analytics</h2>
                <button
                  onClick={() => setShowAnalyticsModal(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>
              
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-2">{selectedQuizAnalytics.quiz.title}</h3>
                <p className="text-gray-600">{selectedQuizAnalytics.quiz.questions?.length || 0} questions</p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-blue-50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-blue-600">{selectedQuizAnalytics.analytics.totalAttempts}</div>
                  <div className="text-blue-700 text-sm">Total Attempts</div>
                </div>
                <div className="bg-green-50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-green-600">{Math.round(selectedQuizAnalytics.analytics.averageScore)}%</div>
                  <div className="text-green-700 text-sm">Average Score</div>
                </div>
                <div className="bg-yellow-50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-yellow-600">{Math.round(selectedQuizAnalytics.analytics.highestScore)}%</div>
                  <div className="text-yellow-700 text-sm">Highest Score</div>
                </div>
                <div className="bg-red-50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-red-600">{Math.round(selectedQuizAnalytics.analytics.lowestScore)}%</div>
                  <div className="text-red-700 text-sm">Lowest Score</div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-semibold text-gray-800 mb-3">Score Distribution</h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-green-600">Excellent (90%+)</span>
                    <span className="font-semibold">{selectedQuizAnalytics.analytics.scoreDistribution.excellent} students</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-blue-600">Good (70-89%)</span>
                    <span className="font-semibold">{selectedQuizAnalytics.analytics.scoreDistribution.good} students</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-red-600">{'Needs Improvement (<70%)'}</span>
                    <span className="font-semibold">{selectedQuizAnalytics.analytics.scoreDistribution.needsImprovement} students</span>
                  </div>
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
                <h2 className="text-xl font-bold text-gray-800 mb-2">Delete Quiz</h2>
                <p className="text-gray-600 mb-6">
                  Are you sure you want to delete this quiz? This action cannot be undone and will remove all student attempts.
                </p>
                <div className="flex space-x-4">
                  <button
                    onClick={() => setDeleteConfirm(null)}
                    className="flex-1 bg-gray-100 text-gray-700 py-3 px-4 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleDeleteQuiz(deleteConfirm)}
                    disabled={loading}
                    className="flex-1 bg-red-500 text-white py-3 px-4 rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
                  >
                    {loading ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Create Quiz Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
            <div className="bg-white rounded-2xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <h2 className="text-2xl font-bold text-gray-800 mb-6">Create New Quiz</h2>
              
              <form onSubmit={handleCreateQuiz} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Quiz Title
                  </label>
                  <input
                    type="text"
                    value={createForm.title}
                    onChange={(e) => setCreateForm({...createForm, title: e.target.value})}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="Enter quiz title"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Based on Document (Optional)
                  </label>
                  <div className="flex space-x-2">
                    <select
                      value={createForm.document_id}
                      onChange={(e) => setCreateForm({...createForm, document_id: e.target.value})}
                      className="flex-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    >
                      <option value="">Select a document</option>
                      {documents.map(doc => (
                        <option key={doc.id} value={doc.id}>{doc.title}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => generateQuizFromDocument(createForm.document_id)}
                      disabled={!createForm.document_id || loading}
                      className="flex items-center space-x-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white px-4 py-3 rounded-lg hover:from-purple-600 hover:to-pink-600 transition-all duration-200 disabled:opacity-50"
                    >
                      <Sparkles size={16} />
                      <span>AI Generate</span>
                    </button>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-4">
                    <label className="block text-sm font-medium text-gray-700">
                      Questions
                    </label>
                    <button
                      type="button"
                      onClick={() => addQuestion(false)}
                      className="text-purple-600 hover:text-purple-800 text-sm font-medium"
                    >
                      + Add Question
                    </button>
                  </div>

                  <div className="space-y-6">
                    {createForm.questions.map((question, qIndex) => (
                      <div key={qIndex} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                        <div className="flex items-center justify-between mb-4">
                          <label className="block text-sm font-medium text-gray-700">
                            Question {qIndex + 1}
                          </label>
                          {createForm.questions.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeQuestion(qIndex, false)}
                              className="text-red-600 hover:text-red-800 text-sm"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                        <input
                          type="text"
                          value={question.question}
                          onChange={(e) => updateQuestion(qIndex, 'question', e.target.value, false)}
                          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent mb-4"
                          placeholder="Enter question"
                          required
                        />

                        <div className="space-y-2">
                          <label className="block text-sm font-medium text-gray-700">
                            Answer Options
                          </label>
                          {question.options.map((option, oIndex) => (
                            <div key={oIndex} className="flex items-center space-x-3">
                              <input
                                type="radio"
                                name={`correct-${qIndex}`}
                                checked={question.correct_answer === oIndex}
                                onChange={() => updateQuestion(qIndex, 'correct_answer', oIndex, false)}
                                className="text-purple-600 focus:ring-purple-500"
                              />
                              <input
                                type="text"
                                value={option}
                                onChange={(e) => updateOption(qIndex, oIndex, e.target.value, false)}
                                className="flex-1 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                placeholder={`Option ${oIndex + 1}`}
                                required
                              />
                            </div>
                          ))}
                        </div>
                
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex space-x-4 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateModal(false);
                      resetCreateForm();
                    }}
                    className="flex-1 bg-gray-100 text-gray-700 py-3 px-4 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 bg-gradient-to-r from-green-500 to-teal-500 text-white py-3 px-4 rounded-lg hover:from-green-600 hover:to-teal-600 transition-all duration-200 disabled:opacity-50"
                  >
                    {loading ? 'Creating...' : 'Create Quiz'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit Quiz Modal */}
        {showEditModal && editingQuiz && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
            <div className="bg-white rounded-2xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <h2 className="text-2xl font-bold text-gray-800 mb-6">Edit Quiz</h2>
              
              <form onSubmit={handleEditQuiz} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Quiz Title
                  </label>
                  <input
                    type="text"
                    value={editingQuiz.title}
                    onChange={(e) => setEditingQuiz({...editingQuiz, title: e.target.value})}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="Enter quiz title"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Based on Document (Optional)
                  </label>
                  <select
                    value={editingQuiz.document_id || ''}
                    onChange={(e) => setEditingQuiz({...editingQuiz, document_id: e.target.value})}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="">Select a document</option>
                    {documents.map(doc => (
                      <option key={doc.id} value={doc.id}>{doc.title}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-4">
                    <label className="block text-sm font-medium text-gray-700">
                      Questions
                    </label>
                    <button
                      type="button"
                      onClick={() => addQuestion(true)}
                      className="text-purple-600 hover:text-purple-800 text-sm font-medium"
                    >
                      + Add Question
                    </button>
                  </div>

                  <div className="space-y-6">
                    {editingQuiz.questions.map((question, qIndex) => (
                      <div key={qIndex} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                        <div className="flex items-center justify-between mb-4">
                          <label className="block text-sm font-medium text-gray-700">
                            Question {qIndex + 1}
                          </label>
                          {editingQuiz.questions.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeQuestion(qIndex, true)}
                              className="text-red-600 hover:text-red-800 text-sm"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                        <input
                          type="text"
                          value={question.question}
                          onChange={(e) => updateQuestion(qIndex, 'question', e.target.value, true)}
                          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent mb-4"
                          placeholder="Enter question"
                          required
                        />

                        <div className="space-y-2">
                          <label className="block text-sm font-medium text-gray-700">
                            Answer Options
                          </label>
                          {question.options.map((option, oIndex) => (
                            <div key={oIndex} className="flex items-center space-x-3">
                              <input
                                type="radio"
                                name={`edit-correct-${qIndex}`}
                                checked={question.correct_answer === oIndex}
                                onChange={() => updateQuestion(qIndex, 'correct_answer', oIndex, true)}
                                className="text-purple-600 focus:ring-purple-500"
                              />
                              <input
                                type="text"
                                value={option}
                                onChange={(e) => updateOption(qIndex, oIndex, e.target.value, true)}
                                className="flex-1 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                placeholder={`Option ${oIndex + 1}`}
                                required
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex space-x-4 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditModal(false);
                      setEditingQuiz(null);
                    }}
                    className="flex-1 bg-gray-100 text-gray-700 py-3 px-4 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 bg-gradient-to-r from-blue-500 to-indigo-500 text-white py-3 px-4 rounded-lg hover:from-blue-600 hover:to-indigo-600 transition-all duration-200 disabled:opacity-50"
                  >
                    {loading ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Quiz Taking Modal */}
        {showQuizModal && currentQuiz && !quizResults && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl p-8 max-w-2xl w-full">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-800">{currentQuiz.title}</h2>
                <div className="text-sm text-gray-600">
                  Question {currentQuestionIndex + 1} of {currentQuiz.questions.length}
                </div>
              </div>

              <div className="mb-6">
                <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
                  <div 
                    className="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${((currentQuestionIndex + 1) / currentQuiz.questions.length) * 100}%` }}
                  ></div>
                </div>
              </div>

              <div className="mb-8">
                <h3 className="text-xl font-medium text-gray-800 mb-6">
                  {currentQuiz.questions[currentQuestionIndex].question}
                </h3>

                <div className="space-y-3">
                  {currentQuiz.questions[currentQuestionIndex].options.map((option, index) => (
                    <button
                      key={index}
                      onClick={() => handleAnswerSelect(currentQuestionIndex, index)}
                      className={`w-full p-4 text-left rounded-lg border-2 transition-all duration-200 ${
                        selectedAnswers[currentQuestionIndex] === index
                          ? 'border-purple-500 bg-purple-50 text-purple-800'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                          selectedAnswers[currentQuestionIndex] === index
                            ? 'border-purple-500 bg-purple-500'
                            : 'border-gray-300'
                        }`}>
                          {selectedAnswers[currentQuestionIndex] === index && (
                            <CheckCircle className="text-white" size={16} />
                          )}
                        </div>
                        <span>{option}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-between">
                <button
                  onClick={() => setShowQuizModal(false)}
                  className="bg-gray-100 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Exit Quiz
                </button>
                <button
                  onClick={nextQuestion}
                  disabled={selectedAnswers[currentQuestionIndex] === undefined}
                  className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-6 py-3 rounded-lg hover:from-purple-600 hover:to-pink-600 transition-all duration-200 disabled:opacity-50"
                >
                  {currentQuestionIndex === currentQuiz.questions.length - 1 ? 'Finish Quiz' : 'Next Question'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Quiz Results Modal */}
        {showQuizModal && quizResults && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center">
              <div className="mb-6">
                {quizResults.score >= 90 ? (
                  <Trophy className="mx-auto text-yellow-500 mb-4" size={64} />
                ) : quizResults.score >= 70 ? (
                  <CheckCircle className="mx-auto text-green-500 mb-4" size={64} />
                ) : (
                  <XCircle className="mx-auto text-red-500 mb-4" size={64} />
                )}
                
                <h2 className="text-3xl font-bold text-gray-800 mb-2">
                  {quizResults.score >= 90 ? 'Excellent!' : quizResults.score >= 70 ? 'Good Job!' : 'Keep Trying!'}
                </h2>
                <p className="text-gray-600">Quiz completed successfully</p>
              </div>

              <div className="space-y-4 mb-8">
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="text-3xl font-bold text-purple-600 mb-1">
                    {Math.round(quizResults.score)}%
                  </div>
                  <div className="text-gray-600">Final Score</div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-green-50 rounded-lg p-4">
                    <div className="text-2xl font-bold text-green-600 mb-1">
                      {quizResults.correctAnswers}
                    </div>
                    <div className="text-green-700 text-sm">Correct</div>
                  </div>
                  <div className="bg-red-50 rounded-lg p-4">
                    <div className="text-2xl font-bold text-red-600 mb-1">
                      {quizResults.totalQuestions - quizResults.correctAnswers}
                    </div>
                    <div className="text-red-700 text-sm">Incorrect</div>
                  </div>
                </div>

                <div className="bg-purple-50 rounded-lg p-4">
                  <div className="text-2xl font-bold text-purple-600 mb-1">
                    +{quizResults.xpEarned} XP
                  </div>
                  <div className="text-purple-700 text-sm">Points Earned</div>
                </div>
              </div>

              <button
                onClick={() => {
                  setShowQuizModal(false);
                  setQuizResults(null);
                  setCurrentQuiz(null);
                }}
                className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 px-4 rounded-lg hover:from-purple-600 hover:to-pink-600 transition-all duration-200"
              >
                Continue Learning
              </button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default QuizCenter;