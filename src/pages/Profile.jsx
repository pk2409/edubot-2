import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Layout from '../components/Layout';
import XPMeter from '../components/XPMeter';
import Badge from '../components/Badge';
import { DatabaseService } from '../services/supabase';
import { 
  User, 
  Trophy, 
  TrendingUp, 
  Clock, 
  Star,
  Brain,
  MessageCircle,
  Target,
  Calendar,
  Award
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const Profile = () => {
  const { profile, user } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [progressData, setProgressData] = useState([]);
  const [achievements, setAchievements] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalQuizzes: 0,
    totalChats: 0,
    avgScore: 0,
    badges: 0
  });

  useEffect(() => {
    if (user && profile) {
      loadProfileData();
    }
  }, [user, profile]);

  const loadProfileData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadQuizAttempts(),
        loadChatHistory(),
        loadProgressData(),
        loadAchievements()
      ]);
    } catch (error) {
      console.error('Error loading profile data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadQuizAttempts = async () => {
    try {
      const { data: attempts } = await DatabaseService.getQuizAttempts(null, user.id);
      
      if (attempts && attempts.length > 0) {
        const totalScore = attempts.reduce((sum, attempt) => sum + attempt.score, 0);
        const avgScore = Math.round(totalScore / attempts.length);
        
        setStats(prev => ({
          ...prev,
          totalQuizzes: attempts.length,
          avgScore: avgScore
        }));

        // Create recent activity from quiz attempts
        const quizActivity = attempts
          .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
          .slice(0, 3)
          .map(attempt => ({
            id: `quiz-${attempt.id}`,
            type: 'quiz',
            title: `Completed ${attempt.quiz?.title || 'Quiz'}`,
            score: Math.round(attempt.score),
            time: getTimeAgo(attempt.timestamp),
            xp: attempt.score >= 90 ? 30 : attempt.score >= 70 ? 20 : 10
          }));

        setRecentActivity(prev => [...prev, ...quizActivity]);
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
          totalChats: chats.length
        }));

        // Add recent chat activity
        const chatActivity = chats
          .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
          .slice(0, 2)
          .map(chat => ({
            id: `chat-${chat.id}`,
            type: 'chat',
            title: `Asked: ${chat.question.substring(0, 40)}${chat.question.length > 40 ? '...' : ''}`,
            time: getTimeAgo(chat.timestamp),
            xp: 2
          }));

        setRecentActivity(prev => [...prev, ...chatActivity]);
      }
    } catch (error) {
      console.error('Error loading chat history:', error);
    }
  };

  const loadProgressData = async () => {
    try {
      const { data: attempts } = await DatabaseService.getQuizAttempts(null, user.id);
      
      if (attempts && attempts.length > 0) {
        // Group attempts by day and calculate XP
        const dailyXP = {};
        const today = new Date();
        
        // Initialize last 7 days
        for (let i = 6; i >= 0; i--) {
          const date = new Date(today);
          date.setDate(date.getDate() - i);
          const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
          dailyXP[dayName] = 0;
        }
        
        attempts.forEach(attempt => {
          const attemptDate = new Date(attempt.timestamp);
          const dayName = attemptDate.toLocaleDateString('en-US', { weekday: 'short' });
          const xp = attempt.score >= 90 ? 30 : attempt.score >= 70 ? 20 : 10;
          
          if (dailyXP.hasOwnProperty(dayName)) {
            dailyXP[dayName] += xp;
          }
        });

        const chartData = Object.entries(dailyXP).map(([day, xp]) => ({
          day,
          xp
        }));

        setProgressData(chartData);
      } else {
        // Default empty data for last 7 days
        const today = new Date();
        const defaultData = [];
        
        for (let i = 6; i >= 0; i--) {
          const date = new Date(today);
          date.setDate(date.getDate() - i);
          const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
          defaultData.push({ day: dayName, xp: 0 });
        }
        
        setProgressData(defaultData);
      }
    } catch (error) {
      console.error('Error loading progress data:', error);
    }
  };

  const loadAchievements = async () => {
    try {
      const { data: attempts } = await DatabaseService.getQuizAttempts(null, user.id);
      const { data: chats } = await DatabaseService.getChatHistory(user.id);
      
      const totalQuizzes = attempts ? attempts.length : 0;
      const totalChats = chats ? chats.length : 0;
      const perfectScores = attempts ? attempts.filter(a => a.score >= 100).length : 0;
      const highScores = attempts ? attempts.filter(a => a.score >= 90).length : 0;
      
      const achievementsList = [
        {
          title: 'Quiz Master',
          description: 'Complete 10 quizzes',
          progress: Math.min(totalQuizzes, 10),
          total: 10,
          completed: totalQuizzes >= 10
        },
        {
          title: 'Chat Explorer',
          description: 'Ask 50 questions',
          progress: Math.min(totalChats, 50),
          total: 50,
          completed: totalChats >= 50
        },
        {
          title: 'Perfect Score',
          description: 'Score 100% on a quiz',
          progress: Math.min(perfectScores, 1),
          total: 1,
          completed: perfectScores >= 1
        },
        {
          title: 'High Achiever',
          description: 'Score 90%+ on 5 quizzes',
          progress: Math.min(highScores, 5),
          total: 5,
          completed: highScores >= 5
        }
      ];

      setAchievements(achievementsList);
      
      // Update badge count
      setStats(prev => ({
        ...prev,
        badges: profile?.badges?.length || 0
      }));

      // Add badge activity if user has badges
      if (profile?.badges && profile.badges.length > 0) {
        setRecentActivity(prev => [...prev, {
          id: 'badge-recent',
          type: 'badge',
          title: `Earned "${profile.badges[profile.badges.length - 1].replace('-', ' ')}" badge`,
          time: 'Recently',
          xp: 0
        }]);
      }

    } catch (error) {
      console.error('Error loading achievements:', error);
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

  const getLevelInfo = () => {
    const level = Math.floor(profile?.xp_points / 100) + 1;
    const xpInLevel = profile?.xp_points % 100;
    const xpNeeded = 100 - xpInLevel;
    return { level, xpNeeded };
  };

  const { level, xpNeeded } = getLevelInfo();

  const generateProfileSummary = () => {
    return {
      totalQuizzes: stats.totalQuizzes,
      totalChats: stats.totalChats,
      avgScore: stats.avgScore,
      badges: stats.badges
    };
  };

  const summary = generateProfileSummary();

  if (loading) {
    return (
      <Layout>
        <div className="max-w-6xl mx-auto flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">Loading your profile...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Profile Header */}
        <div className="bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 rounded-2xl p-8 text-white shadow-xl">
          <div className="flex items-center space-x-6">
            <div className="w-24 h-24 bg-white bg-opacity-20 rounded-full flex items-center justify-center backdrop-blur-sm">
              <span className="text-4xl font-bold text-white">
                {profile?.name?.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1">
              <h1 className="text-3xl font-bold mb-2">{profile?.name}</h1>
              <p className="text-purple-100 text-lg mb-4 capitalize">{profile?.role}</p>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold">{profile?.xp_points}</div>
                  <div className="text-purple-100 text-sm">Total XP</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">{level}</div>
                  <div className="text-purple-100 text-sm">Level</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">{summary.badges}</div>
                  <div className="text-purple-100 text-sm">Badges</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">{summary.avgScore}%</div>
                  <div className="text-purple-100 text-sm">Avg Score</div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="mt-6">
            <div className="flex justify-between items-center mb-2">
              <span className="text-purple-100">Progress to Level {level + 1}</span>
              <span className="text-purple-100">{xpNeeded} XP needed</span>
            </div>
            <XPMeter currentXP={profile?.xp_points % 100} maxXP={100} showLabel={false} />
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-100">
          <div className="border-b border-gray-100">
            <nav className="flex space-x-8 px-6">
              {[
                { id: 'overview', label: 'Overview', icon: User },
                { id: 'achievements', label: 'Achievements', icon: Trophy },
                { id: 'progress', label: 'Progress', icon: TrendingUp },
                { id: 'activity', label: 'Activity', icon: Clock }
              ].map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center space-x-2 py-4 border-b-2 transition-colors ${
                      activeTab === tab.id
                        ? 'border-purple-500 text-purple-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <Icon size={20} />
                    <span className="font-medium">{tab.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="p-6">
            {activeTab === 'overview' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-6">
                  {/* AI-Generated Profile Summary */}
                  <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-6 border border-blue-100">
                    <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
                      <Star className="mr-2 text-yellow-500" size={24} />
                      Your Learning Profile
                    </h3>
                    <div className="prose text-gray-700">
                      <p className="mb-4">
                        🎯 <strong>Learning Style:</strong> {summary.totalQuizzes > 0 ? 
                          `You're a consistent learner who enjoys interactive challenges! With ${summary.totalQuizzes} quizzes completed and an average score of ${summary.avgScore}%, you demonstrate strong analytical skills.` :
                          "You're just getting started on your learning journey! Take some quizzes to see your learning style emerge."
                        }
                      </p>
                      <p className="mb-4">
                        💬 <strong>Engagement:</strong> {summary.totalChats > 0 ?
                          `Your ${summary.totalChats} chat interactions show curiosity and active learning. You're not afraid to ask questions, which is key to deep understanding.` :
                          "Start chatting with the AI to explore topics and ask questions - this will help develop your understanding!"
                        }
                      </p>
                      <p>
                        🏆 <strong>Achievements:</strong> With {summary.badges} badges earned and {profile?.xp_points} XP, 
                        {profile?.xp_points > 100 ? " you're making excellent progress. Keep up the momentum!" : " you're building a strong foundation. Every step counts!"}
                      </p>
                    </div>
                  </div>

                  {/* Quick Stats */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white rounded-lg p-4 shadow-md border border-gray-100 text-center">
                      <Brain className="mx-auto text-blue-500 mb-2" size={24} />
                      <div className="text-2xl font-bold text-gray-800">{summary.totalQuizzes}</div>
                      <div className="text-sm text-gray-600">Quizzes Taken</div>
                    </div>
                    <div className="bg-white rounded-lg p-4 shadow-md border border-gray-100 text-center">
                      <MessageCircle className="mx-auto text-purple-500 mb-2" size={24} />
                      <div className="text-2xl font-bold text-gray-800">{summary.totalChats}</div>
                      <div className="text-sm text-gray-600">Questions Asked</div>
                    </div>
                    <div className="bg-white rounded-lg p-4 shadow-md border border-gray-100 text-center">
                      <Target className="mx-auto text-green-500 mb-2" size={24} />
                      <div className="text-2xl font-bold text-gray-800">{summary.avgScore}%</div>
                      <div className="text-sm text-gray-600">Average Score</div>
                    </div>
                    <div className="bg-white rounded-lg p-4 shadow-md border border-gray-100 text-center">
                      <Award className="mx-auto text-yellow-500 mb-2" size={24} />
                      <div className="text-2xl font-bold text-gray-800">{summary.badges}</div>
                      <div className="text-sm text-gray-600">Badges Earned</div>
                    </div>
                  </div>
                </div>

                {/* Badges Sidebar */}
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-bold text-gray-800 mb-4">Your Badges</h3>
                    {profile?.badges?.length > 0 ? (
                      <div className="grid grid-cols-2 gap-4">
                        {profile.badges.map((badge, index) => (
                          <div key={index} className="text-center">
                            <Badge badge={badge} size="lg" />
                            <p className="text-xs text-gray-600 mt-2 capitalize">
                              {badge.replace('-', ' ')}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <Trophy className="mx-auto text-gray-300 mb-2" size={48} />
                        <p className="text-gray-500">No badges yet</p>
                        <p className="text-sm text-gray-400">Complete activities to earn badges!</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'achievements' && (
              <div className="space-y-6">
                <h3 className="text-xl font-bold text-gray-800">Achievement Progress</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {achievements.map((achievement, index) => (
                    <div key={index} className={`p-6 rounded-xl border-2 ${
                      achievement.completed 
                        ? 'bg-green-50 border-green-200' 
                        : 'bg-gray-50 border-gray-200'
                    }`}>
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-bold text-gray-800">{achievement.title}</h4>
                        {achievement.completed && <Trophy className="text-yellow-500" size={24} />}
                      </div>
                      <p className="text-gray-600 mb-4">{achievement.description}</p>
                      
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Progress</span>
                          <span>{achievement.progress}/{achievement.total}</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full ${
                              achievement.completed ? 'bg-green-500' : 'bg-blue-500'
                            }`}
                            style={{ width: `${(achievement.progress / achievement.total) * 100}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'progress' && (
              <div className="space-y-6">
                <h3 className="text-xl font-bold text-gray-800">Weekly XP Progress</h3>
                <div className="bg-white p-6 rounded-lg border border-gray-200">
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={progressData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="day" />
                        <YAxis />
                        <Tooltip />
                        <Line 
                          type="monotone" 
                          dataKey="xp" 
                          stroke="#8b5cf6" 
                          strokeWidth={3}
                          dot={{ fill: '#8b5cf6', strokeWidth: 2, r: 6 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
                    <h4 className="font-bold text-blue-800 mb-2">This Week</h4>
                    <div className="text-2xl font-bold text-blue-600">
                      {progressData.reduce((sum, day) => sum + day.xp, 0)} XP
                    </div>
                    <div className="text-sm text-blue-600">Total earned</div>
                  </div>
                  <div className="bg-green-50 rounded-lg p-4 border border-green-100">
                    <h4 className="font-bold text-green-800 mb-2">Best Day</h4>
                    <div className="text-2xl font-bold text-green-600">
                      {Math.max(...progressData.map(d => d.xp))} XP
                    </div>
                    <div className="text-sm text-green-600">
                      {progressData.find(d => d.xp === Math.max(...progressData.map(d => d.xp)))?.day || 'N/A'}
                    </div>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-4 border border-purple-100">
                    <h4 className="font-bold text-purple-800 mb-2">Average</h4>
                    <div className="text-2xl font-bold text-purple-600">
                      {Math.round(progressData.reduce((sum, day) => sum + day.xp, 0) / progressData.length)} XP
                    </div>
                    <div className="text-sm text-purple-600">per day</div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'activity' && (
              <div className="space-y-6">
                <h3 className="text-xl font-bold text-gray-800">Recent Activity</h3>
                {recentActivity.length > 0 ? (
                  <div className="space-y-4">
                    {recentActivity
                      .sort((a, b) => {
                        // Sort by time - more recent first
                        if (a.time.includes('hour') && b.time.includes('day')) return -1;
                        if (a.time.includes('day') && b.time.includes('hour')) return 1;
                        return 0;
                      })
                      .map((activity, index) => (
                        <div key={activity.id} className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg border border-gray-100">
                          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                            {activity.type === 'quiz' && <Brain className="text-blue-600" size={20} />}
                            {activity.type === 'chat' && <MessageCircle className="text-purple-600" size={20} />}
                            {activity.type === 'badge' && <Trophy className="text-yellow-600" size={20} />}
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-gray-800">{activity.title}</p>
                            <div className="flex items-center space-x-4 text-sm text-gray-600">
                              <span className="flex items-center">
                                <Calendar size={14} className="mr-1" />
                                {activity.time}
                              </span>
                              {activity.xp > 0 && (
                                <span className="text-purple-600 font-medium">+{activity.xp} XP</span>
                              )}
                            </div>
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
                  <div className="text-center py-12">
                    <Clock className="mx-auto text-gray-300 mb-4" size={64} />
                    <h3 className="text-xl font-medium text-gray-600 mb-2">No activity yet</h3>
                    <p className="text-gray-500 mb-6">
                      Start taking quizzes or chatting with the AI to see your activity here!
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Profile;