/**
 * Sentiment Analysis Service
 * Provides keyword-based mood detection for the application.
 */

// Sentiment keywords for mood detection
export const MOOD_KEYWORDS = {
  happy: ['happy', 'great', 'wonderful', 'amazing', 'joy', 'excited', 'love', 'glad', 'best', 'beautiful', 'fantastic', 'perfect', 'awesome', 'excellent', 'success', 'win', 'winner', 'blessed', 'grateful', 'thankful', 'hope', 'peace', 'calm', 'relaxed', 'content', 'comfortable', 'proud', 'confident'],
  sad: ['sad', 'down', 'depressed', 'lonely', 'hurt', 'pain', 'tears', 'unhappy', 'bad', 'terrible', 'awful', 'hate', 'angry', 'frustrated', 'upset', 'worried', 'failure', 'lose', 'regret', 'guilt', 'shame', 'fear', 'scared', 'crushed', 'broken', 'desperate'],
  stressed: ['stressed', 'anxious', 'nervous', 'worried', 'overwhelmed', 'panic', 'stress', 'tired', 'exhausted'],
  excited: ['excited', 'thrilled', 'ecstatic', 'passionate', 'energetic', 'love'],
  calm: ['calm', 'peace', 'relaxed', 'serene', 'content', 'tranquil']
};

// Sentiment words for emotional scoring
export const POSITIVE_WORDS = new Set([
  'happy', 'great', 'wonderful', 'amazing', 'joy', 'excited', 'love', 'glad',
  'best', 'beautiful', 'fantastic', 'perfect', 'awesome', 'excellent',
  'success', 'win', 'winner', 'blessed', 'grateful', 'thankful', 'hope',
  'peace', 'calm', 'relaxed', 'content', 'comfortable', 'proud', 'confident'
]);

export const NEGATIVE_WORDS = new Set([
  'sad', 'bad', 'terrible', 'awful', 'hate', 'angry', 'frustrated', 'upset',
  'depressed', 'lonely', 'hurt', 'pain', 'tears', 'unhappy', 'worried',
  'anxious', 'stressed', 'nervous', 'overwhelmed', 'failure', 'lose', 'regret',
  'guilt', 'shame', 'fear', 'scared', 'crushed', 'broken', 'desperate'
]);

export const NEUTRAL_WORDS = new Set([
  'okay', 'fine', 'well', 'normal', 'average', 'usual', 'typical', 'common',
  'maybe', 'perhaps', 'uncertain', 'unknown', 'neutral'
]);

/**
 * Analyze mood based on text using keyword matching
 * @param {string} text - The text to analyze
 * @returns {object} - Object containing mood, stress level, and detected emotions
 */
export function analyzeMood(text) {
  if (!text || typeof text !== 'string') {
    return { mood: 'neutral', stressLevel: 0, detectedEmotions: [] };
  }

  const textLower = text.toLowerCase();
  const emotionScores = {};

  // Score each mood based on keyword matches
  Object.keys(MOOD_KEYWORDS).forEach(mood => {
    const keywords = MOOD_KEYWORDS[mood];
    const matches = keywords.filter(keyword => textLower.includes(keyword));
    emotionScores[mood] = matches.length;
  });

  // Determine dominant mood
  const dominantMood = Object.entries(emotionScores)
    .sort((a, b) => b[1] - a[1])[0];

  let detectedMood = 'neutral';
  let stressLevel = 0;

  if (dominantMood && dominantMood[1] > 0) {
    detectedMood = dominantMood[0];
    // Adjust stress level based on mood
    if (detectedMood === 'stressed' || detectedMood === 'sad') {
      stressLevel = 70 + Math.random() * 30;
    } else if (detectedMood === 'happy' || detectedMood === 'excited') {
      stressLevel = 10 + Math.random() * 20;
    } else {
      stressLevel = 30 + Math.random() * 30;
    }
  }

  // Update detected emotions
  const detectedEmotions = Object.entries(emotionScores)
    .filter(([_, score]) => score > 0)
    .map(([mood]) => ({ mood, score: emotionScores[mood] }));

  // Add additional detected emotions based on specific keywords
  if (textLower.includes('tired') || textLower.includes('exhausted')) {
    detectedEmotions.push({ emotion: 'exhausted', intensity: 70 });
  }
  if (textLower.includes('love') || textLower.includes('crush')) {
    detectedEmotions.push({ emotion: 'romantic', intensity: 60 });
  }
  if (textLower.includes('scared') || textLower.includes('afraid')) {
    detectedEmotions.push({ emotion: 'fear', intensity: 80 });
  }

  return { mood: detectedMood, stressLevel, detectedEmotions };
}

/**
 * Calculate emotional score from text
 * @param {string} text - The text to analyze
 * @returns {number} - Emotional score from -100 to 100
 */
export function calculateEmotionalScore(text) {
  if (!text || typeof text !== 'string') return 0;

  const textLower = text.toLowerCase();
  const words = textLower.replace(/[^\w\s]/g, ' ').split(/\s+/);

  let positiveCount = 0;
  let negativeCount = 0;

  words.forEach(word => {
    if (POSITIVE_WORDS.has(word)) positiveCount++;
    if (NEGATIVE_WORDS.has(word)) negativeCount++;
  });

  const totalWords = words.length;
  return Math.round(
    ((positiveCount - negativeCount) / (totalWords || 1)) * 100
  );
}

/**
 * Analyze text and return comprehensive mood analysis
 * @param {string} text - The text to analyze
 * @returns {object} - Comprehensive mood analysis object
 */
export function analyzeText(text) {
  if (!text || typeof text !== 'string') {
    return {
      mood: 'neutral',
      stressLevel: 0,
      emotionalScore: 0,
      detectedEmotions: []
    };
  }

  const moodAnalysis = analyzeMood(text);
  const emotionalScore = calculateEmotionalScore(text);

  return {
    mood: moodAnalysis.mood,
    stressLevel: moodAnalysis.stressLevel,
    emotionalScore,
    detectedEmotions: moodAnalysis.detectedEmotions
  };
}
