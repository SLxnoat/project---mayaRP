import { createContext, useContext, useReducer, useEffect, useCallback } from 'react';

const VaultContext = createContext();

// Default memory configuration
const MEMORY_CONFIG = {
  maxMemoryItems: 100,
  maxContextItems: 10,
  memoryRetentionDays: 30,
  embeddingDimension: 768
};

const initialState = {
  memories: [],
  loading: false,
  error: null,
  config: MEMORY_CONFIG
};

function vaultReducer(state, action) {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_MEMORIES':
      return { ...state, memories: action.payload, error: null };
    case 'ADD_MEMORY':
      return {
        ...state,
        memories: [action.payload, ...state.memories].slice(0, state.config.maxMemoryItems)
      };
    case 'SET_ERROR':
      return { ...state, error: action.payload, loading: false };
    case 'CLEAR_MEMORIES':
      return { ...state, memories: [], loading: false };
    case 'UPDATE_CONFIG':
      return { ...state, config: { ...state.config, ...action.payload } };
    default:
      return state;
  }
}

export function VaultProvider({ children }) {
  const [state, dispatch] = useReducer(vaultReducer, initialState);

  // Load memories from localStorage on mount
  useEffect(() => {
    const loadMemories = () => {
      try {
        const saved = localStorage.getItem('maya-vault');
        if (saved) {
          const memories = JSON.parse(saved);
          dispatch({ type: 'SET_MEMORIES', payload: memories });
        }
      } catch (error) {
        console.error('Failed to load vault memories:', error);
        dispatch({ type: 'SET_ERROR', payload: 'Failed to load memory vault' });
      }
    };

    loadMemories();
  }, []);

  // Save memories to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem('maya-vault', JSON.stringify(state.memories));
    } catch (error) {
      console.error('Failed to save vault memories:', error);
    }
  }, [state.memories]);

  // Add a new memory to the vault
  const addMemory = useCallback((memory) => {
    dispatch({ type: 'ADD_MEMORY', payload: memory });
  }, []);

  // Get relevant memories for a user/context
  const getMemory = useCallback(async (userId, limit = 5) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });

      // Filter memories by user
      const userMemories = state.memories.filter(
        m => m.userId === userId || m.type === 'general'
      );

      // Sort by timestamp (newest first)
      const sortedMemories = userMemories
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      // Return most recent memories within limit
      const relevantMemories = sortedMemories.slice(0, limit);

      dispatch({ type: 'SET_LOADING', payload: false });

      return relevantMemories;
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error.message });
      return [];
    }
  }, [state.memories]);

  // Search memories by keyword
  const searchMemories = useCallback((query, limit = 10) => {
    const queryLower = query.toLowerCase();
    const results = state.memories.filter(
      m => m.content.toLowerCase().includes(queryLower) ||
           m.context?.toLowerCase().includes(queryLower)
    );
    return results.slice(0, limit);
  }, [state.memories]);

  // Get memories by type
  const getMemoriesByType = useCallback((type, limit = 20) => {
    return state.memories
      .filter(m => m.type === type)
      .slice(0, limit);
  }, [state.memories]);

  // Get all unique users from vault
  const getUniqueUsers = useCallback(() => {
    const users = new Set(state.memories.map(m => m.userId));
    return Array.from(users);
  }, [state.memories]);

  // Clear all memories
  const clearMemories = useCallback(() => {
    if (confirm('Are you sure you want to clear all memories? This cannot be undone.')) {
      dispatch({ type: 'CLEAR_MEMORIES' });
    }
  }, []);

  // Update vault configuration
  const updateConfig = useCallback((config) => {
    dispatch({ type: 'UPDATE_CONFIG', payload: config });
  }, []);

  // Get vault statistics
  const getStats = useCallback(() => {
    const typeCounts = {};
    state.memories.forEach(m => {
      typeCounts[m.type] = (typeCounts[m.type] || 0) + 1;
    });

    return {
      totalMemories: state.memories.length,
      uniqueUsers: getUniqueUsers().length,
      typeCounts,
      lastUpdated: state.memories.length > 0
        ? state.memories[0].timestamp
        : null
    };
  }, [state.memories, getUniqueUsers]);

  const value = {
    state,
    addMemory,
    getMemory,
    searchMemories,
    getMemoriesByType,
    getUniqueUsers,
    clearMemories,
    updateConfig,
    getStats,
    isLoading: state.loading,
    error: state.error
  };

  return <VaultContext.Provider value={value}>{children}</VaultContext.Provider>;
}

export function useVault() {
  const context = useContext(VaultContext);
  if (!context) {
    throw new Error('useVault must be used within a VaultProvider');
  }
  return context;
}
