import { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import { useChat } from '../context/ChatContext';
import { analyzeText } from '../services/sentimentService';

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

  // Analyze text and detect mood using the shared service
  const runAnalysis = useCallback((text) => {
    if (!text) return;
    
    const analysis = analyzeText(text);

    dispatch({ type: 'SET_MOOD', payload: analysis.mood });
    dispatch({ type: 'SET_STRESS_LEVEL', payload: analysis.stressLevel });
    dispatch({ type: 'SET_DETECTED_EMOTIONS', payload: analysis.detectedEmotions });
    dispatch({ type: 'ADD_MOOD_HISTORY', payload: { 
      mood: analysis.mood, 
      timestamp: new Date(), 
      stressLevel: analysis.stressLevel,
      score: analysis.emotionalScore
    } });

    // Adjust empathy and tone based on stress level and mood
    if (analysis.stressLevel > 60) {
      dispatch({ type: 'SET_EMPATHY_LEVEL', payload: Math.min(100, state.empathyLevel + 20) });
      dispatch({ type: 'SET_TONE', payload: 'soothing' });
    } else if (analysis.stressLevel < 30 && analysis.mood === 'happy') {
      dispatch({ type: 'SET_EMPATHY_LEVEL', payload: Math.max(0, state.empathyLevel - 10) });
      dispatch({ type: 'SET_TONE', payload: 'playful' });
    } else if (analysis.mood === 'sad') {
      dispatch({ type: 'SET_EMPATHY_LEVEL', payload: Math.min(100, state.empathyLevel + 10) });
      dispatch({ type: 'SET_TONE', payload: 'serious' });
    } else {
      dispatch({ type: 'SET_EMPATHY_LEVEL', payload: Math.max(30, Math.min(70, state.empathyLevel)) });
      dispatch({ type: 'SET_TONE', payload: 'balanced' });
    }

    return analysis;
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
          runAnalysis(lastMessage.content);
        }
      }
    }, 10000); // Check every 10 seconds

    return () => clearInterval(checkInterval);
  }, [chatState.messages, runAnalysis]);

  // Reset agent state
  const reset = useCallback(() => {
    dispatch({ type: 'RESET_AGENT' });
  }, []);

  const value = {
    state,
    analyzeMood: runAnalysis,
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
