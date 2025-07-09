/*
  # Initial EduBot AI Database Schema

  1. New Tables
    - `users`
      - `id` (uuid, primary key)
      - `email` (text, unique)
      - `name` (text)
      - `role` (text) - 'student' or 'teacher'
      - `xp_points` (integer, default 0)
      - `badges` (text array)
      - `created_at` (timestamp)
    - `documents`
      - `id` (uuid, primary key)
      - `uploaded_by` (uuid, foreign key to users)
      - `title` (text)
      - `subject` (text)
      - `file_url` (text)
      - `vector` (text array) - For RAG embeddings
      - `created_at` (timestamp)
    - `quizzes`
      - `id` (uuid, primary key)
      - `created_by` (uuid, foreign key to users)
      - `title` (text)
      - `document_id` (uuid, foreign key to documents)
      - `questions` (jsonb) - Array of question objects
      - `created_at` (timestamp)
    - `quiz_attempts`
      - `id` (uuid, primary key)
      - `quiz_id` (uuid, foreign key to quizzes)
      - `user_id` (uuid, foreign key to users)
      - `score` (float)
      - `answers` (jsonb)
      - `timestamp` (timestamp)
    - `chats`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to users)
      - `question` (text)
      - `answer` (text)
      - `document_id` (uuid, foreign key to documents, nullable)
      - `timestamp` (timestamp)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to manage their own data
    - Teachers can manage documents and quizzes
    - Students can view documents and take quizzes
*/

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  name text NOT NULL,
  role text NOT NULL CHECK (role IN ('student', 'teacher')),
  xp_points integer DEFAULT 0,
  badges text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Create documents table
CREATE TABLE IF NOT EXISTS documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  uploaded_by uuid REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL,
  subject text NOT NULL,
  file_url text NOT NULL,
  vector text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Create quizzes table
CREATE TABLE IF NOT EXISTS quizzes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL,
  document_id uuid REFERENCES documents(id) ON DELETE SET NULL,
  questions jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz DEFAULT now()
);

-- Create quiz_attempts table
CREATE TABLE IF NOT EXISTS quiz_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id uuid REFERENCES quizzes(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  score float NOT NULL,
  answers jsonb NOT NULL DEFAULT '{}',
  timestamp timestamptz DEFAULT now()
);

-- Create chats table
CREATE TABLE IF NOT EXISTS chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  question text NOT NULL,
  answer text NOT NULL,
  document_id uuid REFERENCES documents(id) ON DELETE SET NULL,
  timestamp timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY "Users can read own profile"
  ON users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Documents policies
CREATE POLICY "Teachers can manage own documents"
  ON documents
  FOR ALL
  TO authenticated
  USING (
    uploaded_by = auth.uid() AND 
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'teacher')
  );

CREATE POLICY "Students can view all documents"
  ON documents
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'student')
  );

CREATE POLICY "Teachers can view all documents"
  ON documents
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'teacher')
  );

-- Quizzes policies
CREATE POLICY "Teachers can manage own quizzes"
  ON quizzes
  FOR ALL
  TO authenticated
  USING (
    created_by = auth.uid() AND 
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'teacher')
  );

CREATE POLICY "Students can view all quizzes"
  ON quizzes
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'student')
  );

CREATE POLICY "Teachers can view all quizzes"
  ON quizzes
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'teacher')
  );

-- Quiz attempts policies
CREATE POLICY "Users can manage own quiz attempts"
  ON quiz_attempts
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Teachers can view all quiz attempts"
  ON quiz_attempts
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'teacher')
  );

-- Chats policies
CREATE POLICY "Users can manage own chats"
  ON chats
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Teachers can view all chats"
  ON chats
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'teacher')
  );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_documents_uploaded_by ON documents(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_documents_subject ON documents(subject);
CREATE INDEX IF NOT EXISTS idx_quizzes_created_by ON quizzes(created_by);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user_id ON quiz_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_quiz_id ON quiz_attempts(quiz_id);
CREATE INDEX IF NOT EXISTS idx_chats_user_id ON chats(user_id);