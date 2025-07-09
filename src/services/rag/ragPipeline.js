import { DocumentProcessor } from './documentProcessor';
import { EmbeddingManager } from './embeddingManager';
import { VectorStore } from './vectorStore';
import { Reranker } from './reranker';
import { LLMGenerator } from './llmGenerator';

export class RAGPipeline {
  constructor(watsonxService, config = {}) {
    console.log('🔧 Initializing Enhanced RAG Pipeline...');
    
    // Enhanced configuration with better defaults
    this.config = {
      chunkSize: 500,
      chunkOverlap: 50,
      retrievalTopK: 15, // Increased for better recall
      rerankerTopN: 3,
      embeddingModel: 'enhanced',
      minRelevanceThreshold: 0.3, // Filter out irrelevant documents
      subjectAwareRanking: true,
      semanticFiltering: true,
      ...config
    };
    
    // Initialize components with enhanced configurations
    this.documentProcessor = new DocumentProcessor({
      chunkSize: this.config.chunkSize,
      chunkOverlap: this.config.chunkOverlap
    });
    
    this.embeddingManager = new EmbeddingManager({
      model: this.config.embeddingModel
    });
    
    this.vectorStore = new VectorStore(this.embeddingManager);
    
    this.reranker = new Reranker({
      topN: this.config.rerankerTopN,
      minRelevanceThreshold: this.config.minRelevanceThreshold
    });
    
    this.llmGenerator = new LLMGenerator(watsonxService);
    
    // State
    this.isInitialized = false;
    this.lastDocumentLoad = null;
    this.lastDocumentHash = null;
    this.documentSubjects = new Map(); // Track document subjects for better filtering
    
    console.log('✅ Enhanced RAG Pipeline components initialized');
  }

  // Enhanced document hash generation with subject tracking
  generateDocumentHash(documents) {
    if (!documents || documents.length === 0) return 'empty';
    
    const docInfo = documents.map(doc => {
      // Track subjects for filtering
      this.documentSubjects.set(doc.id, doc.subject?.toLowerCase() || 'general');
      return `${doc.id}-${doc.title}-${doc.subject}-${doc.created_at}`;
    }).join('|');
    
    return btoa(docInfo).substring(0, 16);
  }

  // Enhanced initialization with subject indexing
  async initialize(documents = null) {
    try {
      console.log('🔄 Initializing Enhanced RAG Pipeline with documents...');
      
      // Load documents if not provided
      if (!documents) {
        documents = await this.documentProcessor.loadDocuments();
      }
      
      // Generate hash to track document changes
      const currentHash = this.generateDocumentHash(documents);
      
      if (documents.length === 0) {
        console.warn('⚠️ No documents available for RAG pipeline');
        this.isInitialized = true;
        this.lastDocumentHash = currentHash;
        return;
      }
      
      // Check if we need to reprocess documents
      if (this.lastDocumentHash === currentHash && this.isInitialized) {
        console.log('📋 Documents unchanged, skipping reprocessing');
        return;
      }
      
      console.log(`📚 Processing ${documents.length} documents with subject tracking...`);
      
      // Log document subjects for debugging
      const subjectCounts = {};
      documents.forEach(doc => {
        const subject = doc.subject || 'Unknown';
        subjectCounts[subject] = (subjectCounts[subject] || 0) + 1;
      });
      console.log('📊 Document subjects:', subjectCounts);
      
      // Process documents into chunks with enhanced metadata
      const processedDocs = await this.documentProcessor.processDocuments(documents);
      
      // Clear existing vector store and add new documents
      this.vectorStore.clear();
      this.vectorStore.addDocuments(processedDocs);
      
      this.isInitialized = true;
      this.lastDocumentLoad = new Date();
      this.lastDocumentHash = currentHash;
      
      console.log(`✅ Enhanced RAG Pipeline initialized with ${documents.length} documents (${processedDocs.length} chunks)`);
      console.log(`🎯 Subject-aware ranking: ${this.config.subjectAwareRanking ? 'enabled' : 'disabled'}`);
    } catch (error) {
      console.error('❌ Error initializing enhanced RAG pipeline:', error);
      this.isInitialized = false;
    }
  }

