export class Reranker {
  constructor(config = {}) {
    this.topN = config.topN || 3;
    this.minRelevanceThreshold = config.minRelevanceThreshold || 0.3;
  }

  // Enhanced reranking with subject-aware scoring and relevance filtering
  rerank(query, documents) {
    if (!documents || documents.length === 0) {
      return [];
    }
    
    const queryWords = query.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2);
    
    const querySubject = this.detectQuerySubject(query.toLowerCase());
    console.log(`🎯 Detected query subject: ${querySubject} for query: "${query}"`);
    
    // Score documents based on multiple factors
    const scoredDocs = documents.map(doc => {
      let score = doc.similarity || 0; // Base similarity score
      
      const content = doc.content.toLowerCase();
      const title = doc.metadata?.title?.toLowerCase() || '';
      const subject = doc.metadata?.subject?.toLowerCase() || '';
      
      // Subject matching bonus - heavily weighted
      if (querySubject && subject.includes(querySubject.toLowerCase())) {
        score += 1.0; // Large bonus for subject match
        console.log(`📚 Subject match bonus for "${title}" (${subject})`);
      } else if (querySubject && !subject.includes(querySubject.toLowerCase())) {
        score *= 0.3; // Heavy penalty for subject mismatch
        console.log(`❌ Subject mismatch penalty for "${title}" (${subject} vs ${querySubject})`);
      }
      
      // Enhanced keyword matching with position weighting
      queryWords.forEach(word => {
        // Title matches are most important
        if (title.includes(word)) {
          score += 0.5;
        }
        // Subject matches are also important
        if (subject.includes(word)) {
          score += 0.3;
        }
        // Content matches with position weighting
        const contentMatches = this.findWordMatches(content, word);
        score += contentMatches.score;
      });
      
      // Boost score for documents with relevant subjects
      const educationalSubjects = ['mathematics', 'science', 'history', 'english', 'computer science'];
      if (educationalSubjects.some(subj => subject.includes(subj))) {
        score += 0.1;
      }
      
      // Penalize very short content
      if (doc.content.length < 50) {
        score *= 0.6;
      }
      
      // Boost longer, more comprehensive content
      if (doc.content.length > 500) {
        score += 0.1;
      }
      
      // Calculate relevance score based on query-document semantic similarity
      const relevanceScore = this.calculateSemanticRelevance(query, doc.content);
      score += relevanceScore * 0.5;
      
      return {
        ...doc,
        rerankScore: score,
        relevanceScore: relevanceScore,
        subjectMatch: querySubject && subject.includes(querySubject.toLowerCase())
      };
    });
    
    // Filter out documents below relevance threshold
    const relevantDocs = scoredDocs.filter(doc => {
      const isRelevant = doc.rerankScore >= this.minRelevanceThreshold;
      if (!isRelevant) {
        console.log(`🚫 Filtered out "${doc.metadata?.title}" (score: ${doc.rerankScore.toFixed(3)})`);
      }
      return isRelevant;
    });
    
    // Sort by rerank score and return top N
    const reranked = relevantDocs
      .sort((a, b) => b.rerankScore - a.rerankScore)
      .slice(0, this.topN);
    
    console.log(`🔄 Reranked ${documents.length} documents → ${relevantDocs.length} relevant → ${reranked.length} final`);
    
    // Log final ranking for debugging
    reranked.forEach((doc, index) => {
      console.log(`🏆 Rank ${index + 1}: "${doc.metadata?.title}" (${doc.metadata?.subject}) - Score: ${doc.rerankScore.toFixed(3)}`);
    });
    
    return reranked;
  }

  // Detect the subject/domain of the query
  detectQuerySubject(query) {
    const subjectKeywords = {
      'mathematics': ['math', 'algebra', 'geometry', 'calculus', 'equation', 'polynomial', 'function', 'variable', 'formula', 'number', 'calculate', 'graph', 'coordinate', 'derivative', 'integral', 'matrix', 'vector', 'theorem', 'proof', 'statistics', 'trigonometry'],
      'science': ['science', 'biology', 'chemistry', 'physics', 'experiment', 'hypothesis', 'cell', 'molecule', 'atom', 'energy', 'force', 'photosynthesis', 'evolution', 'genetics', 'ecosystem', 'organism', 'reaction', 'compound', 'element', 'dna', 'protein'],
      'history': ['history', 'civilization', 'ancient', 'culture', 'society', 'empire', 'harappan', 'indus', 'mesopotamia', 'egypt', 'rome', 'greece', 'dynasty', 'king', 'war', 'trade', 'agriculture', 'archaeology', 'artifact', 'excavation', 'bronze', 'pottery', 'settlement', 'historical'],
      'english': ['english', 'literature', 'writing', 'grammar', 'poetry', 'novel', 'essay', 'paragraph', 'sentence', 'author', 'character', 'plot', 'theme', 'metaphor', 'symbolism', 'narrative', 'dialogue', 'literary'],
      'computer science': ['computer', 'programming', 'algorithm', 'code', 'software', 'hardware', 'database', 'network', 'internet', 'technology', 'digital', 'data', 'structure', 'class', 'object', 'method', 'coding', 'development']
    };

    let bestMatch = null;
    let maxScore = 0;

    Object.entries(subjectKeywords).forEach(([subject, keywords]) => {
      let score = 0;
      keywords.forEach(keyword => {
        if (query.includes(keyword)) {
          score += 1;
          // Give extra weight to exact matches
          if (query.includes(` ${keyword} `) || query.startsWith(keyword) || query.endsWith(keyword)) {
            score += 0.5;
          }
        }
      });
      
      if (score > maxScore) {
        maxScore = score;
        bestMatch = subject;
      }
    });

    return maxScore > 0 ? bestMatch : null;
  }

  // Find word matches with position and context weighting
  findWordMatches(content, word) {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    const matches = content.match(regex) || [];
    
    let score = 0;
    matches.forEach(() => {
      score += 0.1; // Base score per match
    });
    
    // Check for matches in important positions (beginning of sentences/paragraphs)
    const sentenceStartRegex = new RegExp(`(^|\\. )${word}\\b`, 'gi');
    const sentenceStartMatches = content.match(sentenceStartRegex) || [];
    score += sentenceStartMatches.length * 0.2; // Bonus for sentence start matches
    
    return {
      count: matches.length,
      score: score
    };
  }

  // Calculate semantic relevance between query and document
  calculateSemanticRelevance(query, content) {
    const queryWords = new Set(query.toLowerCase().split(/\s+/).filter(w => w.length > 2));
    const contentWords = new Set(content.toLowerCase().split(/\s+/).filter(w => w.length > 2));
    
    // Calculate Jaccard similarity
    const intersection = new Set([...queryWords].filter(x => contentWords.has(x)));
    const union = new Set([...queryWords, ...contentWords]);
    
    const jaccardSimilarity = intersection.size / union.size;
    
    // Calculate coverage (how much of the query is covered)
    const coverage = intersection.size / queryWords.size;
    
    // Combine both metrics
    return (jaccardSimilarity + coverage) / 2;
  }

  // Update configuration
  updateConfig(config) {
    this.topN = config.topN || this.topN;
    this.minRelevanceThreshold = config.minRelevanceThreshold || this.minRelevanceThreshold;
  }
}