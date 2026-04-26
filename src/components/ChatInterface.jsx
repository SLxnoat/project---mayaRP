import { useState, useEffect, useRef, useCallback } from 'react';
import { useChat } from '../context/ChatContext';
import { useBrain } from '../context/BrainContext';
import { useHiddenAgent } from '../context/HiddenAgentContext';
import { useUser } from '../context/UserContext';
import { useSpeech } from '../hooks/useSpeech';

// Sentiment analysis keywords for mood detection
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

export default function ChatInterface() {
  const { state, sendMessage, isStreaming, apiError, dispatch } = useChat();
  const { state: brainState } = useBrain();
  const { state: moodState, analyzeMood } = useHiddenAgent();
  const { state: userState, getStats } = useUser();
  const [inputText, setInputText] = useState('');
  const [showCharacterModal, setShowCharacterModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [state.messages, state.isTyping, isStreaming]);

  // Helper to add message without going through Brain (for system messages)
  const addMessage = useCallback((message) => {
    dispatch({ type: 'ADD_MESSAGE', payload: message });
  }, [dispatch]);

  // Auto-analyze mood when user types
  useEffect(() => {
    if (inputText.length > 10) {
      analyzeMood(inputText);
    }
  }, [inputText, analyzeMood]);

  const handleSendMessage = async (text = inputText) => {
    if (!text.trim()) return;

    const userMessage = {
      id: Date.now(),
      role: 'user',
      content: text.trim(),
      timestamp: new Date().toLocaleTimeString(),
    };

    addMessage(userMessage);
    setInputText('');

    // Send to AI Service via Brain context
    await sendMessage(text.trim());
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleMicrophoneClick = () => {
    if (typeof window !== 'undefined' && window.SpeechRecognition) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setInputText(transcript);
        // Auto-send after voice input
        handleSendMessage(transcript);
      };

      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
      };

      recognition.start();
    } else {
      alert('Voice input is not supported in this browser. Please use Chrome or Edge.');
    }
  };

  // Get current wellness score from stats
  const stats = getStats?.() || {};

  return (
    <div className="flex h-[100dvh] bg-gray-900">
      {/* Sidebar */}
      <aside className="w-80 bg-gray-800 border-r border-gray-700 flex flex-col overflow-hidden">
        {/* Character Info */}
        <div className="p-6 border-b border-gray-700">
          <div className="flex items-center space-x-4">
            <div className="relative">
              <img
                src={state.character.avatar}
                alt={state.character.name}
                className="w-16 h-16 rounded-full ring-2 ring-primary-500 shadow-lg"
              />
              <div className={`absolute bottom-0 right-0 w-4 h-4 rounded-full border-2 border-gray-800 ${
                brainState.apiStatus === 'connected' ? 'bg-green-500' :
                brainState.apiStatus === 'error' ? 'bg-red-500' : 'bg-yellow-500'
              }`}></div>
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">{state.character.name}</h2>
              <p className="text-xs text-gray-400">v2.0 Agentic AI</p>
            </div>
          </div>
          <button
            onClick={() => setShowCharacterModal(true)}
            className="mt-4 w-full py-2 px-4 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm text-gray-300 transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Edit Character
          </button>
        </div>

        {/* Mood Status */}
        <div className="p-4 border-b border-gray-700 bg-gray-800/50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-400">Current Mood</span>
            <span className={`text-sm font-semibold capitalize ${
              moodState.mood === 'happy' ? 'text-green-400' :
              moodState.mood === 'stressed' ? 'text-red-400' :
              moodState.mood === 'sad' ? 'text-blue-400' :
              moodState.mood === 'excited' ? 'text-purple-400' :
              'text-gray-300'
            }`}>{moodState.mood}</span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-500 ${
                moodState.mood === 'happy' ? 'bg-green-500' :
                moodState.mood === 'stressed' ? 'bg-red-500' :
                moodState.mood === 'sad' ? 'bg-blue-500' :
                moodState.mood === 'excited' ? 'bg-purple-500' :
                'bg-gray-400'
              }`}
              style={{ width: `${moodState.stressLevel}%` }}
            ></div>
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-xs text-gray-500">Stress Level</span>
            <span className="text-xs text-gray-400">{moodState.stressLevel}/100</span>
          </div>
        </div>

        {/* User Stats */}
        <div className="p-4 border-b border-gray-700">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-700/50 rounded-lg p-3">
              <div className="text-xs text-gray-400 mb-1">Messages</div>
              <div className="text-lg font-semibold text-white">{state.messages.length}</div>
            </div>
            <div className="bg-gray-700/50 rounded-lg p-3">
              <div className="text-xs text-gray-400 mb-1">Wellness</div>
              <div className="text-lg font-semibold text-white">{stats.wellnessScore}%</div>
            </div>
          </div>
        </div>

        {/* Voice Settings */}
        <div className="p-4 border-b border-gray-700">
          <button
            onClick={state.toggleVoice}
            className={`w-full py-2 px-4 rounded-lg text-sm transition-colors flex items-center justify-center gap-2 ${
              state.voiceSettings.enabled
                ? 'bg-primary-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
            {state.voiceSettings.enabled ? 'Voice ON' : 'Voice OFF'}
          </button>
        </div>

        {/* Clear History */}
        <div className="mt-auto p-4 border-t border-gray-700">
          <button
            onClick={state.clearHistory}
            className="w-full py-2 px-4 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-sm transition-colors"
          >
            Clear History
          </button>
        </div>
      </aside>

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col bg-gradient-to-b from-gray-900 to-gray-800">
        {/* Header */}
        <header className="h-16 border-b border-gray-700 flex items-center justify-between px-6 bg-gray-900/80 backdrop-blur">
          <div>
            <h1 className="text-lg font-semibold text-white">Maya RP</h1>
            <div className="flex items-center space-x-4 text-xs">
              <span className="text-gray-400">{state.character.personality}</span>
              {brainState.apiStatus === 'connected' && (
                <span className="flex items-center text-green-400">
                  <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  AI Brain Online
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowAnalytics(!showAnalytics)}
              className={`p-2 rounded-full transition-colors ${
                showAnalytics ? 'bg-primary-600' : 'bg-gray-700 hover:bg-gray-600'
              }`}
              title="Analytics"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </button>
            <button
              onClick={handleMicrophoneClick}
              className={`p-2 rounded-full transition-colors ${
                moodState.active ? 'bg-red-500 animate-pulse' : 'bg-gray-700 hover:bg-gray-600'
              }`}
              title="Hidden Agent Active"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </button>
          </div>
        </header>

        {/* Analytics Panel */}
        {showAnalytics && (
          <div className="bg-gray-800 border-b border-gray-700 p-4 animate-fade-in">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <div className="text-xs text-gray-400 mb-1">Detected Mood</div>
                <div className="text-lg font-semibold capitalize">{moodState.mood}</div>
              </div>
              <div>
                <div className="text-xs text-gray-400 mb-1">Empathy Level</div>
                <div className="text-lg font-semibold">{moodState.empathyLevel}/100</div>
              </div>
              <div>
                <div className="text-xs text-gray-400 mb-1">Detected Emotions</div>
                <div className="text-sm text-gray-300 flex flex-wrap gap-1">
                  {moodState.detectedEmotions.slice(0, 3).map((e, i) => (
                    <span key={i} className="bg-gray-700 px-2 py-1 rounded text-xs">
                      {e.emotion}
                    </span>
                  ))}
                  {moodState.detectedEmotions.length === 0 && <span className="text-gray-500">None</span>}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {state.messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-24 h-24 bg-primary-500/10 rounded-full flex items-center justify-center mb-4">
                <svg className="w-12 h-12 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Start a New Adventure</h3>
              <p className="text-gray-400">Type a message to begin your roleplay session.</p>
              {apiError && (
                <div className="mt-4 p-3 bg-red-500/20 border border-red-500/50 rounded text-red-400 text-sm">
                  {apiError}
                </div>
              )}
            </div>
          )}

          {state.messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : msg.role === 'system' ? 'justify-center' : 'justify-start'} animate-slide-up`}
            >
              <div
                className={`max-w-[70%] p-4 rounded-2xl ${
                  msg.role === 'user'
                    ? 'bg-primary-600 text-white rounded-br-none'
                    : msg.role === 'system'
                    ? 'bg-yellow-500/20 border border-yellow-500/50 text-yellow-200 rounded-none max-w-full'
                    : 'bg-gray-700 text-gray-100 rounded-bl-none'
                }`}
              >
                <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                {msg.role !== 'system' && (
                  <span className="text-xs opacity-50 mt-2 block text-right">
                    {msg.timestamp}
                  </span>
                )}
                {/* Streaming indicator dots (only for bot messages that are being built) */}
                {msg.role === 'bot' && brainState.isStreaming && msg.content.length > 0 && (
                  <div className="flex space-x-1 mt-2">
                    <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                )}
              </div>
            </div>
          ))}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 bg-gray-900 border-t border-gray-700">
          <div className="flex items-end space-x-2">
            <button
              onClick={handleMicrophoneClick}
              className="p-3 text-gray-400 hover:text-primary-500 hover:bg-gray-800 rounded-xl transition-colors"
              title="Voice Input"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </button>

            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type your message..."
                className="w-full p-4 pr-12 bg-gray-800 text-white rounded-xl border-2 border-transparent focus:border-primary-500 focus:ring-0 resize-none h-16 transition-all"
                rows={1}
                style={{ minHeight: '4rem' }}
              />
              {/* Word count indicator */}
              <div className="absolute bottom-3 right-3 text-xs text-gray-500">
                {inputText.length} words
              </div>
            </div>

            <button
              onClick={() => handleSendMessage()}
              disabled={!inputText.trim()}
              className={`p-3 rounded-xl transition-all ${
                inputText.trim()
                  ? 'bg-primary-600 hover:bg-primary-700 text-white shadow-lg shadow-primary-500/30'
                  : 'bg-gray-800 text-gray-500 cursor-not-allowed'
              }`}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
          <div className="flex justify-between mt-2 text-xs text-gray-500">
            <span>Press Enter to send, Shift+Enter for new line</span>
            {moodState.active && (
              <span className="flex items-center gap-1">
                <svg className="w-3 h-3 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Hidden Agent Active
              </span>
            )}
          </div>
        </div>
      </main>

      {/* Character Edit Modal */}
      {showCharacterModal && (
        <CharacterModal
          character={state.character}
          onClose={() => setShowCharacterModal(false)}
          onSave={(char) => {
            dispatch({ type: 'SET_CHARACTER', payload: char });
          }}
        />
      )}
    </div>
  );
}

function CharacterModal({ character, onClose, onSave }) {
  const [name, setName] = useState(character.name);
  const [description, setDescription] = useState(character.description);
  const [personality, setPersonality] = useState(character.personality);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      name,
      description,
      personality,
      avatar: `https://ui-avatars.com/api/?name=${name}&background=0ea5e9&color=fff`,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
      <div className="bg-gray-800 rounded-2xl p-6 max-w-md w-full shadow-2xl border border-gray-700">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-white">Edit Character</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full p-3 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-primary-500 focus:ring-0"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full p-3 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-primary-500 focus:ring-0 h-24 resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Personality</label>
            <input
              type="text"
              value={personality}
              onChange={(e) => setPersonality(e.target.value)}
              className="w-full p-3 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-primary-500 focus:ring-0"
              placeholder="e.g., friendly, engaging, creative, uncensored"
            />
          </div>

          <div className="flex justify-end space-x-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-300 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
            >
              Save Character
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}