import { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import { useBiometrics } from '../hooks/useBiometrics';

const UserContext = createContext();

const initialState = {
  profile: {
    name: '',
    age: null,
    gender: '',
    pronouns: 'they/them'
  },
  preferences: {
    tone: 'balanced',
    responseLength: 'moderate',
    interests: [],
    boundaries: []
  },
  personalData: {
    scent: '',
    height: '',
    build: '',
    style: '',
    kinks: [],
    triggers: []
  },
  moodHistory: [],
  lastLogin: null,
  totalMessages: 0
};

function userReducer(state, action) {
  switch (action.type) {
    case 'SET_PROFILE':
      return { ...state, profile: { ...state.profile, ...action.payload } };
    case 'SET_PREFERENCES':
      return { ...state, preferences: { ...state.preferences, ...action.payload } };
    case 'ADD_INTEREST':
      return {
        ...state,
        preferences: {
          ...state.preferences,
          interests: [...new Set([...state.preferences.interests, action.payload])]
        }
      };
    case 'REMOVE_INTEREST':
      return {
        ...state,
        preferences: {
          ...state.preferences,
          interests: state.preferences.interests.filter(i => i !== action.payload)
        }
      };
    case 'SET_PERSONAL_DATA':
      return { ...state, personalData: { ...state, ...action.payload } };
    case 'ADD_BOUNDARY':
      return {
        ...state,
        preferences: {
          ...state.preferences,
          boundaries: [...new Set([...state.preferences.boundaries, action.payload])]
        }
      };
    case 'SET_MOOD_HISTORY':
      return { ...state, moodHistory: action.payload };
    case 'INCREMENT_MESSAGES':
      return { ...state, totalMessages: state.totalMessages + 1 };
    case 'SET_LAST_LOGIN':
      return { ...state, lastLogin: action.payload };
    case 'RESET_USER':
      return initialState;
    default:
      return state;
  }
}

export function UserProvider({ children }) {
  const [state, dispatch] = useReducer(userReducer, initialState);
  const { biometrics, getWellnessScore, syncBiometrics } = useBiometrics();

  // Sync biometrics on login
  useEffect(() => {
    if (state.lastLogin) {
      syncBiometrics();
    }
  }, [state.lastLogin, syncBiometrics]);

  // Load user data from localStorage
  useEffect(() => {
    const loadUserData = () => {
      try {
        const saved = localStorage.getItem('maya-user');
        if (saved) {
          const userData = JSON.parse(saved);
          dispatch({ type: 'SET_PROFILE', payload: userData.profile || {} });
          dispatch({ type: 'SET_PREFERENCES', payload: userData.preferences || {} });
          dispatch({ type: 'SET_PERSONAL_DATA', payload: userData.personalData || {} });
          dispatch({ type: 'SET_MOOD_HISTORY', payload: userData.moodHistory || [] });
          dispatch({ type: 'SET_LAST_LOGIN', payload: new Date() });
        }
      } catch (error) {
        console.error('Failed to load user data:', error);
      }
    };

    loadUserData();
  }, []);

  // Save user data to localStorage
  useEffect(() => {
    try {
      const userData = {
        profile: state.profile,
        preferences: state.preferences,
        personalData: state.personalData,
        moodHistory: state.moodHistory
      };
      localStorage.setItem('maya-user', JSON.stringify(userData));
    } catch (error) {
      console.error('Failed to save user data:', error);
    }
  }, [state.profile, state.preferences, state.personalData, state.moodHistory]);

  // Update profile
  const updateProfile = useCallback((profile) => {
    dispatch({ type: 'SET_PROFILE', payload: profile });
  }, []);

  // Update preferences
  const updatePreferences = useCallback((preferences) => {
    dispatch({ type: 'SET_PREFERENCES', payload: preferences });
  }, []);

  // Add interest
  const addInterest = useCallback((interest) => {
    dispatch({ type: 'ADD_INTEREST', payload: interest });
  }, []);

  // Remove interest
  const removeInterest = useCallback((interest) => {
    dispatch({ type: 'REMOVE_INTEREST', payload: interest });
  }, []);

  // Update personal data
  const updatePersonalData = useCallback((personalData) => {
    dispatch({ type: 'SET_PERSONAL_DATA', payload: personalData });
  }, []);

  // Add boundary
  const addBoundary = useCallback((boundary) => {
    dispatch({ type: 'ADD_BOUNDARY', payload: boundary });
  }, []);

  // Update mood history
  const updateMoodHistory = useCallback((mood, score) => {
    dispatch({
      type: 'SET_MOOD_HISTORY',
      payload: [{ mood, score, timestamp: new Date() }, ...state.moodHistory].slice(0, 50)
    });
  }, [state.moodHistory]);

  // Increment message count
  const incrementMessages = useCallback(() => {
    dispatch({ type: 'INCREMENT_MESSAGES' });
  }, []);

  // Get user statistics
  const getStats = useCallback(() => {
    const moodDistribution = {};
    state.moodHistory.forEach(m => {
      moodDistribution[m.mood] = (moodDistribution[m.mood] || 0) + 1;
    });

    return {
      totalMessages: state.totalMessages,
      lastLogin: state.lastLogin,
      moodDistribution,
      interestsCount: state.preferences.interests.length,
      boundariesCount: state.preferences.boundaries.length,
      wellnessScore: getWellnessScore(),
      biometrics: biometrics
    };
  }, [state.totalMessages, state.lastLogin, state.moodHistory, state.preferences, getWellnessScore, biometrics]);

  // Reset all user data
  const resetData = useCallback(() => {
    if (confirm('Are you sure you want to reset all your data? This cannot be undone.')) {
      dispatch({ type: 'RESET_USER' });
      localStorage.removeItem('maya-user');
      localStorage.removeItem('maya-messages');
      localStorage.removeItem('maya-character');
      localStorage.removeItem('maya-vault');
    }
  }, []);

  const value = {
    state,
    updateProfile,
    updatePreferences,
    addInterest,
    removeInterest,
    updatePersonalData,
    addBoundary,
    updateMoodHistory,
    incrementMessages,
    getStats,
    resetData
  };

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser() {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}
