import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import Layout from '../../components/Layout';
import { 
  Calendar,
  Users,
  TrendingUp,
  FileText,
  BarChart3,
  Download,
  Eye,
  Clock,
  CheckCircle,
  AlertCircle
} from 'lucide-react';

const GradingHistory = () => {
  const { user } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [stats, setStats] = useState({
    totalSessions: 0,
    totalSubmissions: 0,
    totalTimeSaved: 0,
    averageScore: 0
  });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, completed, in_progress
  const [sortBy, setSortBy] = useState('created_at'); // created_at, session_name, status

  useEffect(() => {
    if (user) {
      loadGradingHistory();
    }
  }, [user]);

  const loadGradingHistory = async () => {
    setLoading(true);
    try {
      // Mock historical data
      const mockSessions = [
        {
          id: '1',
          session_name: 'Mathematics Quiz - Chapter 5',
          status: 'completed',
          total_submissions: 25,
          graded_submissions: 25,
          created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          completed_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
          question_paper: {
            title: 'Algebra and Equations',
            subject: 'Mathematics',
            total_marks: 50
          },
          average_score: 84.2,
          time_saved: 180 // minutes
        },
        {
          id: '2',
          session_name: 'Science Test - Photosynthesis',
          status: 'completed',
          total_submissions: 18,
          graded_submissions: 18,
          created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
          completed_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
          question_paper: {
            title: 'Plant Biology',
            subject: 'Science',
            total_marks: 40
          },
          average_score: 78.9,
          time_saved: 135
        },
        {
          id: '3',
          session_name: 'History Assignment - Ancient Civilizations',
          status: 'in_progress',
          total_submissions: 22,
          graded_submissions: 8,
          created_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
          question_paper: {
            title: 'Harappan Civilization',
            subject: 'History',
            total_marks: 60
          },
          average_score: 72.5,
          time_saved: 60
        },
        {
          id: '4',
          session_name: 'English Literature - Poetry Analysis',
          status: 'completed',
          total_submissions: 20,
          graded_submissions: 20,
          created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          completed_at: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
          question_paper: {
            title: 'Modern Poetry',
            subject: 'English',
            total_marks: 45
          },
          average_score: 81.7,
          time_saved: 150
        },
        {
          id: '5',
          session_name: 'Computer Science - Algorithms',
          status: 'completed',
          total_submissions: 15,
          graded_submissions: 15,
          created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
          completed_at: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000).toISOString(),
          question_paper: {
            title: 'Sorting Algorithms',
            subject: 'Computer Science',
            total_marks: 55
          },
          average_score: 88.3,
          time_saved: 112
        }
      ];

      setSessions(mockSessions);
      
      // Calculate stats
      const totalSessions = mockSessions.length;
      const totalSubmissions = mockSessions.reduce((sum, session) => sum + session.total_submissions, 0);
      const totalTimeSaved = mockSessions.reduce((sum, session) => sum + session.time_saved, 0);
      const completedSessions = mockSessions.filter(s => s.status === 'completed');
      const averageScore = completedSessions.length > 0 
        ? completedSessions.reduce((sum, session) => sum + session.average_score, 0) / completedSessions.length 
        : 0;
      
      setStats({
        totalSessions,
        totalSubmissions,
        totalTimeSaved,
        averageScore
      });
    } catch (error) {
      console.error('Error loading grading history:', error);
    } finally {
      setLoading(false);
    }
  };

  const getFilteredAndSortedSessions = () => {
    let filtered = sessions;
    
    // Apply filter
    if (filter !== 'all') {
      filtered = sessions.filter(session => session.status === filter);
    }
    
    // Apply sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'session_name':
          return a.session_name.localeCompare(b.session_name);
        case 'status':
          return a.status.localeCompare(b.status);
        case 'created_at':
        default:
          return new Date(b.created_at) - new Date(a.created_at);
      }
    });
    
    return filtered;
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

  const formatTimeAgo = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now - date) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
    
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">Loading grading history...</p>
          </div>
        </div>
      </Layout>
    );
  }

  const filteredSessions = getFilteredAndSortedSessions();

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Grading History</h1>
            <p className="text-gray-600 mt-2">View and analyze your past grading sessions</p>
          </div>
          <Link
            to="/grading/create"
            className="bg-gradient-to-r from-green-500 to-teal-500 text-white px-6 py-3 rounded-lg hover:from-green-600 hover:to-teal-600 transition-all duration-200 shadow-lg"
          >
            New Session
          </Link>
        </div>

        {/* Summary Stats */}
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
                <p className="text-gray-600 text-sm">Papers Graded</p>
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
                <p className="text-gray-600 text-sm">Time Saved</p>
                <p className="text-2xl font-bold text-gray-800">{Math.round(stats.totalTimeSaved / 60)}h</p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <Clock className="text-purple-600" size={24} />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">Avg Class Score</p>
                <p className="text-2xl font-bold text-gray-800">{stats.averageScore.toFixed(1)}%</p>
              </div>
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="text-orange-600" size={24} />
              </div>
            </div>
          </div>
        </div>

        {/* Filters and Controls */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
            <div className="flex items-center space-x-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Status</label>
                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">All Sessions</option>
                  <option value="completed">Completed</option>
                  <option value="in_progress">In Progress</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sort by</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="created_at">Date Created</option>
                  <option value="session_name">Session Name</option>
                  <option value="status">Status</option>
                </select>
              </div>
            </div>
            
            <div className="text-sm text-gray-600">
              Showing {filteredSessions.length} of {sessions.length} sessions
            </div>
          </div>
        </div>

        {/* Sessions List */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-100">
          <div className="p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">
              Grading Sessions
            </h2>
            
            {filteredSessions.length > 0 ? (
              <div className="space-y-4">
                {filteredSessions.map((session) => (
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
                          {session.status === 'completed' && (
                            <>
                              <span>•</span>
                              <span>Avg: {session.average_score.toFixed(1)}%</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Link
                          to={`/grading/analytics/${session.id}`}
                          className="flex items-center space-x-1 text-blue-600 hover:text-blue-800 text-sm font-medium bg-blue-50 hover:bg-blue-100 px-3 py-2 rounded-lg transition-colors"
                        >
                          <BarChart3 size={14} />
                          <span>Analytics</span>
                        </Link>
                        {session.status === 'in_progress' && (
                          <Link
                            to={`/grading/session/${session.id}`}
                            className="flex items-center space-x-1 text-green-600 hover:text-green-800 text-sm font-medium bg-green-50 hover:bg-green-100 px-3 py-2 rounded-lg transition-colors"
                          >
                            <Eye size={14} />
                            <span>Continue</span>
                          </Link>
                        )}
                        <button className="flex items-center space-x-1 text-gray-600 hover:text-gray-800 text-sm font-medium bg-gray-50 hover:bg-gray-100 px-3 py-2 rounded-lg transition-colors">
                          <Download size={14} />
                          <span>Export</span>
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
                          className={`h-2 rounded-full transition-all duration-300 ${
                            session.status === 'completed' 
                              ? 'bg-gradient-to-r from-green-500 to-teal-500' 
                              : 'bg-gradient-to-r from-blue-500 to-purple-500'
                          }`}
                          style={{ width: `${getProgressPercentage(session)}%` }}
                        ></div>
                      </div>
                    </div>

                    {/* Session Details */}
                    <div className="flex items-center justify-between text-sm text-gray-500">
                      <div className="flex items-center space-x-4">
                        <span className="flex items-center">
                          <Calendar size={14} className="mr-1" />
                          Created {formatTimeAgo(session.created_at)}
                        </span>
                        {session.completed_at && (
                          <span className="flex items-center">
                            <CheckCircle size={14} className="mr-1" />
                            Completed {formatTimeAgo(session.completed_at)}
                          </span>
                        )}
                        <span className="flex items-center">
                          <Clock size={14} className="mr-1" />
                          Saved {session.time_saved} min
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs text-gray-400">
                          ID: {session.id}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <FileText className="mx-auto text-gray-300 mb-4" size={64} />
                <h3 className="text-xl font-medium text-gray-600 mb-2">No sessions found</h3>
                <p className="text-gray-500 mb-6">
                  {filter === 'all' 
                    ? 'You haven\'t created any grading sessions yet'
                    : `No ${filter.replace('_', ' ')} sessions found`
                  }
                </p>
                <Link
                  to="/grading/create"
                  className="bg-gradient-to-r from-green-500 to-teal-500 text-white px-6 py-3 rounded-lg hover:from-green-600 hover:to-teal-600 transition-all duration-200"
                >
                  Create First Session
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default GradingHistory;