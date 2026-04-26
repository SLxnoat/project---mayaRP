import { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import { useSpeech } from '../hooks/useSpeech';
import { useVault } from './VaultContext';
import { useUser } from './UserContext';

const ChatContext = createContext();

const initialState = {
  messages: [],
  isTyping: false,
  character: {
    name: 'Maya',
    description: 'A highly responsive AI companion for roleplay adventures.',
    personality: 'friendly, engaging, creative, uncensored',
    avatar: 'https://ui-avatars.com/api/?name=Maya&background=0ea5e9&color=fff',
  },
  voiceSettings: {
    enabled: false,
    speechRate: 1,
    speechPitch: 1,
    selectedVoice: null,
  },
  conversationSettings: {
    maxContext: 10,
    temperature: 0.7,
    responseLength: 'moderate',
  },
};

function chatReducer(state, action) {
  switch (action.type) {
    case 'ADD_MESSAGE':
      return {
        ...state,
        messages: [...state.messages, action.payload],
        isTyping: false,
      };
    case 'SET_TYPING':
      return { ...state, isTyping: action.payload };
    case 'SET_CHARACTER':
      return { ...state, character: action.payload };
    case 'TOGGLE_VOICE':
      return {
        ...state,
        voiceSettings: { ...state.voiceSettings, enabled: !state.voiceSettings.enabled },
      };
    case 'UPDATE_VOICE_SETTINGS':
      return {
        ...state,
        voiceSettings: { ...state.voiceSettings, ...action.payload },
      };
    case 'UPDATE_CONVERSATION_SETTINGS':
      return {
        ...state,
        conversationSettings: { ...state.conversationSettings, ...action.payload },
      };
    case 'CLEAR_HISTORY':
      return { ...state, messages: [] };
    case 'SET_MESSAGES':
      return { ...state, messages: action.payload };
    case 'UPDATE_MESSAGE':
      return {
        ...state,
        messages: state.messages.map(msg =>
          msg.id === action.payload.messageId
            ? { ...msg, content: action.payload.content }
            : msg
        )
      };
    case 'SET_SPEECH_PLAYED':
      return {
        ...state,
        messages: state.messages.map((msg, idx)) =>
          idx === state.messages.length - 1 ? { ...msg, speechPlayed: true } : msg
        ),
      };
    default:
      return state;
  }
}

export function ChatProvider({ children }) {
  const [state, dispatch] = useReducer(chatReducer, initialState);
  const { speak, cancelSpeech, available: speechAvailable } = useSpeech();
  const { addMemory, getMemory } = useVault();
  const { incrementMessages, updateMoodHistory } = useUser();

  // Load saved settings
  useEffect(() => {
    const savedCharacter = localStorage.getItem('maya-character');
    const savedMessages = localStorage.getItem('maya-messages');
    const savedVoice = localStorage.getItem('maya-voice');

    if (savedCharacter) {
      dispatch({ type: 'SET_CHARACTER', payload: JSON.parse(savedCharacter) });
    }
    if (savedMessages) {
      const savedMsgs = JSON.parse(savedMessages);
      if (Array.isArray(savedMsgs)) {
        dispatch({ type: 'SET_MESSAGES', payload: savedMsgs });
      }
    }
    if (savedVoice) {
      dispatch({ type: 'UPDATE_VOICE_SETTINGS', payload: JSON.parse(savedVoice) });
    }
  }, []);

  // Save character settings
  useEffect(() => {
    localStorage.setItem('maya-character', JSON.stringify(state.character));
  }, [state.character]);

  // Save messages
  useEffect(() => {
    localStorage.setItem('maya-messages', JSON.stringify(state.messages));
  }, [state.messages]);

  // Save voice settings
  useEffect(() => {
    localStorage.setItem('maya-voice', JSON.stringify(state.voiceSettings));
  }, [state.voiceSettings]);

  // Handle bot speech when new message added
  useEffect(() => {
    if (state.voiceSettings.enabled && state.messages.length > 0) {
      const lastMessage = state.messages[state.messages.length - 1];
      if (lastMessage.role === 'bot' && !lastMessage.speechPlayed) {
        speak(lastMessage.content, {
          speechRate: state.voiceSettings.speechRate,
          speechPitch: state.voiceSettings.speechPitch,
        }).then(() => {
          dispatch({ type: 'SET_SPEECH_PLAYED' });
        });
      }
    }
  }, [state.messages, state.voiceSettings.enabled, speak]);

  const value = {
    state,
    dispatch,
    addMessage: useCallback((message) => {
      dispatch({ type: 'ADD_MESSAGE', payload: message });
    }, []),
    setIsTyping: useCallback((typing) => {
      dispatch({ type: 'SET_TYPING', payload: typing });
    }, []),
    updateMessage: useCallback((messageId, content) => {
      dispatch({ type: 'UPDATE_MESSAGE', payload: { messageId, content } });
    }, []),
    setCharacter: useCallback((character) => {
      dispatch({ type: 'SET_CHARACTER', payload: character });
    }, []),
    toggleVoice: useCallback(() => {
      dispatch({ type: 'TOGGLE_VOICE' });
    }, []),
    updateVoiceSettings: useCallback((settings) => {
      dispatch({ type: 'UPDATE_VOICE_SETTINGS', payload: settings });
    }, []),
    updateConversationSettings: useCallback((settings) => {
      dispatch({ type: 'UPDATE_CONVERSATION_SETTINGS', payload: settings });
    }, []),
    clearHistory: useCallback(() => {
      if (confirm('Are you sure you want to clear the conversation history?')) {
        dispatch({ type: 'CLEAR_HISTORY' });
        cancelSpeech();
      }
    }, []),
    speechAvailable,
    getMemory,
    addMemory,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
}
