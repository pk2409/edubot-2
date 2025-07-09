/*
  # EduBot AI - Integrated Grading System

  1. New Tables for Grading System
    - `question_papers` - Store exam/assignment templates
    - `grading_sessions` - Track grading sessions
    - `student_submissions` - Store student submissions and grades
    - `grading_analytics` - Store analytics data
    - `ocr_jobs` - Track OCR processing jobs

  2. Enhanced Users Table
    - Add grading preferences and statistics

  3. Security
    - Enable RLS on all new tables
    - Add appropriate policies for teachers and students
*/

-- Question Papers/Exams
CREATE TABLE IF NOT EXISTS question_papers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL,
  subject text,
  class_section text,
  questions jsonb DEFAULT '[]', -- [{ question_number, question_text, max_marks, answer_key }]
  total_marks integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Grading Sessions
CREATE TABLE IF NOT EXISTS grading_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid REFERENCES users(id) ON DELETE CASCADE,
  question_paper_id uuid REFERENCES question_papers(id) ON DELETE CASCADE,
  session_name text NOT NULL,
  status text DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'exported')),
  total_submissions integer DEFAULT 0,
  graded_submissions integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

-- Student Submissions
CREATE TABLE IF NOT EXISTS student_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES grading_sessions(id) ON DELETE CASCADE,
  student_name text NOT NULL,
  roll_number text,
  class_section text,
  file_url text, -- Original uploaded file (base64 or URL)
  file_name text,
  ocr_text jsonb DEFAULT '{}', -- Extracted text with confidence scores
  ai_grades jsonb DEFAULT '{}', -- AI-generated grades and feedback
  final_grades jsonb DEFAULT '{}', -- Teacher-approved final grades
  total_marks integer DEFAULT 0,
  percentage float DEFAULT 0,
  grade text, -- A, B, C, D, F
  teacher_feedback text,
  is_reviewed boolean DEFAULT false,
  processing_status text DEFAULT 'uploaded' CHECK (processing_status IN ('uploaded', 'processing', 'ocr_completed', 'graded', 'reviewed')),
  created_at timestamptz DEFAULT now(),
  reviewed_at timestamptz
);

-- Grading Analytics
CREATE TABLE IF NOT EXISTS grading_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES grading_sessions(id) ON DELETE CASCADE,
  analytics_data jsonb DEFAULT '{}', -- Class statistics, grade distribution, etc.
  generated_at timestamptz DEFAULT now()
);

-- OCR Processing Jobs
CREATE TABLE IF NOT EXISTS ocr_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid REFERENCES student_submissions(id) ON DELETE CASCADE,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  ocr_provider text DEFAULT 'tesseract', -- 'tesseract', 'google_vision', 'easyocr'
  confidence_score float,
  processing_time integer, -- in seconds
  error_message text,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

-- Add new fields to existing users table
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'grading_preferences') THEN
    ALTER TABLE users ADD COLUMN grading_preferences jsonb DEFAULT '{}';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'total_papers_graded') THEN
    ALTER TABLE users ADD COLUMN total_papers_graded integer DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'time_saved_minutes') THEN
    ALTER TABLE users ADD COLUMN time_saved_minutes integer DEFAULT 0;
  END IF;
END $$;

-- Enable Row Level Security
ALTER TABLE question_papers ENABLE ROW LEVEL SECURITY;
ALTER TABLE grading_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE grading_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE ocr_jobs ENABLE ROW LEVEL SECURITY;

-- Question Papers policies
CREATE POLICY "Teachers can manage own question papers"
  ON question_papers
  FOR ALL
  TO authenticated
  USING (
    created_by = auth.uid() AND 
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'teacher')
  );

-- Grading Sessions policies
CREATE POLICY "Teachers can manage own grading sessions"
  ON grading_sessions
  FOR ALL
  TO authenticated
  USING (
    teacher_id = auth.uid() AND 
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'teacher')
  );

-- Student Submissions policies
CREATE POLICY "Teachers can manage submissions in their sessions"
  ON student_submissions
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM grading_sessions gs 
      WHERE gs.id = session_id 
      AND gs.teacher_id = auth.uid()
      AND EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'teacher')
    )
  );

-- Students can view their own graded submissions
CREATE POLICY "Students can view own submissions"
  ON student_submissions
  FOR SELECT
  TO authenticated
  USING (
    is_reviewed = true AND
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'student')
  );

-- Grading Analytics policies
CREATE POLICY "Teachers can view analytics for their sessions"
  ON grading_analytics
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM grading_sessions gs 
      WHERE gs.id = session_id 
      AND gs.teacher_id = auth.uid()
      AND EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'teacher')
    )
  );

-- OCR Jobs policies
CREATE POLICY "Teachers can manage OCR jobs for their submissions"
  ON ocr_jobs
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM student_submissions ss
      JOIN grading_sessions gs ON ss.session_id = gs.id
      WHERE ss.id = submission_id 
      AND gs.teacher_id = auth.uid()
      AND EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'teacher')
    )
  );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_question_papers_created_by ON question_papers(created_by);
CREATE INDEX IF NOT EXISTS idx_question_papers_subject ON question_papers(subject);
CREATE INDEX IF NOT EXISTS idx_grading_sessions_teacher_id ON grading_sessions(teacher_id);
CREATE INDEX IF NOT EXISTS idx_grading_sessions_status ON grading_sessions(status);
CREATE INDEX IF NOT EXISTS idx_student_submissions_session_id ON student_submissions(session_id);
CREATE INDEX IF NOT EXISTS idx_student_submissions_status ON student_submissions(processing_status);
CREATE INDEX IF NOT EXISTS idx_student_submissions_reviewed ON student_submissions(is_reviewed);
CREATE INDEX IF NOT EXISTS idx_grading_analytics_session_id ON grading_analytics(session_id);
CREATE INDEX IF NOT EXISTS idx_ocr_jobs_submission_id ON ocr_jobs(submission_id);
CREATE INDEX IF NOT EXISTS idx_ocr_jobs_status ON ocr_jobs(status);