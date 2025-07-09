import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import Layout from '../../components/Layout';
import AnalyticsService from '../../services/grading/analyticsService';
import ExportService from '../../services/grading/exportService';
import { 
  ArrowLeft,
  Users,
  TrendingUp,
  Award,
  AlertCircle,
  Download,
  BarChart3,
  PieChart,
  FileText,
  CheckCircle
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart as RechartsPieChart, Cell } from 'recharts';

const SessionAnalytics = () => {
  const { sessionId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [session, setSession] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSessionAnalytics();
  }, [sessionId]);

  const loadSessionAnalytics = async () => {
    setLoading(true);
    try {
      // Mock session data
      const mockSession = {
        id: sessionId,
        session_name: 'Mathematics Quiz - Chapter 5',
        status: 'completed',
        question_paper: {
          title: 'Algebra and Equations',
          subject: 'Mathematics',
          total_marks: 50,
          questions: [
            { question_number: 1, question_text: 'Solve for x: 2x + 5 = 15', max_marks: 10 },
            { question_number: 2, question_text: 'Find the area of a rectangle', max_marks: 15 },
            { question_number: 3, question_text: 'Simplify: 3(x + 4) - 2(x - 1)', max_marks: 25 }
          ]
        },
        created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        completed_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
      };

      // Mock submissions data
      const mockSubmissions = [
        { id: '1', student_name: 'Alice Johnson', percentage: 96, total_marks: 48, grade: 'A', is_reviewed: true },
        { id: '2', student_name: 'Bob Smith', percentage: 90, total_marks: 45, grade: 'A', is_reviewed: true },
        { id: '3', student_name: 'Carol Davis', percentage: 84, total_marks: 42, grade: 'B', is_reviewed: true },
        { id: '4', student_name: 'David Wilson', percentage: 78, total_marks: 39, grade: 'C', is_reviewed: true },
        { id: '5', student_name: 'Eva Brown', percentage: 72, total_marks: 36, grade: 'C', is_reviewed: true },
        { id: '6', student_name: 'Frank Miller', percentage: 88, total_marks: 44, grade: 'B', is_reviewed: true },
        { id: '7', student_name: 'Grace Lee', percentage: 94, total_marks: 47, grade: 'A', is_reviewed: true },
        { id: '8', student_name: 'Henry Taylor', percentage: 66, total_marks: 33, grade: 'D', is_reviewed: true },
        { id: '9', student_name: 'Ivy Chen', percentage: 92, total_marks: 46, grade: 'A', is_reviewed: true },
        { id: '10', student_name: 'Jack Anderson', percentage: 80, total_marks: 40, grade: 'B', is_reviewed: true }
      ];

      // Add mock final grades for analytics
      const submissionsWithGrades = mockSubmissions.map(sub => ({
        ...sub,
        final_grades: {
          grades: [
            { questionNumber: 1, marks: Math.round(sub.percentage * 0.1 * 0.1), maxMarks: 10 },
            { questionNumber: 2, marks: Math.round(sub.percentage * 0.15 * 0.1), maxMarks: 15 },
            { questionNumber: 3, marks: Math.round(sub.percentage * 0.25 * 0.1), maxMarks: 25 }
          ]
        },
        created_at: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000).toISOString(),
        reviewed_at: new Date(Date.now() - Math.random() * 12 * 60 * 60 * 1000).toISOString()
      }));

      setSession(mockSession);
      setSubmissions(submissionsWithGrades);
      
      // Calculate analytics
      const calculatedAnalytics = AnalyticsService.calculateSessionAnalytics(submissionsWithGrades);
      setAnalytics(calculatedAnalytics);
    } catch (error) {
      console.error('Error loading session analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = () => {
    if (session && submissions) {
      const csvContent = ExportService.generateCSVReport(submissions, session);
      ExportService.downloadCSV(csvContent, `${session.session_name}_results.csv`);
    }
  };

  const handleExportDetailed = () => {
    if (session && submissions && analytics) {
      const detailedReport = ExportService.generateDetailedReport(submissions, analytics, session);
      ExportService.downloadJSON(detailedReport, `${session.session_name}_detailed_report.json`);
    }
  };

  const gradeColors = {
    A: '#10B981', // green
    B: '#3B82F6', // blue
    C: '#F59E0B', // yellow
    D: '#EF4444', // red
    F: '#6B7280'  // gray
  };

  const gradeDistributionData = analytics ? Object.entries(analytics.gradeDistribution).map(([grade, count]) => ({
    grade,
    count,
    color: gradeColors[grade]
  })) : [];

  const performanceData = analytics ? [
    { category: 'Excellent (90%+)', count: analytics.performanceCategories.excellent, color: '#10B981' },
    { category: 'Good (80-89%)', count: analytics.performanceCategories.good, color: '#3B82F6' },
    { category: 'Satisfactory (70-79%)', count: analytics.performanceCategories.satisfactory, color: '#F59E0B' },
    { category: 'Needs Improvement (<70%)', count: analytics.performanceCategories.needsImprovement, color: '#EF4444' }
  ] : [];

  if (loading) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">Loading analytics...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (!session || !analytics) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto text-center py-12">
          <AlertCircle className="mx-auto text-red-500 mb-4" size={48} />
          <h2 className="text-xl font-bold text-gray-800 mb-2">Analytics Not Available</h2>
          <p className="text-gray-600 mb-6">Unable to load analytics for this session.</p>
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

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate('/grading')}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-gray-800">Session Analytics</h1>
              <p className="text-gray-600 mt-2">{session.session_name}</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={handleExportCSV}
              className="flex items-center space-x-2 bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition-colors"
            >
              <Download size={16} />
              <span>Export CSV</span>
            </button>
            <button
              onClick={handleExportDetailed}
              className="flex items-center space-x-2 bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors"
            >
              <FileText size={16} />
              <span>Detailed Report</span>
            </button>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">Total Submissions</p>
                <p className="text-2xl font-bold text-gray-800">{analytics.totalSubmissions}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Users className="text-blue-600" size={24} />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">Average Score</p>
                <p className="text-2xl font-bold text-gray-800">{analytics.averageScore.toFixed(1)}%</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="text-green-600" size={24} />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">Highest Score</p>
                <p className="text-2xl font-bold text-gray-800">{analytics.highestScore.toFixed(1)}%</p>
              </div>
              <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                <Award className="text-yellow-600" size={24} />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">Pass Rate</p>
                <p className="text-2xl font-bold text-gray-800">
                  {Math.round(((analytics.performanceCategories.excellent + analytics.performanceCategories.good + analytics.performanceCategories.satisfactory) / analytics.totalSubmissions) * 100)}%
                </p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <CheckCircle className="text-purple-600" size={24} />
              </div>
            </div>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Grade Distribution */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Grade Distribution</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={gradeDistributionData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="grade" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#8884d8">
                    {gradeDistributionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Performance Categories */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Performance Categories</h3>
            <div className="space-y-4">
              {performanceData.map((category, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div 
                      className="w-4 h-4 rounded"
                      style={{ backgroundColor: category.color }}
                    ></div>
                    <span className="text-sm text-gray-700">{category.category}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="font-semibold text-gray-800">{category.count}</span>
                    <span className="text-sm text-gray-500">
                      ({Math.round((category.count / analytics.totalSubmissions) * 100)}%)
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Question Analysis */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4">Question-wise Performance</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Question</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Max Marks</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Avg Marks</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Avg %</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Difficulty</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Attempted</th>
                </tr>
              </thead>
              <tbody>
                {analytics.questionAnalysis.map((question, index) => (
                  <tr key={index} className="border-b border-gray-100">
                    <td className="py-3 px-4">Question {question.questionNumber}</td>
                    <td className="py-3 px-4">{question.maxMarks}</td>
                    <td className="py-3 px-4">{question.averageMarks.toFixed(1)}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        question.averagePercentage >= 80 ? 'bg-green-100 text-green-800' :
                        question.averagePercentage >= 60 ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {question.averagePercentage.toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        question.difficulty === 'Easy' ? 'bg-green-100 text-green-800' :
                        question.difficulty === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                        question.difficulty === 'Hard' ? 'bg-orange-100 text-orange-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {question.difficulty}
                      </span>
                    </td>
                    <td className="py-3 px-4">{question.studentsAttempted}/{question.totalStudents}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Insights and Recommendations */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Insights */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Key Insights</h3>
            <div className="space-y-3">
              {analytics.insights.map((insight, index) => (
                <div key={index} className={`p-3 rounded-lg border-l-4 ${
                  insight.type === 'success' ? 'bg-green-50 border-green-400' :
                  insight.type === 'warning' ? 'bg-yellow-50 border-yellow-400' :
                  'bg-blue-50 border-blue-400'
                }`}>
                  <h4 className={`font-medium ${
                    insight.type === 'success' ? 'text-green-800' :
                    insight.type === 'warning' ? 'text-yellow-800' :
                    'text-blue-800'
                  }`}>
                    {insight.title}
                  </h4>
                  <p className={`text-sm ${
                    insight.type === 'success' ? 'text-green-700' :
                    insight.type === 'warning' ? 'text-yellow-700' :
                    'text-blue-700'
                  }`}>
                    {insight.message}
                  </p>
                </div>
              ))}
            
            </div>
          </div>

          {/* Grading Efficiency */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Grading Efficiency</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Average Grading Time</span>
                <span className="font-semibold text-gray-800">{analytics.timeAnalysis.averageGradingTime.toFixed(1)} min</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Total Grading Time</span>
                <span className="font-semibold text-gray-800">{Math.round(analytics.timeAnalysis.totalGradingTime)} min</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Efficiency Rating</span>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  analytics.timeAnalysis.efficiency === 'Excellent' ? 'bg-green-100 text-green-800' :
                  analytics.timeAnalysis.efficiency === 'Good' ? 'bg-blue-100 text-blue-800' :
                  analytics.timeAnalysis.efficiency === 'Fair' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {analytics.timeAnalysis.efficiency}
                </span>
              </div>
              <div className="pt-2 border-t border-gray-200">
                <p className="text-sm text-gray-600">
                  AI-assisted grading saved approximately {Math.round(analytics.timeAnalysis.totalGradingTime * 2)} minutes compared to traditional grading.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Student Results Table */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4">Student Results</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Student Name</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Roll Number</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Total Marks</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Percentage</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Grade</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Status</th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((submission, index) => (
                  <tr key={index} className="border-b border-gray-100">
                    <td className="py-3 px-4 font-medium text-gray-800">{submission.student_name}</td>
                    <td className="py-3 px-4 text-gray-600">{submission.roll_number}</td>
                    <td className="py-3 px-4">{submission.total_marks}/{session.question_paper.total_marks}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        submission.percentage >= 90 ? 'bg-green-100 text-green-800' :
                        submission.percentage >= 80 ? 'bg-blue-100 text-blue-800' :
                        submission.percentage >= 70 ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {submission.percentage.toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        submission.grade === 'A' ? 'bg-green-100 text-green-800' :
                        submission.grade === 'B' ? 'bg-blue-100 text-blue-800' :
                        submission.grade === 'C' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {submission.grade}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {submission.is_reviewed ? (
                        <CheckCircle className="text-green-500" size={16} />
                      ) : (
                        <AlertCircle className="text-yellow-500" size={16} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default SessionAnalytics;