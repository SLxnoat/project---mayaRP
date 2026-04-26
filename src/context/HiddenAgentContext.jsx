import { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import { useChat } from '../context/ChatContext';

const HiddenAgentContext = createContext();

const initialState = {
  mood: 'neutral', // 'neutral', 'happy', 'sad', 'excited', 'calm', 'stressed'
  stressLevel: 0, // 0-100
  empathyLevel: 50, // 0-100, dynamically adjusted
  tone: 'balanced', // 'balanced', 'soothing', 'playful', 'serious'
  active: true,
  moodHistory: [],
  detectedEmotions: [],
  lastMoodCheck: null
};

// Sentiment keywords for mood detection
const MOOD_KEYWORDS = {
  happy: ['happy', 'great', 'wonderful', 'amazing', 'joy', 'excited', 'love', 'glad'],
  sad: ['sad', 'down', 'depressed', 'lonely', 'hurt', 'pain', 'tears', 'unhappy'],
  stressed: ['stressed', 'anxious', 'nervous', 'worried', 'overwhelmed', 'panic', 'stress'],
  excited: ['excited', 'thrilled', 'ecstatic', 'love', 'passionate', 'energetic'],
  calm: ['calm', 'peace', 'relaxed', 'serene', 'content', 'tranquil']
};

function agentReducer(state, action) {
  switch (action.type) {
    case 'SET_MOOD':
      return { ...state, mood: action.payload, lastMoodCheck: new Date() };
    case 'SET_STRESS_LEVEL':
      return { ...state, stressLevel: action.payload };
    case 'SET_EMPATHY_LEVEL':
      return { ...state, empathyLevel: action.payload };
    case 'SET_TONE':
      return { ...state, tone: action.payload };
    case 'TOGGLE_ACTIVE':
      return { ...state, active: action.payload };
    case 'ADD_MOOD_HISTORY':
      return {
        ...state,
        moodHistory: [action.payload, ...state.moodHistory].slice(0, 100)
      };
    case 'SET_DETECTED_EMOTIONS':
      return { ...state, detectedEmotions: action.payload };
    case 'RESET_AGENT':
      return { ...initialState, active: state.active };
    default:
      return state;
  }
}

export function HiddenAgentProvider({ children }) {
  const [state, dispatch] = useReducer(agentReducer, initialState);
  const { state: chatState } = useChat();

  // Analyze text and detect mood
  const analyzeMood = useCallback((text) => {
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

    dispatch({ type: 'SET_MOOD', payload: detectedMood });
    dispatch({ type: 'SET_STRESS_LEVEL', payload: stressLevel });
    dispatch({ type: 'SET_DETECTED_EMOTIONS', payload: detectedEmotions });
    dispatch({ type: 'ADD_MOOD_HISTORY', payload: { mood: detectedMood, timestamp: new Date(), stressLevel } });

    // Adjust empathy based on stress level
    if (stressLevel > 60) {
      dispatch({ type: 'SET_EMPATHY_LEVEL', payload: Math.min(100, state.empathyLevel + 20) });
      dispatch({ type: 'SET_TONE', payload: 'soothing' });
    } else if (stressLevel < 30 && detectedMood === 'happy') {
      dispatch({ type: 'SET_EMPATHY_LEVEL', payload: Math.max(0, state.empathyLevel - 10) });
      dispatch({ type: 'SET_TONE', payload: 'playful' });
    } else {
      dispatch({ type: 'SET_EMPATHY_LEVEL', payload: Math.max(30, Math.min(70, state.empathyLevel)) });
      dispatch({ type: 'SET_TONE', payload: 'balanced' });
    }

    return { detectedMood, stressLevel, detectedEmotions };
  }, [state.empathyLevel]);

  // Get adjusted response tone
  const getResponseTone = useCallback(() => {
    const toneSettings = {
      balanced: {
        style: 'natural, engaging, and responsive',
        responseLength: 'moderate',
        warmth: 0.7
      },
      soothing: {
        style: 'gentle, comforting, and empathetic',
        responseLength: 'moderate',
        warmth: 0.9
      },
      playful: {
        style: 'fun, flirty, and lighthearted',
        responseLength: 'short',
        warmth: 0.8
      },
      serious: {
        style: 'thoughtful, careful, and respectful',
        responseLength: 'longer',
        warmth: 0.6
      }
    };

    return toneSettings[state.tone] || toneSettings.balanced;
  }, [state.tone]);

  // Check mood periodically
  useEffect(() => {
    const checkInterval = setInterval(() => {
      if (chatState.messages.length > 0) {
        const lastMessage = chatState.messages[chatState.messages.length - 1];
        if (lastMessage.role === 'user') {
          analyzeMood(lastMessage.content);
        }
      }
    }, 10000); // Check every 10 seconds

    return () => clearInterval(checkInterval);
  }, [chatState.messages, analyzeMood]);

  // Reset agent state
  const reset = useCallback(() => {
    dispatch({ type: 'RESET_AGENT' });
  }, []);

  const value = {
    state,
    analyzeMood,
    getResponseTone,
    reset,
    active: state.active
  };

  return <HiddenAgentContext.Provider value={value}>{children}</HiddenAgentContext.Provider>;
}

export function useHiddenAgent() {
  const context = useContext(HiddenAgentContext);
  if (!context) {
    throw new Error('useHiddenAgent must be used within a HiddenAgentProvider');
  }
  return context;
}