  // Enhanced query method with better relevance filtering
  async query(question, documents = null) {
    try {
      console.log(`\n🔍 --- Enhanced RAG Query ---`);
      console.log(`❓ Question: ${question}`);
      
      // Initialize or reinitialize if needed
      if (!this.isInitialized || this.shouldReinitialize(documents)) {
        await this.initialize(documents);
      }
      
      // If no documents available, use fallback
      if (this.vectorStore.getDocumentCount() === 0) {
        console.log('📭 No documents in vector store, using direct LLM response');
        const response = await this.llmGenerator.generate([], question);
        return {
          response,
          sourceDocuments: []
        };
      }
      
      // 1. Enhanced retrieval with subject-aware filtering
      console.log(`🔎 Searching vector store with ${this.vectorStore.getDocumentCount()} documents...`);
      const retrievedDocs = this.vectorStore.search(question, this.config.retrievalTopK);
      console.log(`📄 Retrieved ${retrievedDocs.length} documents`);
      
      if (retrievedDocs.length === 0) {
        console.log('🚫 No relevant documents found, using direct LLM response');
        const response = await this.llmGenerator.generate([], question);
        return {
          response,
          sourceDocuments: []
        };
      }
      
      // Log retrieved documents with similarity scores
      retrievedDocs.forEach((doc, index) => {
        console.log(`📋 Retrieved ${index + 1}: "${doc.metadata?.title}" (${doc.metadata?.subject}) - Similarity: ${doc.similarity?.toFixed(3)}`);
      });
      
      // 2. Enhanced reranking with subject-aware scoring
      console.log('🎯 Applying enhanced reranking with subject awareness...');
      const rerankedDocs = this.reranker.rerank(question, retrievedDocs);
      console.log(`🏆 Reranked to ${rerankedDocs.length} highly relevant documents`);
      
      // Check if we have any relevant documents after reranking
      if (rerankedDocs.length === 0) {
        console.log('🚫 No sufficiently relevant documents found after reranking');
        const fallbackResponse = await this.generateFallbackResponse(question, retrievedDocs);
        return {
          response: fallbackResponse,
          sourceDocuments: []
        };
      }
      
      // Log final reranked documents
      rerankedDocs.forEach((doc, index) => {
        console.log(`🏆 Final ${index + 1}: "${doc.metadata?.title}" (${doc.metadata?.subject}) - Score: ${doc.rerankScore?.toFixed(3)}`);
      });
      
      // 3. Generate response with enhanced context
      console.log('🤖 Generating enhanced LLM response...');
      const response = await this.llmGenerator.generate(rerankedDocs, question);
      
      // 4. Return response with enhanced metadata
      const sourceDocuments = rerankedDocs.map(doc => ({
        id: doc.metadata?.documentId,
        title: doc.metadata?.title,
        subject: doc.metadata?.subject,
        similarity: doc.similarity,
        rerankScore: doc.rerankScore,
        relevanceScore: doc.relevanceScore,
        subjectMatch: doc.subjectMatch
      }));
      
      console.log(`✅ Enhanced RAG query completed successfully`);
      console.log(`📖 Source documents: ${sourceDocuments.map(d => `${d.title} (${d.subject})`).join(', ')}`);
      
      return {
        response,
        sourceDocuments
      };
      
    } catch (error) {
      console.error('❌ Error in enhanced RAG pipeline query:', error);
      
      // Enhanced fallback response
      return {
        response: await this.generateErrorFallbackResponse(question, error),
        sourceDocuments: []
      };
    }
  }

  // Generate fallback response when no relevant documents are found
  async generateFallbackResponse(question, retrievedDocs) {
    const availableSubjects = [...new Set(retrievedDocs.map(doc => doc.metadata?.subject).filter(Boolean))];
    
    return `I couldn't find documents that are sufficiently relevant to answer your question about "${question}".

**Available subjects in the knowledge base:**
${availableSubjects.map(subject => `• ${subject}`).join('\n')}

**Suggestions:**
• Try rephrasing your question to be more specific
• Check if your question relates to one of the available subjects above
• Ask your teacher if materials for this topic have been uploaded
• Consider breaking down complex questions into smaller parts

**Study Tips:**
• Review your course materials for related information
• Ask follow-up questions about specific aspects
• Connect new concepts to what you already know

Please try asking your question in a different way or about a topic from the available subjects!`;
  }

  // Generate error fallback response
  async generateErrorFallbackResponse(question, error) {
    return `I encountered an error while processing your question about "${question}".

**What happened:**
The AI system experienced a technical issue while searching through the documents.

**What you can do:**
• Try asking your question again in a moment
• Rephrase your question to be more specific
• Break complex questions into smaller parts
• Check your internet connection

**Study Tips while I recover:**
• Review your textbooks and course materials
• Take notes on key concepts you want to ask about
• Prepare follow-up questions for when the system is working
• Ask your teacher or classmates for immediate help

**Error details:** ${error.message || 'Unknown error'}

Please try again in a moment!`;
  }

  // Check if reinitialization is needed
  shouldReinitialize(documents = null) {
    if (!this.isInitialized) return true;
    
    // Check if documents have changed
    if (documents) {
      const currentHash = this.generateDocumentHash(documents);
      if (currentHash !== this.lastDocumentHash) {
        console.log('📝 Document changes detected, reinitialization needed');
        return true;
      }
    }
    
    // Reinitialize every 30 minutes to pick up new documents
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    const needsRefresh = this.lastDocumentLoad && this.lastDocumentLoad < thirtyMinutesAgo;
    
    if (needsRefresh) {
      console.log('⏰ 30 minutes elapsed, reinitialization needed');
    }
    
    return needsRefresh;
  }

  // Update configuration
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    
    // Update component configurations
    this.reranker.updateConfig({ 
      topN: this.config.rerankerTopN,
      minRelevanceThreshold: this.config.minRelevanceThreshold
    });
    
    console.log('⚙️ Enhanced RAG Pipeline configuration updated');
  }

  // Get enhanced pipeline status
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      documentCount: this.vectorStore.getDocumentCount(),
      lastDocumentLoad: this.lastDocumentLoad,
      lastDocumentHash: this.lastDocumentHash,
      config: this.config,
      availableSubjects: Array.from(this.documentSubjects.values()),
      enhancedFeatures: {
        subjectAwareRanking: this.config.subjectAwareRanking,
        semanticFiltering: this.config.semanticFiltering,
        relevanceThreshold: this.config.minRelevanceThreshold
      }
    };
  }

  // Force reinitialization
  async reinitialize(documents = null) {
    console.log('🔄 Forcing enhanced RAG pipeline reinitialization...');
    this.isInitialized = false;
    this.lastDocumentHash = null;
    this.documentSubjects.clear();
    await this.initialize(documents);
  }
}