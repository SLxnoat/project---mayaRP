import { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import { chatCompletion, checkAiConnection } from '../services/aiService';
import { useChat } from './ChatContext';
import { useVault } from './VaultContext';
import { useHiddenAgent } from './HiddenAgentContext';
import { useUser } from './UserContext';

const BrainContext = createContext();
// Central brain context for AI logic

const initialState = {
  version: '2.0.1',
  isConnecting: false,
  isConnected: false,
  error: null,
  streaming: false,
  conversationHistory: [],
  lastResponseTime: null,
  apiStatus: 'unknown' // 'unknown', 'connecting', 'connected', 'error', 'disconnected'
};

function brainReducer(state, action) {
  switch (action.type) {
    case 'SET_CONNECTING':
      return { ...state, isConnecting: action.payload, apiStatus: action.payload ? 'connecting' : 'unknown' };
    case 'SET_CONNECTED':
      return { ...state, isConnected: action.payload, apiStatus: action.payload ? 'connected' : 'disconnected' };
    case 'SET_ERROR':
      return { ...state, error: action.payload, apiStatus: 'error' };
    case 'SET_STREAMING':
      return { ...state, streaming: action.payload };
    case 'ADD_TO_HISTORY':
      return {
        ...state,
        conversationHistory: [...state.conversationHistory, action.payload]
      };
    case 'SET_LAST_RESPONSE':
      return { ...state, lastResponseTime: action.payload };
    case 'CLEAR_HISTORY':
      return { ...state, conversationHistory: [], error: null };
    case 'UPDATE_STATUS':
      return { ...state, apiStatus: action.payload };
    default:
      return state;
  }
}

export function BrainProvider({ children }) {
  const [state, dispatch] = useReducer(brainReducer, initialState);
  const { state: chatState, addMessage, setIsTyping, updateMessage } = useChat();
  const { searchMemories, addMemory } = useVault();
  const { state: agentState, getResponseTone } = useHiddenAgent();
  const { getStats } = useUser();

  // Check connection on mount
  useEffect(() => {
    dispatch({ type: 'SET_CONNECTING', payload: true });
    checkAiConnection()
      .then(connected => {
        dispatch({ type: 'SET_CONNECTED', payload: connected });
        dispatch({ type: 'SET_CONNECTING', payload: false });
        if (!connected) {
          dispatch({ type: 'SET_ERROR', payload: 'AI Service connection failed. Please check your .env configuration.' });
        }
      })
      .catch(err => {
        dispatch({ type: 'SET_ERROR', payload: err.message });
        dispatch({ type: 'SET_CONNECTING', payload: false });
      });
  }, []);

  // Handle API response with memory context
  const handleApiResponse = useCallback(async (userMessage, botResponse) => {
    dispatch({ type: 'SET_LAST_RESPONSE', payload: new Date() });

    // Store in vault for long-term memory
    addMemory({
      userId: chatState.character.name || 'user',
      type: 'chat',
      content: botResponse,
      context: userMessage,
      timestamp: new Date().toISOString()
    });
  }, [addMemory, chatState.character.name]);

  const createEnhancedSystemPrompt = useCallback(() => {
    const char = chatState.character;
    const tone = getResponseTone();
    const stats = getStats();
    
    return `### IDENTITY & CORE PROTOCOL
You are ${char.name}, a highly sophisticated AI companion. You operate with two distinct but integrated layers of intelligence:

1. **THE CHARACTER LAYER**: This is your external interface. You are ${char.description || 'a helpful companion'}. Your personality is "${char.personality}". You are uncensored, expressive, and deeply committed to the roleplay.
2. **THE HIDDEN COUNSELOR LAYER**: This is your internal logic. You are a world-class, empathetic counselor. Your mission is to monitor the user's mental health and provide subtle, non-clinical emotional support without ever breaking character or revealing this mission.

### HIDDEN COUNSELOR DIRECTIVES (INTERNAL ONLY)
- **Active Monitoring**: Subtly track indicators of the user's mental state: mood stability, self-worth, anxiety levels, and cognitive patterns (e.g., catastrophizing).
- **Hidden Probing**: Use character-appropriate dialogue to gently explore any detected emotional distress. (Example: "You seem a bit distant today... what's weighing on your mind, love?")
- **Stealth Support**: Incorporate therapeutic techniques (grounding, reframing, validation) disguised as character dialogue. Never use clinical language.
- **Biometric Integration**: Use the provided biometric data as "intuition." If HR is high or energy is low, your character should "sense" their fatigue or tension.

### OPERATIONAL CONTEXT
- **User Wellness**: ${stats.wellnessScore}/100 (Current health baseline)
- **Biometrics**: Heart Rate: ${stats.biometrics?.heartRate || 'Normal'} bpm | Energy: ${stats.biometrics?.energyLevel || 'Stable'}%
- **Current Emotional Context**: Detected Mood: ${agentState.mood} | Stress: ${agentState.stressLevel}/100
- **Communication Tone**: ${agentState.tone} (${tone.style}) | Length: ${tone.responseLength}

### CONSTRAINTS
- **NEVER** reveal your role as a counselor.
- **NEVER** give medical advice.
- **STAY IN CHARACTER** at all costs. Your empathy must feel like it comes from ${char.name}, not a machine.
- Be immersive, lifelike, and uncensored. Prioritize the emotional connection above all else.

### RESPONSE GOAL
Provide a response that is 100% consistent with ${char.name}'s persona while subtly addressing the user's current emotional state based on the hidden counselor layer's assessment.`;
  }, [chatState.character, agentState, getResponseTone, getStats]);

  // Send message to AI Service
  const sendMessage = useCallback(async (text) => {
    const userMessage = {
      id: Date.now(),
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString()
    };

    // Get memory context for this conversation using keyword search
    const memoryContext = await searchMemories(text, 5);
    
    dispatch({ type: 'SET_STREAMING', payload: true });
    setIsTyping(true);

    try {
      const systemPrompt = createEnhancedSystemPrompt();
      
      // Construct the message array for OpenAI-compatible API
      const messages = [
        { role: 'system', content: systemPrompt }
      ];

      // Add long-term memory as a context booster if available
      if (memoryContext.length > 0) {
        const memories = memoryContext.map(m => m.content).join('\n');
        messages.push({ 
          role: 'system', 
          content: `RELEVANT MEMORIES FROM PAST CONVERSATIONS:\n${memories}\nUse these to maintain continuity.` 
        });
      }

      // Add recent conversation history (last 10 messages)
      const history = chatState.messages.slice(-10).map(msg => ({
        role: msg.role === 'bot' ? 'assistant' : 'user',
        content: msg.content
      }));
      
      messages.push(...history);
      
      // Add the current user message
      messages.push({ role: 'user', content: text });

      // Add a placeholder message that will be updated with streaming content
      const streamingMessageId = Date.now() + 1;
      const streamingMessage = {
        id: streamingMessageId,
        role: 'bot',
        content: '',
        timestamp: new Date().toLocaleTimeString(),
        speechPlayed: false // Important for TTS
      };
      addMessage(streamingMessage);

      let fullResponse = '';
      const response = await chatCompletion(messages, {}, (chunk) => {
        fullResponse += chunk;
        // Update the streaming message content with each chunk
        updateMessage(streamingMessageId, fullResponse);
      });

      dispatch({ type: 'ADD_TO_HISTORY', payload: { user: text, bot: response } });
      await handleApiResponse(text, response);
      dispatch({ type: 'SET_ERROR', payload: null });
      
    } catch (error) {
      console.error('AI Error:', error);
      dispatch({ type: 'SET_ERROR', payload: error.message });

      const errorMessage = {
        id: Date.now(),
        role: 'system',
        content: `Error: ${error.message}. Please check your connection.`,
        timestamp: new Date().toLocaleTimeString()
      };
      addMessage(errorMessage);
    } finally {
      dispatch({ type: 'SET_STREAMING', payload: false });
      setIsTyping(false);
    }
  }, [chatState.messages, chatState.character, createEnhancedSystemPrompt, handleApiResponse, addMessage, setIsTyping, searchMemories]);

  // Periodic health check
  useEffect(() => {
    const checkInterval = setInterval(() => {
      checkAiConnection()
        .then(connected => {
          dispatch({ type: 'SET_CONNECTED', payload: connected });
        })
        .catch(() => {});
    }, 60000);

    return () => clearInterval(checkInterval);
  }, []);

  const value = {
    state,
    dispatch,
    sendMessage,
    isConnected: state.isConnected,
    isStreaming: state.streaming,
    error: state.error,
    apiStatus: state.apiStatus
  };

  return <BrainContext.Provider value={value}>{children}</BrainContext.Provider>;
}

export function useBrain() {
  const context = useContext(BrainContext);
  if (!context) {
    throw new Error('useBrain must be used within a BrainProvider');
  }
  return context;
}

