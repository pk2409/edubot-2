import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { TestTube, User, GraduationCap, Trash2, CheckCircle } from 'lucide-react';

const TestScreen = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(false);

  // Generate a proper UUID v4 format for mock users
  const generateMockUUID = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  };

  const mockLogin = async (role) => {
    setLoading(true);
    
    // Clear any existing auth
    localStorage.removeItem('mockUser');
    localStorage.removeItem('mockProfile');
    
    // Generate proper UUID for mock user
    const mockUserId = generateMockUUID();
    
    // Mock user data with proper UUID format
    const mockUser = {
      id: mockUserId,
      email: `${role}@test.com`,
      created_at: new Date().toISOString()
    };

    const mockProfile = {
      id: mockUserId,
      name: role === 'student' ? 'Alex Student' : 'Prof. Smith',
      email: mockUser.email,
      role: role,
      xp_points: role === 'student' ? 250 : 0,
      badges: role === 'student' ? ['first-hundred'] : [],
      created_at: new Date().toISOString()
    };

    // Store in localStorage for testing
    localStorage.setItem('mockUser', JSON.stringify(mockUser));
    localStorage.setItem('mockProfile', JSON.stringify(mockProfile));

    // Force a page reload to trigger AuthContext to pick up the mock data
    setTimeout(() => {
      window.location.reload();
    }, 500);
  };

  const clearTestData = () => {
    localStorage.removeItem('mockUser');
    localStorage.removeItem('mockProfile');
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-green-500 to-blue-500 rounded-2xl mb-4 shadow-xl">
            <TestTube className="text-white" size={32} />
          </div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Test Screen</h1>
          <p className="text-gray-600">Quick access for testing purposes</p>
        </div>

        {/* Current Status */}
        {user && profile && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <div className="flex items-center space-x-2 mb-2">
              <CheckCircle className="text-green-600" size={20} />
              <p className="text-green-800 font-medium">Currently logged in as:</p>
            </div>
            <p className="text-green-700 font-semibold">{profile.name}</p>
            <p className="text-green-600 text-sm capitalize">Role: {profile.role}</p>
            <p className="text-green-600 text-sm">XP: {profile.xp_points}</p>
            <p className="text-green-600 text-sm">Badges: {profile.badges?.length || 0}</p>
            <p className="text-green-600 text-xs">ID: {user.id}</p>
          </div>
        )}

        {/* Test Actions */}
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100 space-y-4">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Quick Login Options</h2>

          <button
            onClick={() => mockLogin('student')}
            disabled={loading}
            className="w-full flex items-center justify-center space-x-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white font-bold py-3 px-4 rounded-lg hover:from-blue-600 hover:to-purple-600 transform hover:scale-105 transition-all duration-200 shadow-lg disabled:opacity-50 disabled:transform-none"
          >
            <User size={20} />
            <span>Login as Student</span>
          </button>

          <button
            onClick={() => mockLogin('teacher')}
            disabled={loading}
            className="w-full flex items-center justify-center space-x-3 bg-gradient-to-r from-green-500 to-teal-500 text-white font-bold py-3 px-4 rounded-lg hover:from-green-600 hover:to-teal-600 transform hover:scale-105 transition-all duration-200 shadow-lg disabled:opacity-50 disabled:transform-none"
          >
            <GraduationCap size={20} />
            <span>Login as Teacher</span>
          </button>

          <button
            onClick={() => navigate('/login')}
            className="w-full bg-gray-100 text-gray-700 font-medium py-3 px-4 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Go to Real Login
          </button>

          <button
            onClick={clearTestData}
            className="w-full flex items-center justify-center space-x-2 bg-red-100 text-red-700 font-medium py-3 px-4 rounded-lg hover:bg-red-200 transition-colors"
          >
            <Trash2 size={16} />
            <span>Clear Test Data & Logout</span>
          </button>

          {loading && (
            <div className="text-center py-4">
              <div className="inline-block w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-gray-600 mt-2">Setting up test environment...</p>
            </div>
          )}
        </div>

        {/* Sample Data Info */}
        <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h3 className="font-medium text-yellow-800 mb-2">Test Data Includes:</h3>
          <ul className="text-yellow-700 text-sm space-y-1">
            <li>• Sample student with 250 XP and badges</li>
            <li>• Sample teacher profile</li>
            <li>• Mock quiz and document data</li>
            <li>• Chat history examples</li>
            <li>• Proper UUID format for database compatibility</li>
          </ul>
        </div>

        {/* Database Status */}
        <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-medium text-blue-800 mb-2">For Real Login:</h3>
          <ul className="text-blue-700 text-sm space-y-1">
            <li>• Click "Connect to Supabase" button (top right)</li>
            <li>• Database tables will be created automatically</li>
            <li>• Then you can create real accounts</li>
          </ul>
        </div>

        {/* Network Status */}
        <div className="mt-4 bg-purple-50 border border-purple-200 rounded-lg p-4">
          <h3 className="font-medium text-purple-800 mb-2">AI Chat Features:</h3>
          <ul className="text-purple-700 text-sm space-y-1">
            <li>• Powered by IBM Watsonx AI</li>
            <li>• Works with mock data for testing</li>
            <li>• RAG search through documents</li>
            <li>• Educational response formatting</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default TestScreen;