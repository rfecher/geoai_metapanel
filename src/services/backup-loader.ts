/**
 * Backup Response System
 * Provides pre-generated responses as fallback when live AI models are unavailable
 */

export interface BackupResponse {
  content: string;
  timestamp: string;
}

export interface BackupQuestion {
  question: string;
  responses: Record<string, BackupResponse>;
}

export interface MatchResult {
  questionId: string | null;
  confidence: number; // 0-1 score indicating match quality
  matchType: 'introduction' | 'title' | 'keyword' | 'none';
}

/**
 * Load backup responses for a specific question ID
 */
export const loadBackupResponses = async (questionId: string): Promise<BackupQuestion | null> => {
  try {
    const response = await fetch(`/demo-backup/${questionId}.json`);
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.error(`Failed to load backup responses for ${questionId}:`, error);
    return null;
  }
};

/**
 * Pre-defined demo questions with backup responses
 */
export const DEMO_QUESTIONS = [
  { id: 'introduction', title: 'Persona Introduction' },
  { id: 'q1-technical-bottlenecks', title: 'Technical Bottlenecks in LLM+GeoAI Integration' },
  { id: 'q2-model-selection', title: 'Model Selection for LIDAR Processing' },
  { id: 'q3-data-sovereignty', title: 'Data Sovereignty Architecture' },
  { id: 'q4-community-model', title: 'Community PostGIS LLM Development' },
  { id: 'q5-debugging-approach', title: 'Debugging Complex Geometry Processing' },
  { id: 'q6-future-architecture', title: 'Future Architecture Evolution' }
];

/**
 * Find the best matching backup question with confidence scoring
 * Returns both the question ID and a confidence score (0-1)
 * Higher thresholds ensure only strong matches trigger pre-generated responses
 */
export const findMatchingBackupQuestionWithConfidence = (userQuestion: string): MatchResult => {
  const lowerQuestion = userQuestion.toLowerCase();

  // Check for introduction-related questions first (highest priority)
  // These patterns match common ways users ask personas to introduce themselves
  // Require very specific phrasing for high confidence
  if (
    lowerQuestion.includes('introduce yourself') ||
    lowerQuestion.includes('who are you') ||
    lowerQuestion.includes('tell me about yourself')
  ) {
    return { questionId: 'introduction', confidence: 0.95, matchType: 'introduction' };
  }

  // Weaker introduction patterns - lower confidence
  if (
    lowerQuestion.includes('introduce your') ||
    lowerQuestion.includes('who is') ||
    lowerQuestion.includes('tell me about your') ||
    lowerQuestion.includes('what is your background') ||
    lowerQuestion.includes('what\'s your background') ||
    lowerQuestion.includes('your background') ||
    lowerQuestion.includes('what do you do') ||
    lowerQuestion.includes('your experience') ||
    lowerQuestion.includes('your role') ||
    lowerQuestion.includes('about you')
  ) {
    return { questionId: 'introduction', confidence: 0.75, matchType: 'introduction' };
  }

  // Check for exact or partial matches with STRICTER threshold (50% instead of 30%)
  let bestTitleMatch: MatchResult = { questionId: null, confidence: 0, matchType: 'none' };

  for (const demoQ of DEMO_QUESTIONS) {
    if (demoQ.id === 'introduction') continue; // Already handled above

    const keywords = demoQ.title.toLowerCase().split(/\s+/);
    const matchCount = keywords.filter(keyword => lowerQuestion.includes(keyword)).length;
    const matchRatio = matchCount / keywords.length;

    // Require 50% match for consideration (stricter than before)
    if (matchRatio >= 0.5) {
      const confidence = Math.min(0.9, matchRatio); // Cap at 0.9 for title matches
      if (confidence > bestTitleMatch.confidence) {
        bestTitleMatch = { questionId: demoQ.id, confidence, matchType: 'title' };
      }
    }
  }

  // Check for specific topic keywords with STRICTER requirements
  // Require multiple keywords or very specific combinations for high confidence

  // Q1: Technical Bottlenecks - require both "bottleneck" AND ("integration" OR "technical" OR "llm")
  if (lowerQuestion.includes('bottleneck') &&
      (lowerQuestion.includes('integration') || lowerQuestion.includes('technical') || lowerQuestion.includes('llm') || lowerQuestion.includes('geoai'))) {
    const keywordMatch: MatchResult = { questionId: 'q1-technical-bottlenecks', confidence: 0.85, matchType: 'keyword' };
    if (keywordMatch.confidence > bestTitleMatch.confidence) {
      return keywordMatch;
    }
  }

  // Q2: Model Selection - require "model" AND ("select" OR "lidar") AND ("processing" OR "choose" OR "which")
  if (lowerQuestion.includes('model') &&
      (lowerQuestion.includes('select') || lowerQuestion.includes('lidar')) &&
      (lowerQuestion.includes('processing') || lowerQuestion.includes('choose') || lowerQuestion.includes('which'))) {
    const keywordMatch: MatchResult = { questionId: 'q2-model-selection', confidence: 0.85, matchType: 'keyword' };
    if (keywordMatch.confidence > bestTitleMatch.confidence) {
      return keywordMatch;
    }
  }

  // Q3: Data Sovereignty - require "sovereignty" OR ("data" AND "privacy" AND ("architecture" OR "governance"))
  if (lowerQuestion.includes('sovereignty') ||
      (lowerQuestion.includes('data') && lowerQuestion.includes('privacy') &&
       (lowerQuestion.includes('architecture') || lowerQuestion.includes('governance')))) {
    const keywordMatch: MatchResult = { questionId: 'q3-data-sovereignty', confidence: 0.85, matchType: 'keyword' };
    if (keywordMatch.confidence > bestTitleMatch.confidence) {
      return keywordMatch;
    }
  }

  // Q4: Community Model - require ("community" OR "postgis") AND ("llm" OR "model" OR "development")
  if ((lowerQuestion.includes('community') || lowerQuestion.includes('postgis')) &&
      (lowerQuestion.includes('llm') || lowerQuestion.includes('model') || lowerQuestion.includes('development'))) {
    const keywordMatch: MatchResult = { questionId: 'q4-community-model', confidence: 0.85, matchType: 'keyword' };
    if (keywordMatch.confidence > bestTitleMatch.confidence) {
      return keywordMatch;
    }
  }

  // Q5: Debugging - require ("debug" OR "debugging") AND ("geometry" OR "processing" OR "spatial")
  if ((lowerQuestion.includes('debug') || lowerQuestion.includes('debugging')) &&
      (lowerQuestion.includes('geometry') || lowerQuestion.includes('processing') || lowerQuestion.includes('spatial'))) {
    const keywordMatch: MatchResult = { questionId: 'q5-debugging-approach', confidence: 0.85, matchType: 'keyword' };
    if (keywordMatch.confidence > bestTitleMatch.confidence) {
      return keywordMatch;
    }
  }

  // Q6: Future Architecture - require "future" AND ("architecture" OR "evolution" OR "trends")
  if (lowerQuestion.includes('future') &&
      (lowerQuestion.includes('architecture') || lowerQuestion.includes('evolution') || lowerQuestion.includes('trends'))) {
    const keywordMatch: MatchResult = { questionId: 'q6-future-architecture', confidence: 0.85, matchType: 'keyword' };
    if (keywordMatch.confidence > bestTitleMatch.confidence) {
      return keywordMatch;
    }
  }

  // Return best title match if found, otherwise no match
  return bestTitleMatch;
};

