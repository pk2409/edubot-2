/*
  # Create submissions storage bucket

  1. Storage Setup
    - Create 'submissions' bucket for student submission files
    - Configure public access for file retrieval
    - Set up RLS policies for secure access

  2. Security
    - Enable RLS on storage bucket
    - Add policies for teachers to manage submissions
    - Allow public read access for grading interface
*/

-- Create the submissions bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'submissions',
  'submissions',
  true,
  52428800, -- 50MB limit
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/jpg', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Policy: Allow teachers to upload submissions to their sessions
CREATE POLICY "Teachers can upload submissions"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'submissions' AND
  EXISTS (
    SELECT 1 FROM grading_sessions gs
    WHERE gs.id::text = split_part(name, '/', 1)
    AND gs.teacher_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role = 'teacher'
    )
  )
);

-- Policy: Allow teachers to read submissions from their sessions
CREATE POLICY "Teachers can read own session submissions"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'submissions' AND
  EXISTS (
    SELECT 1 FROM grading_sessions gs
    WHERE gs.id::text = split_part(name, '/', 1)
    AND gs.teacher_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role = 'teacher'
    )
  )
);

-- Policy: Allow public read access for grading interface
CREATE POLICY "Public read access for submissions"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'submissions');

-- Policy: Allow teachers to delete submissions from their sessions
CREATE POLICY "Teachers can delete own session submissions"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'submissions' AND
  EXISTS (
    SELECT 1 FROM grading_sessions gs
    WHERE gs.id::text = split_part(name, '/', 1)
    AND gs.teacher_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role = 'teacher'
    )
  )
);