export class VectorStore {
  constructor(embeddingManager) {
    this.embeddingManager = embeddingManager;
    this.documents = [];
    this.embeddings = [];
  }

  // Add documents to the vector store
  addDocuments(documents) {
    console.log(`Adding ${documents.length} documents to vector store...`);
    
    documents.forEach(doc => {
      const embedding = this.embeddingManager.getEmbedding(doc.content);
      this.documents.push(doc);
      this.embeddings.push(embedding);
    });
    
    console.log(`Vector store now contains ${this.documents.length} documents`);
  }

  // Search for similar documents
  search(query, topK = 5) {
    if (this.documents.length === 0) {
      console.warn('Vector store is empty');
      return [];
    }
    
    const queryEmbedding = this.embeddingManager.getEmbedding(query);
    const similarities = [];
    
    // Calculate similarity with all documents
    for (let i = 0; i < this.embeddings.length; i++) {
      const similarity = this.embeddingManager.calculateSimilarity(
        queryEmbedding,
        this.embeddings[i]
      );
      
      similarities.push({
        document: this.documents[i],
        similarity: similarity,
        index: i
      });
    }
    
    // Sort by similarity and return top K
    const results = similarities
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK)
      .filter(result => result.similarity > 0.1); // Minimum similarity threshold
    
    console.log(`Found ${results.length} relevant documents for query: "${query.substring(0, 50)}..."`);
    
    return results.map(result => ({
      content: result.document.content,
      metadata: result.document.metadata,
      similarity: result.similarity
    }));
  }

  // Get document count
  getDocumentCount() {
    return this.documents.length;
  }

  // Clear the vector store
  clear() {
    this.documents = [];
    this.embeddings = [];
    this.embeddingManager.clearCache();
  }
}