/**
 * Legacy function for backward compatibility
 * Returns question ID only (no confidence score)
 * Uses a confidence threshold of 0.7 to determine if match is strong enough
 */
export const findMatchingBackupQuestion = (userQuestion: string): string | null => {
  const result = findMatchingBackupQuestionWithConfidence(userQuestion);
  // Only return match if confidence is >= 0.7 (stricter than before)
  return result.confidence >= 0.7 ? result.questionId : null;
};

/**
 * Get a generic fallback response when no specific backup is available
 */
export const getGenericFallbackResponse = (personaId: string): string => {
  const genericResponses: Record<string, string> = {
    maya: "I appreciate the question. From my experience in emergency response and Indigenous data governance, I'd emphasize the importance of community-centered approaches and proper spatial data sovereignty. When systems fail, it's often because we haven't adequately considered local context and traditional knowledge.",
    otto: "An interesting question indeed. From a cartographic perspective, we must ensure proper mathematical rigor and adherence to established spatial reference standards. The technical foundations matter greatly, and we cannot compromise on precision.",
    sarah: "Great question! From an open-source perspective, I'd focus on building transparent, community-driven solutions that anyone can audit and improve. Vendor lock-in and proprietary systems often create more problems than they solve.",
    marcus: "Good question. In my experience deploying geospatial AI systems at scale, what matters most is what actually works in production. We need solutions that are reliable, secure, and deliver measurable results. Theory is important, but operational reality is what counts.",
    jessica: "That's a critical question for national security applications. We need to balance innovation with security, ensuring our geospatial intelligence capabilities remain robust while protecting sensitive data and maintaining operational readiness."
  };

  return genericResponses[personaId] || "Thank you for the question. I'd be happy to share my perspective on this topic based on my experience and expertise.";
};