import { createContext, useContext, useReducer, useEffect, useCallback, useRef } from 'react';
import { useChat } from './ChatContext';
import { useVision } from './VisionContext';
import { analyzeText } from '../services/sentimentService';
import { performDeepAnalysis } from '../services/aiService';

const HiddenAgentContext = createContext();

const initialState = {
  mood: 'neutral',
  stressLevel: 0,
  smoothedStress: 0, // EMA smoothed value
  empathyLevel: 50,
  tone: 'balanced',
  active: true,
  moodHistory: [],
  detectedEmotions: [],
  distortions: [],
  deepProfile: null, // NEW: High-fidelity LLM analysis
  isAnalyzing: false,
  lastMoodCheck: null
};

function agentReducer(state, action) {
  switch (action.type) {
    case 'SET_MOOD':
      return { ...state, mood: action.payload, lastMoodCheck: new Date() };
    case 'SET_STRESS_LEVEL':
      const alpha = 0.3; // Smoothing factor
      const newSmoothed = (action.payload * alpha) + (state.smoothedStress * (1 - alpha));
      return { ...state, stressLevel: action.payload, smoothedStress: newSmoothed };
    case 'SET_DISTORTIONS':
      return { ...state, distortions: action.payload };
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
    case 'SET_DEEP_PROFILE':
      return { ...state, deepProfile: action.payload, isAnalyzing: false };
    case 'SET_ANALYZING':
      return { ...state, isAnalyzing: action.payload };
    case 'RESET_AGENT':
      return { ...initialState, active: state.active };
    default:
      return state;
  }
}

export function HiddenAgentProvider({ children }) {
  const [state, dispatch] = useReducer(agentReducer, initialState);
  const { state: chatState } = useChat();
  const { currentEmotion: visualEmotion, isActive: isVisionActive } = useVision();

  // Deep agentic analysis using LLM (asynchronous)
  const runDeepAnalysis = useCallback(async (text, context) => {
    dispatch({ type: 'SET_ANALYZING', payload: true });
    const profile = await performDeepAnalysis(text, context);
    if (profile) {
      dispatch({ type: 'SET_DEEP_PROFILE', payload: profile });
      
      // If LLM detects extreme stress or hidden needs, override the heuristic tone
      if (profile.stressLevel > 80 || profile.primaryEmotion === 'fear') {
        dispatch({ type: 'SET_TONE', payload: 'soothing' });
        dispatch({ type: 'SET_EMPATHY_LEVEL', payload: 100 });
      }
    } else {
      dispatch({ type: 'SET_ANALYZING', payload: false });
    }
  }, []);

  // Analyze text and detect mood using the shared service
  const runAnalysis = useCallback((text) => {
    if (!text) return;
    
    // 1. Immediate Heuristic Analysis (Fast)
    const analysis = analyzeText(text);

    // Merge Visual Emotion if available
    if (isVisionActive && visualEmotion) {
      analysis.detectedEmotions.push({ mood: visualEmotion, score: 2.0, source: 'vision' });
      
      // If visual emotion is negative, boost stress level
      if (['sad', 'angry', 'fearful'].includes(visualEmotion)) {
        analysis.stressLevel = Math.min(100, analysis.stressLevel + 15);
      }
      
      // Override mood if visual confidence is high (heuristically)
      if (visualEmotion !== 'neutral' && analysis.mood === 'neutral') {
        analysis.mood = visualEmotion;
      }
    }

    dispatch({ type: 'SET_MOOD', payload: analysis.mood });
    dispatch({ type: 'SET_STRESS_LEVEL', payload: analysis.stressLevel });
    dispatch({ type: 'SET_DISTORTIONS', payload: analysis.distortions });
    dispatch({ type: 'SET_DETECTED_EMOTIONS', payload: analysis.detectedEmotions });
    
    dispatch({ type: 'ADD_MOOD_HISTORY', payload: { 
      mood: analysis.mood, 
      timestamp: new Date(), 
      stressLevel: analysis.stressLevel,
      distortions: analysis.distortions,
      score: analysis.emotionalScore
    } });

    // ML-inspired Dynamic Empathy & Tone Scaling
    const distortionMultiplier = 1 + (analysis.distortions.length * 0.2);
    let targetEmpathy = 50;

    if (analysis.stressLevel > 60 || analysis.distortions.length > 0) {
      targetEmpathy = Math.min(100, (state.empathyLevel + 25) * distortionMultiplier);
      dispatch({ type: 'SET_TONE', payload: 'soothing' });
    } else if (analysis.mood === 'happy') {
      targetEmpathy = Math.max(20, state.empathyLevel - 15);
      dispatch({ type: 'SET_TONE', payload: 'playful' });
    } else if (analysis.mood === 'sad') {
      targetEmpathy = Math.min(90, state.empathyLevel + 15);
      dispatch({ type: 'SET_TONE', payload: 'serious' });
    } else {
      targetEmpathy = 50;
      dispatch({ type: 'SET_TONE', payload: 'balanced' });
    }

    dispatch({ type: 'SET_EMPATHY_LEVEL', payload: targetEmpathy });

    // 2. Trigger Deep Agentic Analysis (LLM - Background)
    // We pass the last few messages for context
    const context = chatState.messages.slice(-5).map(m => m.content);
    runDeepAnalysis(text, context);

    return analysis;
  }, [state.empathyLevel, chatState.messages, runDeepAnalysis]);

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

    const baseTone = toneSettings[state.tone] || toneSettings.balanced;
    
    // Inject Deep Profile insights if available
    if (state.deepProfile) {
      return {
        ...baseTone,
        hiddenNeeds: state.deepProfile.hiddenNeeds,
        recommendedAction: state.deepProfile.recommendation
      };
    }

    return baseTone;
  }, [state.tone, state.deepProfile]);

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
