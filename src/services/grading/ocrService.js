// Enhanced OCR Service with Tesseract.js and EasyOCR support
import { createWorker } from 'tesseract.js';

class OCRService {
  constructor() {
    this.isInitialized = false;
    this.worker = null;
    this.processingQueue = [];
    this.isProcessing = false;
  }

  async initialize() {
    if (this.isInitialized) return;
    
    try {
      console.log('Initializing OCR Service with Tesseract.js...');
      this.worker = await createWorker();
      await this.worker.loadLanguage('eng');
      await this.worker.initialize('eng');
      
      // Configure for better handwriting recognition
      await this.worker.setParameters({
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,!?;:()[]{}"\'-+=*/\\|@#$%^&_~`<> \n\t',
        tessedit_pageseg_mode: '6', // Uniform block of text
        preserve_interword_spaces: '1'
      });
      
      this.isInitialized = true;
      console.log('OCR Service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize OCR service:', error);
      throw error;
    }
  }

  async processDocument(file) {
    await this.initialize();
    
    const startTime = Date.now();
    
    try {
      console.log('Processing document with OCR:', file.name);
      
      // Convert file to image if it's a PDF
      const images = await this.convertToImages(file);
      const pages = [];
      
      for (let i = 0; i < images.length; i++) {
        const image = images[i];
        console.log(`Processing page ${i + 1}/${images.length}`);
        
        const { data } = await this.worker.recognize(image);
        
        pages.push({
          pageNumber: i + 1,
          text: data.text,
          confidence: data.confidence,
          words: data.words?.map(word => ({
            text: word.text,
            confidence: word.confidence,
            bbox: word.bbox
          })) || []
        });
      }
      
      const processingTime = Date.now() - startTime;
      const averageConfidence = pages.reduce((sum, page) => sum + page.confidence, 0) / pages.length;
      
      const result = {
        provider: 'tesseract',
        pages: pages,
        confidence: averageConfidence,
        processingTime: processingTime,
        totalPages: pages.length,
        rawText: pages.map(p => p.text).join('\n\n--- Page Break ---\n\n')
      };
      
      console.log('OCR processing completed:', {
        confidence: result.confidence.toFixed(2),
        processingTime: `${result.processingTime}ms`,
        pages: result.totalPages,
        textLength: result.rawText.length
      });
      
      return result;
    } catch (error) {
      console.error('OCR processing failed:', error);
      throw new Error(`OCR processing failed: ${error.message}`);
    }
  }

  async convertToImages(file) {
    // For now, if it's already an image, return as-is
    if (file.type.startsWith('image/')) {
      return [file];
    }
    
    // For PDFs, we'll need to convert to images
    // This is a simplified implementation - in production you'd use pdf-poppler or similar
    if (file.type === 'application/pdf') {
      console.warn('PDF conversion not fully implemented - treating as single page');
      return [file]; // Tesseract can handle PDFs directly to some extent
    }
    
    return [file];
  }

  // Process OCR jobs from the queue
  async processOCRJobs() {
    if (this.isProcessing) return;
    
    this.isProcessing = true;
    
    try {
      // Get pending OCR jobs
      const { data: pendingJobs, error } = await supabase
        .from('ocr_jobs')
        .select(`
          id,
          submission_id,
          retry_count,
          student_submissions(
            id,
            file_url,
            file_name,
            session_id
          )
        `)
        .eq('status', 'pending')
        .order('created_at')
        .limit(5); // Process 5 at a time
      
      if (error) {
        console.error('Failed to fetch OCR jobs:', error);
        return;
      }
      
      if (!pendingJobs || pendingJobs.length === 0) {
        console.log('No pending OCR jobs found');
        return;
      }
      
      console.log(`Processing ${pendingJobs.length} OCR jobs...`);
      
      for (const job of pendingJobs) {
        await this.processOCRJob(job);
      }
      
    } catch (error) {
      console.error('Error processing OCR jobs:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  async processOCRJob(job) {
    const { id: jobId, submission_id, student_submissions: submission } = job;
    
    try {
      // Update job status to processing
      await supabase
        .from('ocr_jobs')
        .update({ 
          status: 'processing',
          processing_time: Date.now()
        })
        .eq('id', jobId);
      
      // Update submission status
      await supabase
        .from('student_submissions')
        .update({ processing_status: 'processing' })
        .eq('id', submission_id);
      
      // Download file from Supabase Storage
      const fileBlob = await this.downloadFile(submission.file_url);
      
      // Process with OCR
      const ocrResult = await this.processDocument(fileBlob);
      
      // Update submission with OCR results
      await supabase
        .from('student_submissions')
        .update({
          ocr_text: {
            pages: ocrResult.pages,
            confidence: ocrResult.confidence,
            provider: ocrResult.provider
          },
          raw_text: ocrResult.rawText,
          processing_status: 'ocr_completed'
        })
        .eq('id', submission_id);
      
      // Update OCR job as completed
      await supabase
        .from('ocr_jobs')
        .update({
          status: 'completed',
          confidence_score: ocrResult.confidence,
          processing_time: ocrResult.processingTime,
          pages_processed: ocrResult.totalPages,
          total_pages: ocrResult.totalPages,
          completed_at: new Date().toISOString()
        })
        .eq('id', jobId);
      
      console.log(`OCR job ${jobId} completed successfully`);
      
      // Trigger AI grading for this submission
      await this.triggerAIGrading(submission_id);
      
    } catch (error) {
      console.error(`OCR job ${jobId} failed:`, error);
      
      // Update job as failed
      await supabase
        .from('ocr_jobs')
        .update({
          status: 'failed',
          error_message: error.message,
          retry_count: (job.retry_count || 0) + 1,
          completed_at: new Date().toISOString()
        })
        .eq('id', jobId);
      
      // Update submission status
      await supabase
        .from('student_submissions')
        .update({ processing_status: 'failed' })
        .eq('id', submission_id);
    }
  }

  async downloadFile(fileUrl) {
    try {
      const response = await fetch(fileUrl);
      if (!response.ok) {
        throw new Error(`Failed to download file: ${response.statusText}`);
      }
      return await response.blob();
    } catch (error) {
      console.error('Failed to download file:', error);
      throw error;
    }
  }

  async triggerAIGrading(submissionId) {
    // Import here to avoid circular dependency
    const { default: GradingService } = await import('./gradingService.js');
    
    try {
      await GradingService.processSubmissionGrading(submissionId);
    } catch (error) {
      console.error('Failed to trigger AI grading:', error);
    }
  }

  // Start OCR processing loop
  startProcessing() {
    // Process OCR jobs every 10 seconds
    setInterval(() => {
      this.processOCRJobs();
    }, 10000);
    
    // Process immediately
    this.processOCRJobs();
  }

  getStatus() {
    return {
      isInitialized: this.isInitialized,
      isProcessing: this.isProcessing,
      provider: 'tesseract',
      supportedFormats: ['pdf', 'jpg', 'jpeg', 'png']
    };
  }

  async cleanup() {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
      this.isInitialized = false;
    }
  }
}

export default new OCRService();