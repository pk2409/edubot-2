import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Layout from '../components/Layout';
import { 
  Users, 
  FileText, 
  Brain, 
  TrendingUp,
  Plus,
  BarChart3,
  Clock,
  Award,
  BookOpen,
  CheckSquare,
  MessageCircle
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const TeacherDashboard = () => {
  const { profile } = useAuth();
  const [stats, setStats] = useState({
    totalStudents: 24,
    totalQuizzes: 8,
    totalDocuments: 12,
    avgClassScore: 85,
    totalGradingSessions: 5,
    totalPapersGraded: 98,
    timeSaved: 12.5 // hours
  });

  const [recentActivity, setRecentActivity] = useState([]);
  const [classPerformance, setClassPerformance] = useState([]);
  const [gradingStats, setGradingStats] = useState({
    recentSessions: [],
    efficiency: 'Excellent'
  });

  useEffect(() => {
    // Load dashboard data
    setRecentActivity([
      { id: 1, type: 'quiz', student: 'Alice Johnson', action: 'Completed Math Quiz #3', score: 95, time: '2 hours ago' },
      { id: 2, type: 'document', student: 'Bob Smith', action: 'Viewed "Algebra Basics"', time: '4 hours ago' },
      { id: 3, type: 'quiz', student: 'Carol Davis', action: 'Completed Science Quiz', score: 88, time: '1 day ago' },
      { id: 4, type: 'grading', student: 'System', action: 'Completed grading session for Math Quiz', time: '2 days ago' }
    ]);

    setClassPerformance([
      { subject: 'Math', avgScore: 87, students: 24 },
      { subject: 'Science', avgScore: 82, students: 22 },
      { subject: 'History', avgScore: 91, students: 20 },
      { subject: 'English', avgScore: 89, students: 23 }
    ]);

    setGradingStats({
      recentSessions: [
        { id: '1', name: 'Mathematics Quiz - Chapter 5', submissions: 25, status: 'completed', avgScore: 84.2 },
        { id: '2', name: 'Science Test - Photosynthesis', submissions: 18, status: 'completed', avgScore: 78.9 },
        { id: '3', name: 'History Assignment', submissions: 22, status: 'in_progress', avgScore: 72.5 }
      ],
      efficiency: 'Excellent'
    });
  }, []);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Welcome Header */}
        <div className="bg-gradient-to-r from-green-500 via-teal-500 to-blue-500 rounded-2xl p-8 text-white shadow-xl">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">
                {getGreeting()}, {profile?.name}! 👩‍🏫
              </h1>
              <p className="text-green-100 text-lg">
                Your students are making great progress!
              </p>
            </div>
            <div className="text-right">
              <div className="text-4xl font-bold mb-1">{stats.totalStudents}</div>
              <div className="text-green-100">Active Students</div>
              <div className="text-sm text-green-200">Class Average: {stats.avgClassScore}%</div>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">Total Students</p>
                <p className="text-2xl font-bold text-gray-800">{stats.totalStudents}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Users className="text-blue-600" size={24} />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">Quizzes Created</p>
                <p className="text-2xl font-bold text-gray-800">{stats.totalQuizzes}</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <Brain className="text-green-600" size={24} />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">Documents</p>
                <p className="text-2xl font-bold text-gray-800">{stats.totalDocuments}</p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <FileText className="text-purple-600" size={24} />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">Class Average</p>
                <p className="text-2xl font-bold text-gray-800">{stats.avgClassScore}%</p>
              </div>
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="text-orange-600" size={24} />
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Quick Actions */}
            <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
              <h2 className="text-xl font-bold text-gray-800 mb-4">Quick Actions</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Link
                  to="/documents"
                  className="flex items-center space-x-4 p-4 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg hover:from-blue-600 hover:to-purple-600 transform hover:scale-105 transition-all duration-200 shadow-lg"
                >
                  <FileText size={24} />
                  <div>
                    <h3 className="font-bold">Manage Documents</h3>
                    <p className="text-sm opacity-90">Upload & organize materials</p>
                  </div>
                </Link>

                <Link
                  to="/quizzes"
                  className="flex items-center space-x-4 p-4 bg-gradient-to-r from-green-500 to-teal-500 text-white rounded-lg hover:from-green-600 hover:to-teal-600 transform hover:scale-105 transition-all duration-200 shadow-lg"
                >
                  <Brain size={24} />
                  <div>
                    <h3 className="font-bold">Create Quiz</h3>
                    <p className="text-sm opacity-90">Design new assessments</p>
                  </div>
                </Link>

                <Link
                  to="/grading"
                  className="flex items-center space-x-4 p-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 transform hover:scale-105 transition-all duration-200 shadow-lg"
                >
                  <CheckSquare size={24} />
                  <div>
                    <h3 className="font-bold">AI Grading</h3>
                    <p className="text-sm opacity-90">Grade handwritten papers</p>
                  </div>
                </Link>

                <Link
                  to="/chat"
                  className="flex items-center space-x-4 p-4 bg-gradient-to-r from-indigo-500 to-blue-500 text-white rounded-lg hover:from-indigo-600 hover:to-blue-600 transform hover:scale-105 transition-all duration-200 shadow-lg"
                >
                  <MessageCircle size={24} />
                  <div>
                    <h3 className="font-bold">AI Assistant</h3>
                    <p className="text-sm opacity-90">Teaching support & content</p>
                  </div>
                </Link>
              </div>
            </div>

            {/* Grading Overview */}
            <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-800">AI Grading Overview</h2>
                <Link
                  to="/grading"
                  className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-4 py-2 rounded-lg hover:shadow-lg transition-all text-sm"
                >
                  View All
                </Link>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg p-4 text-white">
                  <div className="text-2xl font-bold">{stats.totalGradingSessions}</div>
                  <div className="text-blue-100">Grading Sessions</div>
                </div>
                
                <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-lg p-4 text-white">
                  <div className="text-2xl font-bold">{stats.totalPapersGraded}</div>
                  <div className="text-green-100">Papers Graded</div>
                </div>
                
                <div className="bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg p-4 text-white">
                  <div className="text-2xl font-bold">{stats.timeSaved}h</div>
                  <div className="text-purple-100">Time Saved</div>
                </div>
              </div>

              {/* Recent Grading Sessions */}
              <div>
                <h3 className="text-lg font-medium text-gray-800 mb-4">Recent Grading Sessions</h3>
                <div className="space-y-2">
                  {gradingStats.recentSessions.map(session => (
                    <div key={session.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <div className="font-medium">{session.name}</div>
                        <div className="text-sm text-gray-600">
                          {session.submissions} submissions • Avg: {session.avgScore}%
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`text-sm font-medium ${
                          session.status === 'completed' ? 'text-green-600' : 'text-blue-600'
                        }`}>
                          {session.status === 'completed' ? 'Completed' : 'In Progress'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Class Performance Chart */}
            <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
              <h2 className="text-xl font-bold text-gray-800 mb-4">Class Performance by Subject</h2>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={classPerformance}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="subject" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="avgScore" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Recent Student Activity */}
            <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
              <h2 className="text-xl font-bold text-gray-800 mb-4">Recent Activity</h2>
              <div className="space-y-3">
                {recentActivity.map((activity) => (
                  <div key={activity.id} className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      {activity.type === 'quiz' && <Brain className="text-blue-600" size={20} />}
                      {activity.type === 'document' && <FileText className="text-purple-600" size={20} />}
                      {activity.type === 'grading' && <CheckSquare className="text-green-600" size={20} />}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-800">{activity.student}</p>
                      <p className="text-sm text-gray-600">{activity.action}</p>
                      <p className="text-xs text-gray-500">{activity.time}</p>
                    </div>
                    {activity.score && (
                      <div className="text-right">
                        <span className="font-bold text-green-600">{activity.score}%</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Top Performers */}
            <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
              <h2 className="text-xl font-bold text-gray-800 mb-4">Top Performers</h2>
              <div className="space-y-3">
                {[
                  { name: 'Alice Johnson', score: 95, xp: 1250 },
                  { name: 'Bob Smith', score: 92, xp: 1180 },
                  { name: 'Carol Davis', score: 89, xp: 1095 }
                ].map((student, index) => (
                  <div key={index} className="flex items-center space-x-3 p-3 bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg border border-yellow-100">
                    <div className="w-8 h-8 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-800">{student.name}</p>
                      <p className="text-sm text-gray-600">{student.xp} XP • {student.score}% avg</p>
                    </div>
                    <Award className="text-yellow-600" size={20} />
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Documents */}
            <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
              <h2 className="text-xl font-bold text-gray-800 mb-4">Recent Documents</h2>
              <div className="space-y-3">
                {[
                  { title: 'Algebra Fundamentals', subject: 'Mathematics', views: 18 },
                  { title: 'Photosynthesis Guide', subject: 'Biology', views: 15 },
                  { title: 'World War II Timeline', subject: 'History', views: 12 }
                ].map((doc, index) => (
                  <div key={index} className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                    <h3 className="font-medium text-gray-800 mb-1">{doc.title}</h3>
                    <div className="flex items-center justify-between text-sm text-gray-600">
                      <span>{doc.subject}</span>
                      <span className="flex items-center">
                        <BookOpen size={14} className="mr-1" />
                        {doc.views} views
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Stats */}
            <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
              <h2 className="text-xl font-bold text-gray-800 mb-4">This Week</h2>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Quizzes Taken</span>
                  <span className="font-bold text-gray-800">47</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Documents Viewed</span>
                  <span className="font-bold text-gray-800">156</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Papers Graded</span>
                  <span className="font-bold text-gray-800">32</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Active Students</span>
                  <span className="font-bold text-gray-800">22/24</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Avg Study Time</span>
                  <span className="font-bold text-gray-800">2.4h</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default TeacherDashboard;