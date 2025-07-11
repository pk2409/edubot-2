  import Tesseract from 'tesseract.js';

// Client-side OCR Service for browser environment
class OCRService {
  constructor() {
    this.isProcessing = false;
    this.supportedFormats = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'];
  }

  // Simulate OCR processing for client-side testing
  async processDocument(file) {
    console.log('🔍 Starting OCR simulation for:', file.name);
    
    const startTime = Date.now();
    
    try {
      // Validate file type
      if (!this.supportedFormats.includes(file.type)) {
        throw new Error(`Unsupported file type: ${file.type}`);
      }
      
      // Simulate processing time
      await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 3000));
      
      // Generate mock OCR result based on file
 

const result = await Tesseract.recognize(file, 'eng');
const realText = result.data.text;

      const processingTime = Date.now() - startTime;
      
      
      
      console.log('✅ OCR simulation completed:', {
        confidence: result.confidence.toFixed(2),
        processingTime: `${result.processingTime}ms`,
        textLength: result.rawText.length
      });
      
      return result;
    } catch (error) {
      console.error('❌ OCR simulation failed:', error);
      throw error;
    }
  }

  generateMockOCRText(file) {
    const fileName = file.name.toLowerCase();
    
    // Generate different mock content based on filename patterns
    if (fileName.includes('math') || fileName.includes('algebra')) {
      return `Mathematics Assignment
Student Name: ${this.extractStudentName(file.name)}

Question 1: Solve for x: 2x + 5 = 15
Answer: 2x = 15 - 5
2x = 10
x = 5

Question 2: Find the area of a rectangle with length 8cm and width 6cm
Answer: Area = length × width
Area = 8 × 6 = 48 cm²

Question 3: Simplify: 3(x + 4) - 2(x - 1)
Answer: 3x + 12 - 2x + 2
= x + 14`;
    } else if (fileName.includes('science') || fileName.includes('biology')) {
      return `Science Test
Student: ${this.extractStudentName(file.name)}

1. What is photosynthesis?
Photosynthesis is the process by which plants make their own food using sunlight, carbon dioxide, and water. The equation is:
6CO₂ + 6H₂O + light energy → C₆H₁₂O₆ + 6O₂

2. Name three parts of a plant cell.
- Cell wall
- Chloroplasts  
- Vacuole

3. Explain the water cycle.
The water cycle involves evaporation, condensation, precipitation, and collection. Water evaporates from oceans and lakes, forms clouds, falls as rain, and returns to water bodies.`;
    } else if (fileName.includes('history')) {
      return `History Assignment
Name: ${this.extractStudentName(file.name)}

Question 1: Describe the Harappan Civilization
The Harappan Civilization was one of the world's earliest urban civilizations. It existed from 3300 to 1300 BCE in the Indus Valley. Key features included:
- Well-planned cities with grid patterns
- Advanced drainage systems
- Standardized weights and measures
- Trade networks across regions

Question 2: What were the main occupations?
- Agriculture (wheat, barley)
- Craftsmanship (pottery, jewelry)
- Trade and commerce
- Animal husbandry`;
    } else {
      return `Student Assignment
Name: ${this.extractStudentName(file.name)}

This is a sample answer sheet with handwritten responses. The student has attempted to answer all questions with varying degrees of completeness and accuracy.

Answer 1: The student provides a basic understanding of the concept with some examples.

Answer 2: A more detailed response showing good comprehension of the material.

Answer 3: The answer demonstrates critical thinking and application of learned concepts.

Overall, the work shows effort and understanding of the subject matter.`;
    }
  }

  extractStudentName(filename) {
    // Try to extract student name from filename
    const nameWithoutExt = filename.replace(/\.[^/.]+$/, "");
    const parts = nameWithoutExt.split(/[-_\s]+/);
    
    // Look for non-numeric parts as potential names
    const nameParts = parts.filter(part => !/^\d+$/.test(part));
    
    if (nameParts.length > 0) {
      return nameParts[0].charAt(0).toUpperCase() + nameParts[0].slice(1);
    }
    
    return 'Student';
  }

  generateMockWords(text) {
    return text.split(/\s+/).map((word, index) => ({
      text: word,
      confidence: 70 + Math.random() * 25,
      bbox: {
        x0: index * 50,
        y0: 100,
        x1: (index + 1) * 50,
        y1: 120
      }
    }));
  }

  // Process OCR jobs from database (client-side simulation)
  async processOCRJobs() {
    if (this.isProcessing) return;
    
    this.isProcessing = true;
    console.log('🔍 Checking for pending OCR jobs...');
    
    try {
      // Import supabase here to avoid circular dependencies
      const { supabase } = await import('../supabase');
      
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
        .limit(3); // Process 3 at a time
      
      if (error) {
        console.error('❌ Failed to fetch OCR jobs:', error);
        return;
      }
      
      if (!pendingJobs || pendingJobs.length === 0) {
        console.log('ℹ️ No pending OCR jobs found');
        return;
      }
      
      console.log(`📋 Processing ${pendingJobs.length} OCR jobs...`);
      
      for (const job of pendingJobs) {
        await this.processOCRJob(job);
        // Add delay between jobs
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
    } catch (error) {
      console.error('❌ Error processing OCR jobs:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  async processOCRJob(job) {
    const { id: jobId, submission_id, student_submissions: submission } = job;
    
    if (!submission) {
      console.error('❌ No submission data for job:', jobId);
      return;
    }
    
    console.log(`🔄 Processing OCR job ${jobId} for submission ${submission_id}`);
    
    try {
      const { supabase } = await import('../supabase');
      
      // Update job status to processing
      await supabase
        .from('ocr_jobs')
        .update({ 
          status: 'processing',
          pages_processed: 0,
          total_pages: 1
        })
        .eq('id', jobId);
      
      // Update submission status
      await supabase
        .from('student_submissions')
        .update({ processing_status: 'processing' })
        .eq('id', submission_id);
      
      // Create a mock file for processing
      const mockFile = new File(['mock content'], submission.file_name, { 
        type: submission.file_name.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg' 
      });
      
      // Process with mock OCR
      const ocrResult = await this.processDocument(mockFile);
      
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
          pages_processed: 1,
          total_pages: 1,
          completed_at: new Date().toISOString()
        })
        .eq('id', jobId);
      
      console.log(`✅ OCR job ${jobId} completed successfully`);
      
      // Trigger AI grading simulation
      await this.triggerAIGrading(submission_id);
      
    } catch (error) {
      console.error(`❌ OCR job ${jobId} failed:`, error);
      
      const { supabase } = await import('../supabase');
      
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

  async triggerAIGrading(submissionId) {
    try {
      // Import grading service and trigger AI grading
      const { default: GradingService } = await import('./gradingService.js');
      await GradingService.processSubmissionGrading(submissionId);
    } catch (error) {
      console.error('❌ Failed to trigger AI grading:', error);
    }
  }

  // Start processing loop (client-side)
  startProcessing() {
    console.log('🚀 Starting client-side OCR processor...');
    
    // Process OCR jobs every 15 seconds
    setInterval(() => {
      this.processOCRJobs();
    }, 15000);
    
    // Process immediately
    this.processOCRJobs();
  }

  getStatus() {
    return {
      isProcessing: this.isProcessing,
      provider: 'mock-tesseract',
      supportedFormats: this.supportedFormats,
      environment: 'client-side'
    };
  }
}

// Create and start the OCR service
const ocrService = new OCRService();
ocrService.startProcessing();

export default ocrService;