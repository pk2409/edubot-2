# EduBot AI - Gamified Educational Platform

A modern, gamified educational platform built with React, Supabase, and IBM Watsonx AI. Features role-based learning for students and teachers with AI-powered chatbot, document management, quiz creation, and progress tracking.

## 🚀 Features

### 🔐 Authentication & Roles
- Secure email/password authentication via Supabase
- Role-based access (Student/Teacher)
- Protected routes and personalized dashboards

### 🤖 AI-Powered Learning
- **Chatbot**: IBM Watsonx-powered AI assistant with RAG (Retrieval-Augmented Generation)
- **Document Processing**: Upload PDFs/documents for AI context
- **Smart Responses**: AI answers based on uploaded course materials

### 📚 Document Management
- **Teacher Hub**: Upload, organize, and tag documents by subject
- **Student Access**: Browse and view assigned learning materials
- **RAG Integration**: Documents used as context for AI responses

### 🧠 Quiz System
- **Manual Creation**: Teachers create custom quizzes
- **AI Generation**: Auto-generate quizzes from uploaded documents
- **Interactive Taking**: Students take quizzes with real-time feedback
- **Score Tracking**: Performance analytics and progress monitoring

### 🎮 Gamification
- **XP System**: Earn points for activities (+10 quiz, +2 chat, +20 for 90%+)
- **Badges**: Achievement system with various milestones
- **Progress Tracking**: Visual progress meters and level system
- **Leaderboards**: Top performer recognition

### 📊 Analytics & Insights
- **Student Dashboard**: Personal progress, XP, badges, recent activity
- **Teacher Dashboard**: Class performance, student analytics, document stats
- **AI Profile Summary**: NLP-generated learning insights

## 🛠 Tech Stack

- **Frontend**: React 18, Vite, TailwindCSS
- **Backend**: Supabase (Auth, Database, Storage)
- **AI**: IBM Watsonx API
- **Charts**: Recharts
- **Icons**: Lucide React
- **Routing**: React Router DOM

## 📁 Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── Layout.jsx      # Main app layout with sidebar
│   ├── ProtectedRoute.jsx
│   ├── Badge.jsx       # Gamification badges
│   ├── XPMeter.jsx     # Progress visualization
│   └── LoadingSpinner.jsx
├── contexts/           # React contexts
│   └── AuthContext.jsx # Authentication state
├── pages/              # Main application pages
│   ├── Login.jsx       # Authentication
│   ├── StudentDashboard.jsx
│   ├── TeacherDashboard.jsx
│   ├── ChatBot.jsx     # AI chat interface
│   ├── DocumentHub.jsx # Document management
│   ├── QuizCenter.jsx  # Quiz creation/taking
│   ├── Profile.jsx     # User profiles
│   └── TestScreen.jsx  # Development testing
├── services/           # External service integrations
│   ├── supabase.js     # Database operations
│   └── watsonx.js      # AI service integration
└── App.jsx            # Main app component
```

## 🗄 Database Schema

### Users Table
```sql
users (
  id uuid PRIMARY KEY,
  name text,
  email text UNIQUE,
  role text, -- 'student' or 'teacher'
  xp_points integer DEFAULT 0,
  badges text[]
)
```

### Documents Table
```sql
documents (
  id uuid PRIMARY KEY,
  uploaded_by uuid REFERENCES users(id),
  title text,
  subject text,
  file_url text,
  vector vector[] -- For RAG embeddings
)
```

### Quizzes Table
```sql
quizzes (
  id uuid PRIMARY KEY,
  created_by uuid REFERENCES users(id),
  title text,
  document_id uuid REFERENCES documents(id),
  questions json -- [{ question, options[], correct_answer }]
)
```

### Quiz Attempts Table
```sql
quiz_attempts (
  id uuid PRIMARY KEY,
  quiz_id uuid REFERENCES quizzes(id),
  user_id uuid REFERENCES users(id),
  score float,
  answers json,
  timestamp timestamptz
)
```

### Chats Table
```sql
chats (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES users(id),
  question text,
  answer text,
  document_id uuid REFERENCES documents(id),
  timestamp timestamptz
)
```

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- Supabase account
- IBM Watsonx account

### Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd edubot-ai-platform
```

2. **Install dependencies**
```bash
npm install
```

3. **Environment Setup**
```bash
cp .env.example .env
```

4. **Configure Environment Variables**
```env
# Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# IBM Watsonx
VITE_WATSONX_TOKEN=your-watsonx-token
VITE_WATSONX_PROJECT_ID=your-project-id
```

5. **Database Setup**
- Create tables in Supabase using the provided schema
- Enable Row Level Security (RLS)
- Set up storage bucket for documents

6. **Start Development Server**
```bash
npm run dev
```

## 🎯 Usage

### For Students
1. **Sign up** with student role
2. **Chat with AI** - Ask questions about course materials
3. **Take Quizzes** - Test knowledge and earn XP
4. **Track Progress** - View badges, XP, and achievements
5. **Study Materials** - Access teacher-uploaded documents

### For Teachers
1. **Sign up** with teacher role
2. **Upload Documents** - Add course materials for AI context
3. **Create Quizzes** - Manual creation or AI-generated from documents
4. **Monitor Students** - View class performance and analytics
5. **Manage Content** - Organize documents and assessments

### Testing
- Visit `/test` for quick role-based login
- Mock data available for development
- Sample quizzes and documents included

## 🎨 Design System

### Color Palette
- **Primary**: Purple (#8B5CF6) to Pink (#EC4899)
- **Secondary**: Blue (#3B82F6) to Teal (#14B8A6)
- **Accent**: Orange (#F97316), Green (#10B981)
- **Neutrals**: Gray scale for text and backgrounds

### Components
- **Cards**: Rounded corners, subtle shadows, hover effects
- **Buttons**: Gradient backgrounds, transform animations
- **Forms**: Clean inputs with focus states
- **Navigation**: Sidebar layout with role-based menu items

## 🔧 Configuration

### Supabase Setup
1. Create new project
2. Run database migrations
3. Configure RLS policies
4. Set up storage for documents
5. Enable authentication

### Watsonx Integration
1. Create IBM Cloud account
2. Set up Watsonx project
3. Get API credentials
4. Configure model parameters

## 📈 Gamification System

### XP Points
- **Quiz Completion**: +10 XP
- **Chat Question**: +2 XP
- **High Score (90%+)**: +20 XP bonus
- **Perfect Score**: +30 XP

### Badge System
- **First Hundred**: 100+ XP earned
- **Quiz Champion**: 90%+ average score
- **Chat Explorer**: 50+ questions asked
- **Streak Master**: 7-day login streak

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Supabase** for backend infrastructure
- **IBM Watsonx** for AI capabilities
- **TailwindCSS** for styling system
- **Lucide** for beautiful icons
- **Recharts** for data visualization

---

Built with ❤️ for modern education