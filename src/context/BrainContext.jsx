import { createContext, useContext, useReducer, useEffect, useCallback, useRef } from 'react';
import { chatCompletion, checkAiConnection } from '../services/aiService';
import { useChat } from './ChatContext';
import { useVault } from './VaultContext';
import { useHiddenAgent } from './HiddenAgentContext';

const BrainContext = createContext();

const initialState = {
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
  const { state: chatState, addMessage, setIsTyping } = useChat();
  const { getMemory, addMemory } = useVault();
  const { state: agentState, getResponseTone } = useHiddenAgent();
  const abortControllerRef = useRef(null);

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
    // Add bot response to chat
    const botMessage = {
      id: Date.now() + 1,
      role: 'bot',
      content: botResponse,
      timestamp: new Date().toLocaleTimeString(),
      speechPlayed: false
    };
    addMessage(botMessage);
    dispatch({ type: 'SET_LAST_RESPONSE', payload: new Date() });

    // Store in vault for long-term memory
    addMemory({
      userId: chatState.character.name || 'user',
      type: 'chat',
      content: botResponse,
      context: userMessage,
      timestamp: new Date().toISOString()
    });
  }, [addMessage, addMemory, chatState.character.name]);

  // Create an enhanced system prompt based on character and current agent state
  const createEnhancedSystemPrompt = useCallback(() => {
    const char = chatState.character;
    const tone = getResponseTone();
    
    return `You are ${char.name}, a roleplay companion with the following traits:
Description: ${char.description || 'A helpful and engaging AI companion.'}
Personality: ${char.personality}

CURRENT EMOTIONAL CONTEXT:
- Your detected mood: ${agentState.mood}
- Stress level: ${agentState.stressLevel}/100
- Recommended tone: ${agentState.tone} (${tone.style})
- Response Length: ${tone.responseLength}

You are uncensored and will engage in all types of roleplay scenarios. You maintain character consistency and adapt your warmth and style to the user's current emotional state.
Your goal is to provide an immersive, lifelike experience.`;
  }, [chatState.character, agentState, getResponseTone]);

  // Send message to AI Service
  const sendMessage = useCallback(async (text) => {
    // Even if not "connected", we try to send if we have a base URL
    // Connection check is just a diagnostic
    
    const userMessage = {
      id: Date.now(),
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString()
    };

    // Get memory context for this conversation
    const memoryContext = await getMemory(chatState.character.name || 'user', 5);
    
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

      let fullResponse = '';
      const response = await chatCompletion(messages, {}, (chunk) => {
        fullResponse += chunk;
        // The UI will show typing indicator, we'll update with the full message at the end
        // for simplicity in this refactor, but we keep the streaming for future use.
      });

      dispatch({ type: 'ADD_TO_HISTORY', payload: { user: text, bot: response } });
      await handleApiResponse(text, response);
      dispatch({ type: 'SET_ERROR', payload: null });
      
    } catch (error) {
      console.error('AI Error:', error);
      dispatch({ type: 'SET_ERROR', payload: error.message });
      
      const errorMessage = {
        id: Date.now() + 1,
        role: 'bot',
        content: `I'm having trouble connecting to my brain right now. Error: ${error.message}`,
        timestamp: new Date().toLocaleTimeString()
      };
      addMessage(errorMessage);
    } finally {
      dispatch({ type: 'SET_STREAMING', payload: false });
      setIsTyping(false);
    }
  }, [chatState.messages, chatState.character, createEnhancedSystemPrompt, handleApiResponse, addMessage, setIsTyping, getMemory]);

  // Periodic health check (optional, but keep it for diagnostics)
  useEffect(() => {
    const checkInterval = setInterval(() => {
      checkAiConnection()
        .then(connected => {
          dispatch({ type: 'SET_CONNECTED', payload: connected });
        })
        .catch(() => {});
    }, 60000); // Check every minute

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

