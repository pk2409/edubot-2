import { DatabaseService } from '../supabase';

export class DocumentProcessor {
  constructor(config = {}) {
    this.chunkSize = config.chunkSize || 500;
    this.chunkOverlap = config.chunkOverlap || 50;
  }

  // Extract text content from document for better context
  extractDocumentContent(document) {
    try {
      // If document has base64 content, try to extract text
      if (document.file_url && document.file_url.startsWith('data:')) {
        // For now, we'll use the document metadata as context
        // In production, you'd want to extract actual text from PDFs/docs
        return `Document Title: ${document.title}\nSubject: ${document.subject}\nThis document contains educational content about ${document.subject}.`;
      }
      
      // Fallback to basic document info
      return `Document: "${document.title}" - Subject: ${document.subject}`;
    } catch (error) {
      console.error('Error extracting document content:', error);
      return `Document: "${document.title}" - Subject: ${document.subject}`;
    }
  }

  // Split document content into chunks
  splitIntoChunks(content) {
    const chunks = [];
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    
    let currentChunk = '';
    
    for (const sentence of sentences) {
      const trimmedSentence = sentence.trim();
      if (!trimmedSentence) continue;
      
      // If adding this sentence would exceed chunk size, save current chunk
      if (currentChunk.length + trimmedSentence.length > this.chunkSize && currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        
        // Start new chunk with overlap
        const words = currentChunk.split(' ');
        const overlapWords = words.slice(-Math.floor(this.chunkOverlap / 10)); // Approximate word overlap
        currentChunk = overlapWords.join(' ') + ' ' + trimmedSentence;
      } else {
        currentChunk += (currentChunk ? ' ' : '') + trimmedSentence;
      }
    }
    
    // Add the last chunk if it has content
    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }
    
    return chunks.length > 0 ? chunks : [content]; // Fallback to original content
  }

  // Process documents for RAG
  async processDocuments(documents) {
    const processedDocs = [];
    
    for (const doc of documents) {
      try {
        const content = this.extractDocumentContent(doc);
        const chunks = this.splitIntoChunks(content);
        
        chunks.forEach((chunk, index) => {
          processedDocs.push({
            id: `${doc.id}-chunk-${index}`,
            content: chunk,
            metadata: {
              documentId: doc.id,
              title: doc.title,
              subject: doc.subject,
              chunkIndex: index,
              totalChunks: chunks.length
            }
          });
        });
      } catch (error) {
        console.error(`Error processing document ${doc.id}:`, error);
      }
    }
    
    console.log(`Processed ${documents.length} documents into ${processedDocs.length} chunks`);
    return processedDocs;
  }

  // Load documents from database
  async loadDocuments() {
    try {
      const { data: documents } = await DatabaseService.getDocuments();
      return documents || [];
    } catch (error) {
      console.error('Error loading documents:', error);
      return [];
    }
  }
}