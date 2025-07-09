import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Layout from '../components/Layout';
import XPMeter from '../components/XPMeter';
import Badge from '../components/Badge';
import { DatabaseService } from '../services/supabase';
import { 
  Brain, 
  MessageCircle, 
  Trophy, 
  BookOpen, 
  TrendingUp,
  Star,
  Clock,
  Target
} from 'lucide-react';

const StudentDashboard = () => {
  const { profile, user } = useAuth();
  const [recentActivity, setRecentActivity] = useState([]);
  const [upcomingQuizzes, setUpcomingQuizzes] = useState([]);
  const [stats, setStats] = useState({
    quizzesCompleted: 0,
    avgScore: 0,
    chatMessages: 0,
    streak: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user && profile) {
      loadDashboardData();
    }
  }, [user, profile]);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadQuizAttempts(),
        loadChatHistory(),
        loadUpcomingQuizzes(),
        loadRecentActivity()
      ]);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadQuizAttempts = async () => {
    try {
      const { data: attempts } = await DatabaseService.getQuizAttempts(null, user.id);
      
      if (attempts && attempts.length > 0) {
        const totalAttempts = attempts.length;
        const totalScore = attempts.reduce((sum, attempt) => sum + attempt.score, 0);
        const avgScore = Math.round(totalScore / totalAttempts);
        
        setStats(prev => ({
          ...prev,
          quizzesCompleted: totalAttempts,
          avgScore: avgScore
        }));
      }
    } catch (error) {
      console.error('Error loading quiz attempts:', error);
    }
  };

  const loadChatHistory = async () => {
    try {
      const { data: chats } = await DatabaseService.getChatHistory(user.id);
      
      if (chats && chats.length > 0) {
        setStats(prev => ({
          ...prev,
          chatMessages: chats.length
        }));
      }
    } catch (error) {
      console.error('Error loading chat history:', error);
    }
  };

  const loadUpcomingQuizzes = async () => {
    try {
      const { data: quizzes } = await DatabaseService.getQuizzes();
      
      if (quizzes) {
        // Get user's completed quiz IDs
        const { data: attempts } = await DatabaseService.getQuizAttempts(null, user.id);
        const completedQuizIds = attempts ? attempts.map(attempt => attempt.quiz_id) : [];
        
        // Filter out completed quizzes
        const upcomingQuizzes = quizzes
          .filter(quiz => !completedQuizIds.includes(quiz.id))
          .slice(0, 3); // Show only first 3
        
        setUpcomingQuizzes(upcomingQuizzes.map(quiz => ({
          id: quiz.id,
          title: quiz.title,
          dueDate: new Date(Date.now() + Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(), // Random future date
          questions: quiz.questions?.length || 0
        })));
      }
    } catch (error) {
      console.error('Error loading upcoming quizzes:', error);
    }
  };

  const loadRecentActivity = async () => {
    try {
      const activities = [];
      
      // Load recent quiz attempts
      const { data: attempts } = await DatabaseService.getQuizAttempts(null, user.id);
      if (attempts) {
        const recentAttempts = attempts
          .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
          .slice(0, 3);
        
        recentAttempts.forEach(attempt => {
          activities.push({
            id: `quiz-${attempt.id}`,
            type: 'quiz',
            title: `Completed ${attempt.quiz?.title || 'Quiz'}`,
            score: Math.round(attempt.score),
            time: getTimeAgo(attempt.timestamp)
          });
        });
      }
      
      // Load recent chats
      const { data: chats } = await DatabaseService.getChatHistory(user.id);
      if (chats) {
        const recentChats = chats
          .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
          .slice(0, 2);
        
        recentChats.forEach(chat => {
          activities.push({
            id: `chat-${chat.id}`,
            type: 'chat',
            title: `Asked: ${chat.question.substring(0, 50)}${chat.question.length > 50 ? '...' : ''}`,
            time: getTimeAgo(chat.timestamp)
          });
        });
      }
      
      // Add badge activities if user has badges
      if (profile?.badges && profile.badges.length > 0) {
        activities.push({
          id: 'badge-recent',
          type: 'badge',
          title: `Earned "${profile.badges[profile.badges.length - 1].replace('-', ' ')}" badge`,
          time: 'Recently'
        });
      }
      
      // Sort all activities by time and take the most recent
      const sortedActivities = activities
        .sort((a, b) => {
          // Simple sorting - recent items first
          if (a.time.includes('hour') && b.time.includes('day')) return -1;
          if (a.time.includes('day') && b.time.includes('hour')) return 1;
          return 0;
        })
        .slice(0, 5);
      
      setRecentActivity(sortedActivities);
      
      // Calculate streak (simplified - based on recent activity)
      const recentDays = activities.filter(activity => 
        activity.time.includes('hour') || activity.time.includes('1 day')
      ).length;
      
      setStats(prev => ({
        ...prev,
        streak: Math.min(recentDays, 7) // Cap at 7 days
      }));
      
    } catch (error) {
      console.error('Error loading recent activity:', error);
    }
  };

  const getTimeAgo = (timestamp) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffInHours = Math.floor((now - time) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
    
    return time.toLocaleDateString();
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const getLevelInfo = () => {
    const level = Math.floor(profile?.xp_points / 100) + 1;
    const xpInLevel = profile?.xp_points % 100;
    const xpNeeded = 100 - xpInLevel;
    return { level, xpNeeded };
  };

  const { level, xpNeeded } = getLevelInfo();

  if (loading) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">Loading your dashboard...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Welcome Header */}
        <div className="bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 rounded-2xl p-8 text-white shadow-xl">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">
                {getGreeting()}, {profile?.name}! 👋
              </h1>
              <p className="text-purple-100 text-lg">
                Ready to continue your learning journey?
              </p>
            </div>
            <div className="text-right">
              <div className="text-4xl font-bold mb-1">{profile?.xp_points}</div>
              <div className="text-purple-100">XP Points</div>
              <div className="text-sm text-purple-200">Level {level}</div>
            </div>
          </div>
          
          <div className="mt-6">
            <XPMeter currentXP={profile?.xp_points % 100} maxXP={100} showLabel={false} />
            <p className="text-purple-100 text-sm mt-2">
              {xpNeeded} XP needed for Level {level + 1}
            </p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">Quizzes Completed</p>
                <p className="text-2xl font-bold text-gray-800">{stats.quizzesCompleted}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Brain className="text-blue-600" size={24} />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">Average Score</p>
                <p className="text-2xl font-bold text-gray-800">{stats.avgScore}%</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <Target className="text-green-600" size={24} />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">Chat Messages</p>
                <p className="text-2xl font-bold text-gray-800">{stats.chatMessages}</p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <MessageCircle className="text-purple-600" size={24} />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">Activity Streak</p>
                <p className="text-2xl font-bold text-gray-800">{stats.streak}</p>
              </div>
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="text-orange-600" size={24} />
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Quick Actions */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
              <h2 className="text-xl font-bold text-gray-800 mb-4">Quick Actions</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Link
                  to="/chat"
                  className="flex items-center space-x-4 p-4 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg hover:from-blue-600 hover:to-purple-600 transform hover:scale-105 transition-all duration-200 shadow-lg"
                >
                  <MessageCircle size={24} />
                  <div>
                    <h3 className="font-bold">AI Chat</h3>
                    <p className="text-sm opacity-90">Ask questions & learn</p>
                  </div>
                </Link>

                <Link
                  to="/quizzes"
                  className="flex items-center space-x-4 p-4 bg-gradient-to-r from-green-500 to-teal-500 text-white rounded-lg hover:from-green-600 hover:to-teal-600 transform hover:scale-105 transition-all duration-200 shadow-lg"
                >
                  <Brain size={24} />
                  <div>
                    <h3 className="font-bold">Take Quiz</h3>
                    <p className="text-sm opacity-90">Test your knowledge</p>
                  </div>
                </Link>

                <Link
                  to="/profile"
                  className="flex items-center space-x-4 p-4 bg-gradient-to-r from-pink-500 to-orange-500 text-white rounded-lg hover:from-pink-600 hover:to-orange-600 transform hover:scale-105 transition-all duration-200 shadow-lg"
                >
                  <Trophy size={24} />
                  <div>
                    <h3 className="font-bold">View Profile</h3>
                    <p className="text-sm opacity-90">Check achievements</p>
                  </div>
                </Link>

                <div className="flex items-center space-x-4 p-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg opacity-75">
                  <BookOpen size={24} />
                  <div>
                    <h3 className="font-bold">Study Materials</h3>
                    <p className="text-sm opacity-90">Coming soon!</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
              <h2 className="text-xl font-bold text-gray-800 mb-4">Recent Activity</h2>
              {recentActivity.length > 0 ? (
                <div className="space-y-3">
                  {recentActivity.map((activity) => (
                    <div key={activity.id} className="flex items-center space-x-4 p-3 bg-gray-50 rounded-lg">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        {activity.type === 'quiz' && <Brain className="text-blue-600" size={20} />}
                        {activity.type === 'chat' && <MessageCircle className="text-purple-600" size={20} />}
                        {activity.type === 'badge' && <Trophy className="text-yellow-600" size={20} />}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-800">{activity.title}</p>
                        <p className="text-sm text-gray-600">{activity.time}</p>
                      </div>
                      {activity.score && (
                        <div className="text-right">
                          <span className="font-bold text-green-600">{activity.score}%</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Clock className="mx-auto text-gray-300 mb-2" size={48} />
                  <p className="text-gray-500">No recent activity</p>
                  <p className="text-sm text-gray-400">Start taking quizzes or chatting to see your activity here!</p>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Badges */}
            <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
              <h2 className="text-xl font-bold text-gray-800 mb-4">Your Badges</h2>
              {profile?.badges?.length > 0 ? (
                <div className="flex flex-wrap gap-3">
                  {profile.badges.map((badge, index) => (
                    <Badge key={index} badge={badge} size="lg" />
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Star className="mx-auto text-gray-300 mb-2" size={48} />
                  <p className="text-gray-500">No badges yet</p>
                  <p className="text-sm text-gray-400">Complete quizzes to earn your first badge!</p>
                </div>
              )}
            </div>

            {/* Upcoming Quizzes */}
            <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
              <h2 className="text-xl font-bold text-gray-800 mb-4">Available Quizzes</h2>
              <div className="space-y-3">
                {upcomingQuizzes.length > 0 ? (
                  upcomingQuizzes.map((quiz) => (
                    <div key={quiz.id} className="p-4 bg-blue-50 rounded-lg border border-blue-100">
                      <h3 className="font-medium text-gray-800 mb-1">{quiz.title}</h3>
                      <div className="flex items-center justify-between text-sm text-gray-600">
                        <span className="flex items-center">
                          <Clock size={14} className="mr-1" />
                          Available now
                        </span>
                        <span>{quiz.questions} questions</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8">
                    <Brain className="mx-auto text-gray-300 mb-2" size={48} />
                    <p className="text-gray-500">No available quizzes</p>
                    <p className="text-sm text-gray-400">Check back later for new quizzes!</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default StudentDashboard;