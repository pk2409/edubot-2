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
// Upload files with metadata (manual studentId support)
async uploadFiles(fileDataList, sessionId, onProgress) {
  const uploadResults = [];
  const batchId = crypto.randomUUID();

  // ✅ Step 1: Fetch session & paper info (once per upload)
  const { data: sessionData, error: sessionErr } = await supabase
    .from('grading_sessions')
    .select('class_section, question_paper_id')
    .eq('id', sessionId)
    .single();

  const { data: paperData, error: paperErr } = await supabase
    .from('question_papers')
    .select('total_marks')
    .eq('id', sessionData?.question_paper_id || '')
    .single();

  const classSection = sessionData?.class_section || 'N/A';
  const totalMarks = paperData?.total_marks || 100;

  // ✅ Step 2: Start file uploads
  for (let i = 0; i < fileDataList.length; i++) {
    const { file, studentId, studentName, rollNumber } = fileDataList[i];

//     if (!file) {
//   uploadResults.push({
//     success: false,
//     file: `File ${i + 1}`,
//     error: 'Missing file'
//   });
//   continue;
// }


    try {
      const timestamp = Date.now();
      const uniqueFilename = `${sessionId}/${batchId}/${timestamp}_${i}_${file.name}`;

      const { error: uploadError } = await supabase.storage
        .from('submissions')
        .upload(uniqueFilename, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('submissions')
        .getPublicUrl(uniqueFilename);

      const { data: submissionData, error: submissionError } = await supabase
        .from('student_submissions')
        .insert({
          session_id: sessionId,
          student_id: studentId,
          student_name: studentName,
          roll_number: rollNumber,
          file_url: urlData.publicUrl,
          file_name: file.name,
          file_size: file.size,
          file_type: file.type,
          processing_status: 'uploaded',
          class_section: classSection,
          total_marks: totalMarks
        })
        .select()
        .single();

      if (submissionError) throw submissionError;

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
        studentId,
        studentName,
        rollNumber
      });

      if (onProgress) {
        onProgress({
          completed: i + 1,
          total: fileDataList.length,
          currentFile: file.name,
          percentage: Math.round(((i + 1) / fileDataList.length) * 100)
        });
      }
    } catch (error) {
      console.error(`Failed to upload ${file?.name || `File ${i + 1}`}:`, error);
      uploadResults.push({
        success: false,
        file: file.name,
        error: error.message
      });
    }
  }

  // ✅ Step 3: Update session with batch info
  await supabase
    .from('grading_sessions')
    .update({
      batch_upload_id: batchId,
      total_submissions: uploadResults.filter(r => r.success).length
    })
    .eq('id', sessionId);

    console.log('✅ OCR job inserted')

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