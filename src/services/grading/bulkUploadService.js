// Bulk Upload Service for handling multiple PDF submissions
import { supabase } from '../supabase';

class BulkUploadService {
  constructor() {
    this.maxFileSize = 50 * 1024 * 1024; // 50MB limit for Supabase free tier
    this.allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
  }

  // Validate files before upload
  validateFiles(files) {
    const errors = [];
    const validFiles = [];

    files.forEach((file, index) => {
      // Check file type
      if (!this.allowedTypes.includes(file.type)) {
        errors.push(`File ${index + 1} (${file.name}): Invalid file type. Only PDF and images are allowed.`);
        return;
      }

      // Check file size
      if (file.size > this.maxFileSize) {
        errors.push(`File ${index + 1} (${file.name}): File too large. Maximum size is 50MB.`);
        return;
      }

      // Check file name
      if (!file.name || file.name.trim() === '') {
        errors.push(`File ${index + 1}: Invalid file name.`);
        return;
      }

      validFiles.push(file);
    });

    return { validFiles, errors };
  }

  // Extract student info from filename
  extractStudentInfo(filename, index) {
    // Try to extract student name and roll number from filename
    // Patterns: "StudentName_RollNumber.pdf", "RollNumber_StudentName.pdf", etc.
    const nameWithoutExt = filename.replace(/\.[^/.]+$/, "");
    const parts = nameWithoutExt.split(/[-_\s]+/);
    
    let studentName = '';
    let rollNumber = '';

    if (parts.length >= 2) {
      // Check if first part is numeric (roll number)
      if (/^\d+$/.test(parts[0])) {
        rollNumber = parts[0];
        studentName = parts.slice(1).join(' ');
      } else {
        studentName = parts[0];
        // Look for numeric part as roll number
        const numericPart = parts.find(part => /^\d+$/.test(part));
        rollNumber = numericPart || '';
      }
    } else {
      studentName = nameWithoutExt;
    }

    // Fallback if extraction fails
    if (!studentName) {
      studentName = `Student ${index + 1}`;
    }
    if (!rollNumber) {
      rollNumber = `${(index + 1).toString().padStart(3, '0')}`;
    }

    return {
      studentName: studentName.trim(),
      rollNumber: rollNumber.trim()
    };
  }

  // Upload files to Supabase Storage
  async uploadFiles(files, sessionId, onProgress) {
    const uploadResults = [];
    const batchId = crypto.randomUUID();

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const { studentName, rollNumber } = this.extractStudentInfo(file.name, i);
      
      try {
        // Generate unique filename
        const timestamp = Date.now();
        const fileExtension = file.name.split('.').pop();
        const uniqueFilename = `${sessionId}/${batchId}/${timestamp}_${i}_${file.name}`;

        // Upload to Supabase Storage
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('submissions')
          .upload(uniqueFilename, file, {
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) {
          throw uploadError;
        }

        // Get public URL
        const { data: urlData } = supabase.storage
          .from('submissions')
          .getPublicUrl(uniqueFilename);

        // Create submission record
        const { data: submissionData, error: submissionError } = await supabase
          .from('student_submissions')
          .insert({
            session_id: sessionId,
            student_name: studentName,
            roll_number: rollNumber,
            file_url: urlData.publicUrl,
            file_name: file.name,
            file_size: file.size,
            file_type: file.type,
            processing_status: 'uploaded'
          })
          .select()
          .single();

        if (submissionError) {
          throw submissionError;
        }

        // Create OCR job
        const { error: ocrError } = await supabase
          .from('ocr_jobs')
          .insert({
            submission_id: submissionData.id,
            status: 'pending',
            ocr_provider: 'tesseract'
          });

        if (ocrError) {
          console.error('Failed to create OCR job:', ocrError);
        }

        uploadResults.push({
          success: true,
          file: file.name,
          submissionId: submissionData.id,
          studentName,
          rollNumber
        });

        // Report progress
        if (onProgress) {
          onProgress({
            completed: i + 1,
            total: files.length,
            currentFile: file.name,
            percentage: Math.round(((i + 1) / files.length) * 100)
          });
        }

      } catch (error) {
        console.error(`Failed to upload ${file.name}:`, error);
        uploadResults.push({
          success: false,
          file: file.name,
          error: error.message
        });
      }
    }

    // Update session with batch info
    await supabase
      .from('grading_sessions')
      .update({
        batch_upload_id: batchId,
        total_submissions: uploadResults.filter(r => r.success).length
      })
      .eq('id', sessionId);

    return {
      batchId,
      results: uploadResults,
      successful: uploadResults.filter(r => r.success).length,
      failed: uploadResults.filter(r => !r.success).length
    };
  }

  // Get upload progress for a session
  async getUploadProgress(sessionId) {
    const { data: submissions, error } = await supabase
      .from('student_submissions')
      .select(`
        id,
        student_name,
        processing_status,
        created_at,
        ocr_jobs(status, error_message)
      `)
      .eq('session_id', sessionId)
      .order('submission_number');

    if (error) {
      throw error;
    }

    const statusCounts = {
      uploaded: 0,
      processing: 0,
      ocr_completed: 0,
      graded: 0,
      reviewed: 0,
      failed: 0
    };

    submissions.forEach(sub => {
      statusCounts[sub.processing_status] = (statusCounts[sub.processing_status] || 0) + 1;
    });

    return {
      submissions,
      statusCounts,
      total: submissions.length,
      completed: statusCounts.reviewed || 0
    };
  }

  // Retry failed uploads
  async retryFailedUploads(sessionId) {
    const { data: failedSubmissions, error } = await supabase
      .from('student_submissions')
      .select('id')
      .eq('session_id', sessionId)
      .eq('processing_status', 'failed');

    if (error) {
      throw error;
    }

    // Reset failed submissions to uploaded status
    const { error: updateError } = await supabase
      .from('student_submissions')
      .update({ processing_status: 'uploaded' })
      .in('id', failedSubmissions.map(s => s.id));

    if (updateError) {
      throw updateError;
    }

    // Create new OCR jobs for failed submissions
    const ocrJobs = failedSubmissions.map(sub => ({
      submission_id: sub.id,
      status: 'pending',
      ocr_provider: 'tesseract'
    }));

    const { error: ocrError } = await supabase
      .from('ocr_jobs')
      .insert(ocrJobs);

    if (ocrError) {
      throw ocrError;
    }

    return failedSubmissions.length;
  }
}

export default new BulkUploadService();