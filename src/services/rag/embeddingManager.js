export class EmbeddingManager {
  constructor(config = {}) {
    this.model = config.model || 'simple';
    this.cache = new Map();
  }

  // Enhanced embedding using TF-IDF-like approach with better educational term weighting
  generateSimpleEmbedding(text) {
    // Convert text to lowercase and split into words
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2);
    
    // Create a simple word frequency vector
    const wordFreq = {};
    words.forEach(word => {
      wordFreq[word] = (wordFreq[word] || 0) + 1;
    });
    
    // Convert to normalized vector (simplified)
    const totalWords = words.length;
    const embedding = [];
    
    // Enhanced vocabulary with subject-specific terms
    const vocabulary = {
      // General educational terms
      'learn': 1.0, 'study': 1.0, 'education': 1.0, 'knowledge': 1.0, 'understand': 1.0, 'concept': 1.0,
      'theory': 1.0, 'practice': 1.0, 'example': 1.0, 'problem': 1.0, 'solution': 1.0, 'method': 1.0,
      'analysis': 1.0, 'research': 1.0, 'data': 1.0, 'information': 1.0,
      
      // Mathematics terms
      'math': 2.0, 'mathematics': 2.0, 'algebra': 2.0, 'geometry': 2.0, 'calculus': 2.0, 'equation': 2.0,
      'polynomial': 2.0, 'function': 2.0, 'variable': 2.0, 'formula': 2.0, 'number': 1.5, 'calculate': 1.5,
      'graph': 1.5, 'coordinate': 1.5, 'derivative': 2.0, 'integral': 2.0, 'matrix': 2.0, 'vector': 2.0,
      
      // Science terms
      'science': 2.0, 'biology': 2.0, 'chemistry': 2.0, 'physics': 2.0, 'experiment': 1.5, 'hypothesis': 1.5,
      'cell': 1.5, 'molecule': 1.5, 'atom': 1.5, 'energy': 1.5, 'force': 1.5, 'photosynthesis': 2.0,
      'evolution': 2.0, 'genetics': 2.0, 'ecosystem': 1.5, 'organism': 1.5,
      
      // History terms
      'history': 2.0, 'civilization': 2.0, 'ancient': 2.0, 'culture': 1.5, 'society': 1.5, 'empire': 2.0,
      'harappan': 3.0, 'indus': 3.0, 'mesopotamia': 3.0, 'egypt': 2.0, 'rome': 2.0, 'greece': 2.0,
      'dynasty': 2.0, 'king': 1.5, 'war': 1.5, 'trade': 1.5, 'agriculture': 1.5, 'archaeology': 2.0,
      'artifact': 2.0, 'excavation': 2.0, 'bronze': 1.5, 'pottery': 1.5, 'settlement': 1.5,
      
      // English/Literature terms
      'english': 2.0, 'literature': 2.0, 'writing': 1.5, 'grammar': 1.5, 'poetry': 2.0, 'novel': 2.0,
      'essay': 1.5, 'paragraph': 1.5, 'sentence': 1.5, 'author': 1.5, 'character': 1.5, 'plot': 1.5,
      'theme': 1.5, 'metaphor': 1.5, 'symbolism': 1.5,
      
      // Computer Science terms
      'computer': 2.0, 'programming': 2.0, 'algorithm': 2.0, 'code': 1.5, 'software': 1.5, 'hardware': 1.5,
      'database': 1.5, 'network': 1.5, 'internet': 1.5, 'technology': 1.5, 'digital': 1.5
    };
    
    // Calculate weighted term frequencies
    Object.entries(vocabulary).forEach(([term, weight]) => {
      const freq = wordFreq[term] || 0;
      embedding.push((freq / totalWords) * weight);
    });
    
    // Add enhanced text statistics
    embedding.push(words.length / 100); // Normalized word count
    embedding.push(text.length / 1000); // Normalized character count
    
    // Add subject-specific features
    const subjectScores = this.calculateSubjectScores(text.toLowerCase());
    embedding.push(...Object.values(subjectScores));
    
    return embedding;
  }

  // Calculate subject-specific scores for better matching
  calculateSubjectScores(text) {
    const subjects = {
      mathematics: ['math', 'algebra', 'geometry', 'calculus', 'equation', 'polynomial', 'function', 'variable', 'formula', 'number', 'calculate', 'graph', 'coordinate', 'derivative', 'integral', 'matrix', 'vector', 'theorem', 'proof', 'statistics'],
      science: ['science', 'biology', 'chemistry', 'physics', 'experiment', 'hypothesis', 'cell', 'molecule', 'atom', 'energy', 'force', 'photosynthesis', 'evolution', 'genetics', 'ecosystem', 'organism', 'reaction', 'compound', 'element'],
      history: ['history', 'civilization', 'ancient', 'culture', 'society', 'empire', 'harappan', 'indus', 'mesopotamia', 'egypt', 'rome', 'greece', 'dynasty', 'king', 'war', 'trade', 'agriculture', 'archaeology', 'artifact', 'excavation', 'bronze', 'pottery', 'settlement'],
      english: ['english', 'literature', 'writing', 'grammar', 'poetry', 'novel', 'essay', 'paragraph', 'sentence', 'author', 'character', 'plot', 'theme', 'metaphor', 'symbolism', 'narrative', 'dialogue'],
      computerscience: ['computer', 'programming', 'algorithm', 'code', 'software', 'hardware', 'database', 'network', 'internet', 'technology', 'digital', 'data', 'structure', 'class', 'object', 'method']
    };

    const scores = {};
    
    Object.entries(subjects).forEach(([subject, terms]) => {
      let score = 0;
      terms.forEach(term => {
        const regex = new RegExp(`\\b${term}\\b`, 'gi');
        const matches = (text.match(regex) || []).length;
        score += matches;
      });
      scores[subject] = score / terms.length; // Normalize by number of terms
    });

    return scores;
  }

  // Enhanced cosine similarity with subject-aware weighting
  calculateSimilarity(embedding1, embedding2) {
    if (embedding1.length !== embedding2.length) {
      return 0;
    }
    
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;
    
    // Weight the first part of embeddings (vocabulary terms) more heavily
    const vocabLength = embedding1.length - 7; // Subtract subject scores and text stats
    
    for (let i = 0; i < embedding1.length; i++) {
      const weight = i < vocabLength ? 1.0 : 2.0; // Give more weight to subject scores
      const weighted1 = embedding1[i] * weight;
      const weighted2 = embedding2[i] * weight;
      
      dotProduct += weighted1 * weighted2;
      norm1 += weighted1 * weighted1;
      norm2 += weighted2 * weighted2;
    }
    
    const magnitude = Math.sqrt(norm1) * Math.sqrt(norm2);
    return magnitude === 0 ? 0 : dotProduct / magnitude;
  }

  // Get embedding for text (with caching)
  getEmbedding(text) {
    const cacheKey = text.substring(0, 100); // Use first 100 chars as cache key
    
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }
    
    const embedding = this.generateSimpleEmbedding(text);
    this.cache.set(cacheKey, embedding);
    
    return embedding;
  }

  // Clear cache
  clearCache() {
    this.cache.clear();
  }
}