import { useState, useEffect, useCallback } from 'react';

// Sentiment analysis keywords
const POSITIVE_WORDS = new Set([
  'happy', 'great', 'wonderful', 'amazing', 'joy', 'excited', 'love', 'glad',
  'best', 'beautiful', 'fantastic', 'perfect', 'awesome', 'excellent',
  'success', 'win', 'winner', 'blessed', 'grateful', 'thankful', 'hope',
  'peace', 'calm', 'relaxed', 'content', 'comfortable', 'proud', 'confident'
]);

const NEGATIVE_WORDS = new Set([
  'sad', 'bad', 'terrible', 'awful', 'hate', 'angry', 'frustrated', 'upset',
  'depressed', 'lonely', 'hurt', 'pain', 'tears', 'unhappy', 'worried',
  'anxious', 'stressed', 'nervous', 'overwhelmed', 'failure', 'lose', 'regret',
  'guilt', 'shame', 'fear', 'scared', 'crushed', 'broken', 'desperate'
]);

const NEUTRAL_WORDS = new Set([
  'okay', 'fine', 'well', 'normal', 'average', 'usual', 'typical', 'common',
  'maybe', 'perhaps', 'uncertain', 'unknown', 'neutral'
]);

export function useMoodAnalysis() {
  const [mood, setMood] = useState('neutral');
  const [stressLevel, setStressLevel] = useState(0);
  const [emotionalScore, setEmotionalScore] = useState(0);
  const [detectedEmotions, setDetectedEmotions] = useState([]);
  const [analyzing, setAnalyzing] = useState(false);

  // Analyze text for mood and emotions
  const analyzeText = useCallback((text) => {
    if (!text || typeof text !== 'string') {
      return { mood: 'neutral', stressLevel: 0, emotionalScore: 0, detectedEmotions: [] };
    }

    setAnalyzing(true);

    const textLower = text.toLowerCase();
    const words = textLower.replace(/[^\w\s]/g, ' ').split(/\s+/);

    // Count positive, negative, and neutral words
    let positiveCount = 0;
    let negativeCount = 0;
    let neutralCount = 0;

    words.forEach(word => {
      if (POSITIVE_WORDS.has(word)) positiveCount++;
      if (NEGATIVE_WORDS.has(word)) negativeCount++;
      if (NEUTRAL_WORDS.has(word)) neutralCount++;
    });

    // Calculate emotional score (-100 to 100)
    const totalWords = words.length;
    const emotionalScore = Math.round(
      ((positiveCount - negativeCount) / (totalWords || 1)) * 100
    );

    // Determine mood based on score and word counts
    let detectedMood = 'neutral';
    let detectedEmotions = [];

    if (emotionalScore >= 30) {
      detectedMood = 'happy';
      detectedEmotions.push({ emotion: 'happy', intensity: Math.min(100, emotionalScore) });
    } else if (emotionalScore <= -30) {
      detectedMood = 'sad';
      detectedEmotions.push({ emotion: 'sad', intensity: Math.min(100, Math.abs(emotionalScore)) });
    } else if (negativeCount > positiveCount * 2) {
      detectedMood = 'stressed';
      detectedEmotions.push({ emotion: 'anxious', intensity: Math.min(100, negativeCount * 10) });
    } else if (positiveCount > negativeCount * 2) {
      detectedMood = 'excited';
      detectedEmotions.push({ emotion: 'joyful', intensity: Math.min(100, positiveCount * 10) });
    }

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

    // Calculate stress level (0-100)
    const baseStress = 50;
    const stressFromNegative = Math.min(50, negativeCount * 10);
    const stressFromPositive = Math.min(20, positiveCount * 5);
    const finalStressLevel = Math.min(100, baseStress + stressFromNegative - stressFromPositive);

    setMood(detectedMood);
    setStressLevel(finalStressLevel);
    setEmotionalScore(emotionalScore);
    setDetectedEmotions(detectedEmotions);
    setAnalyzing(false);

    return {
      mood: detectedMood,
      stressLevel: finalStressLevel,
      emotionalScore,
      detectedEmotions
    };
  }, []);

  // Analyze messages from chat
  const analyzeMessages = useCallback((messages) => {
    if (messages.length === 0) return;

    const lastUserMessage = messages
      .filter(m => m.role === 'user')
      .slice(-1)[0];

    if (lastUserMessage) {
      analyzeText(lastUserMessage.content);
    }
  }, [analyzeText]);

  // Reset mood analysis
  const reset = useCallback(() => {
    setMood('neutral');
    setStressLevel(0);
    setEmotionalScore(0);
    setDetectedEmotions([]);
  }, []);

  return {
    mood,
    stressLevel,
    emotionalScore,
    detectedEmotions,
    analyzing,
    analyzeText,
    analyzeMessages,
    reset
  };
}
