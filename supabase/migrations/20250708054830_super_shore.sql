/*
  # Complete EduBot AI Grading System

  1. Enhanced Tables
    - Updated `student_submissions` with new fields
    - Enhanced `ocr_jobs` for better tracking
    - Improved `grading_sessions` with batch processing

  2. Storage Setup
    - Create submissions bucket for PDF storage
    - Set up proper RLS policies

  3. Indexes and Performance
    - Add indexes for efficient querying
    - Optimize for bulk operations
*/

-- Enhanced student_submissions table
DO $$
BEGIN
  -- Add new columns if they don't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'student_submissions' AND column_name = 'submission_number') THEN
    ALTER TABLE student_submissions ADD COLUMN submission_number integer;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'student_submissions' AND column_name = 'raw_text') THEN
    ALTER TABLE student_submissions ADD COLUMN raw_text text;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'student_submissions' AND column_name = 'ai_confidence') THEN
    ALTER TABLE student_submissions ADD COLUMN ai_confidence float;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'student_submissions' AND column_name = 'manual_override') THEN
    ALTER TABLE student_submissions ADD COLUMN manual_override boolean DEFAULT false;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'student_submissions' AND column_name = 'file_size') THEN
    ALTER TABLE student_submissions ADD COLUMN file_size bigint;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'student_submissions' AND column_name = 'file_type') THEN
    ALTER TABLE student_submissions ADD COLUMN file_type text;
  END IF;
END $$;

-- Enhanced ocr_jobs table
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ocr_jobs' AND column_name = 'pages_processed') THEN
    ALTER TABLE ocr_jobs ADD COLUMN pages_processed integer DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ocr_jobs' AND column_name = 'total_pages') THEN
    ALTER TABLE ocr_jobs ADD COLUMN total_pages integer DEFAULT 1;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ocr_jobs' AND column_name = 'retry_count') THEN
    ALTER TABLE ocr_jobs ADD COLUMN retry_count integer DEFAULT 0;
  END IF;
END $$;

-- Enhanced grading_sessions table
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'grading_sessions' AND column_name = 'batch_upload_id') THEN
    ALTER TABLE grading_sessions ADD COLUMN batch_upload_id uuid;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'grading_sessions' AND column_name = 'auto_grade_enabled') THEN
    ALTER TABLE grading_sessions ADD COLUMN auto_grade_enabled boolean DEFAULT true;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'grading_sessions' AND column_name = 'ocr_completed') THEN
    ALTER TABLE grading_sessions ADD COLUMN ocr_completed integer DEFAULT 0;
  END IF;
END $$;

-- Create storage bucket for submissions (if not exists)
INSERT INTO storage.buckets (id, name, public)
VALUES ('submissions', 'submissions', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for submissions bucket
DO $$
BEGIN
  -- Policy for teachers to upload files
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Teachers can upload submission files'
  ) THEN
    CREATE POLICY "Teachers can upload submission files"
      ON storage.objects
      FOR INSERT
      TO authenticated
      WITH CHECK (
        bucket_id = 'submissions' AND
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'teacher')
      );
  END IF;

  -- Policy for teachers to read their uploaded files
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Teachers can read submission files'
  ) THEN
    CREATE POLICY "Teachers can read submission files"
      ON storage.objects
      FOR SELECT
      TO authenticated
      USING (
        bucket_id = 'submissions' AND
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'teacher')
      );
  END IF;

  -- Policy for teachers to delete their files
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Teachers can delete submission files'
  ) THEN
    CREATE POLICY "Teachers can delete submission files"
      ON storage.objects
      FOR DELETE
      TO authenticated
      USING (
        bucket_id = 'submissions' AND
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'teacher')
      );
  END IF;
END $$;

-- Additional indexes for performance
CREATE INDEX IF NOT EXISTS idx_student_submissions_submission_number ON student_submissions(session_id, submission_number);
CREATE INDEX IF NOT EXISTS idx_student_submissions_processing_status ON student_submissions(processing_status, created_at);
CREATE INDEX IF NOT EXISTS idx_ocr_jobs_status_created ON ocr_jobs(status, created_at);
CREATE INDEX IF NOT EXISTS idx_grading_sessions_batch_upload ON grading_sessions(batch_upload_id);

-- Function to auto-increment submission numbers
CREATE OR REPLACE FUNCTION set_submission_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.submission_number IS NULL THEN
    SELECT COALESCE(MAX(submission_number), 0) + 1
    INTO NEW.submission_number
    FROM student_submissions
    WHERE session_id = NEW.session_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-set submission numbers
DROP TRIGGER IF EXISTS trigger_set_submission_number ON student_submissions;
CREATE TRIGGER trigger_set_submission_number
  BEFORE INSERT ON student_submissions
  FOR EACH ROW
  EXECUTE FUNCTION set_submission_number();