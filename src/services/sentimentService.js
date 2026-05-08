/**
 * Advanced Hybrid Sentiment Analysis Engine
 * Combines keyword weighting, semantic heuristics, and cognitive distortion detection.
 */

// Intensity-weighted emotion mapping
export const EMOTION_WEIGHTS = {
  happy: { weight: 1.0, arousal: 0.6 },
  ecstatic: { weight: 1.5, arousal: 1.0 },
  sad: { weight: 1.0, arousal: 0.2 },
  depressed: { weight: 1.8, arousal: 0.1 },
  stressed: { weight: 1.2, arousal: 0.8 },
  anxious: { weight: 1.5, arousal: 0.9 },
  angry: { weight: 1.5, arousal: 0.9 },
  calm: { weight: 1.0, arousal: 0.1 }
};

// Linguistic markers for cognitive distortions (Mental Health monitoring)
export const COGNITIVE_DISTORTIONS = {
  overgeneralization: ['always', 'never', 'everybody', 'nobody', 'everything', 'nothing'],
  catastrophizing: ['terrible', 'awful', 'horrible', 'end of the world', 'ruined', 'disaster'],
  personalization: ['my fault', 'i failed', 'because of me'],
  black_and_white: ['completely', 'totally', 'perfect', 'useless', 'worthless']
};

export const NEGATION_WORDS = new Set(['not', 'no', 'never', "don't", "can't", "won't", 'hardly', 'barely']);

export const MOOD_LEXICON = {
  happy: ['joy', 'glad', 'wonderful', 'amazing', 'best', 'blessed', 'grateful', 'success', 'win'],
  sad: ['hurt', 'pain', 'lonely', 'tears', 'unhappy', 'failure', 'lose', 'regret', 'guilt', 'shame'],
  stressed: ['overwhelmed', 'panic', 'stress', 'tired', 'exhausted', 'pressure', 'busy'],
  anxious: ['worried', 'nervous', 'scared', 'afraid', 'fear', 'dread', 'uncertain'],
  calm: ['peace', 'serene', 'tranquil', 'relaxed', 'content']
};

/**
 * Deep Sentiment Analysis with linguistic heuristics
 */
export function analyzeText(text) {
  if (!text || typeof text !== 'string') {
    return { mood: 'neutral', stressLevel: 0, emotionalScore: 0, distortions: [], detectedEmotions: [] };
  }

  const textLower = text.toLowerCase();
  const words = textLower.replace(/[^\w\s']/g, ' ').split(/\s+/);
  
  let scores = { happy: 0, sad: 0, stressed: 0, anxious: 0, calm: 0 };
  let distortionsDetected = [];
  let totalPositive = 0;
  let totalNegative = 0;
  let isNegated = false;

  // Analysis Loop
  words.forEach((word, index) => {
    // Negation Check (Window of 2)
    if (NEGATION_WORDS.has(word)) {
      isNegated = true;
      return;
    }

    // Process Lexicon
    Object.entries(MOOD_LEXICON).forEach(([mood, keywords]) => {
      if (keywords.includes(word)) {
        let impact = isNegated ? -0.8 : 1.0;
        scores[mood] += impact;
        
        if (mood === 'happy' || mood === 'calm') totalPositive += Math.abs(impact);
        else totalNegative += Math.abs(impact);
      }
    });

    // Reset negation if it's been more than 2 words
    if (isNegated && index > 0 && !NEGATION_WORDS.has(words[index-1])) {
      isNegated = false;
    }

    // Distortion Detection
    Object.entries(COGNITIVE_DISTORTIONS).forEach(([type, markers]) => {
      if (markers.includes(word)) {
        distortionsDetected.push(type);
      }
    });
  });

  // Calculate dominant mood
  const dominantMood = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  const detectedMood = dominantMood[1] > 0 ? dominantMood[0] : 'neutral';

  // Stress Modeling (High arousal = High stress)
  let stressLevel = (totalNegative * 25) + (distortionsDetected.length * 10);
  if (detectedMood === 'anxious' || detectedMood === 'stressed') stressLevel += 20;
  if (detectedMood === 'calm') stressLevel = Math.max(0, stressLevel - 30);
  stressLevel = Math.min(100, Math.max(0, stressLevel));

  // Emotional Score (-100 to 100)
  const emotionalScore = Math.min(100, Math.max(-100, (totalPositive - totalNegative) * 20));

  return {
    mood: detectedMood,
    stressLevel,
    emotionalScore,
    distortions: [...new Set(distortionsDetected)],
    detectedEmotions: Object.entries(scores)
      .filter(([_, score]) => score > 0)
      .map(([mood, score]) => ({ mood, score }))
  };
}

