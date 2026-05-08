import { useState, useEffect, useRef, useCallback } from 'react';
import { useChat } from '../context/ChatContext';
import { useBrain } from '../context/BrainContext';
import { useHiddenAgent } from '../context/HiddenAgentContext';
import { useUser } from '../context/UserContext';
import { useVision } from '../context/VisionContext';
import { useSpeech } from '../hooks/useSpeech';
import VoiceVisualizer from './VoiceVisualizer';
import VisionIris from './VisionIris';

export default function ChatInterface() {
  // BUG-05 fixed: sendMessage lives in useBrain, not useChat
  // BUG-03 fixed: clearHistory and toggleVoice destructured from useChat
  const { state, dispatch, clearHistory, toggleVoice } = useChat();
  const { state: brainState, sendMessage, isStreaming, error: apiError } = useBrain();
  const { state: moodState, analyzeMood } = useHiddenAgent();
  const { getStats } = useUser();
  const { 
    recognizeSpeech, 
    stopListening, 
    listening, 
    interimTranscript, 
    analyser, 
    setOnSpeechRecognized 
  } = useSpeech();
  const [inputText, setInputText] = useState('');
  const [isVoiceSubmitting, setIsVoiceSubmitting] = useState(false);
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

  const handleSendMessage = useCallback(async (text = inputText) => {
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
  }, [inputText, addMessage, sendMessage]);

  // Handle auto-submit when mic stops
  const wasListening = useRef(false);
  useEffect(() => {
    if (wasListening.current && !listening && state.voiceSettings.autoSubmitVoice && inputText.trim()) {
      handleSendMessage(inputText);
    }
    wasListening.current = listening;
  }, [listening, state.voiceSettings.autoSubmitVoice, inputText, handleSendMessage]);

  // Auto-analyze mood when user types
  useEffect(() => {
    if (inputText.length > 10) {
      analyzeMood(inputText);
    }
  }, [inputText, analyzeMood]);


  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Q-04 fixed: use the useSpeech hook instead of raw SpeechRecognition
  const handleMicrophoneClick = useCallback(() => {
    if (listening) {
      stopListening();
      return;
    }

    setOnSpeechRecognized((transcript, isFinal) => {
      if (isFinal) {
        setInputText(prev => (prev + ' ' + transcript).trim());
      }
    });
    
    recognizeSpeech({ autoStop: state.voiceSettings.autoSubmitVoice });
  }, [listening, stopListening, recognizeSpeech, setOnSpeechRecognized, state.voiceSettings.autoSubmitVoice, handleSendMessage]);

  // Get current wellness score from stats
  const stats = getStats?.() || {};

  return (
    <div className="flex h-[100dvh] bg-slate-950 chat-container overflow-hidden">
      {/* Sidebar */}
      <aside className="w-80 glass-dark border-r border-white/5 flex flex-col overflow-hidden z-20">
        {/* Neural Vision Section */}
        <div className="p-4 border-b border-white/5">
          <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">Neural Vision</h3>
          <VisionIris />
        </div>

        {/* Character Info */}
        <div className="p-8 border-b border-white/5">
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-primary-500 to-indigo-500 rounded-full blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
              <img
                src={state.character.avatar}
                alt={state.character.name}
                className="relative w-24 h-24 rounded-full border-2 border-white/10 shadow-2xl animate-float"
              />
              <div className={`absolute bottom-1 right-1 w-5 h-5 rounded-full border-4 border-slate-900 ${
                brainState.apiStatus === 'connected' ? 'bg-emerald-500' :
                brainState.apiStatus === 'error' ? 'bg-rose-500' : 'bg-amber-500'
              }`}></div>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white tracking-tight">{state.character.name}</h2>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-widest mt-1">v2.0 Advanced Agent</p>
            </div>
          </div>
          <button
            onClick={() => setShowCharacterModal(true)}
            className="mt-6 w-full py-2.5 px-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm text-slate-300 transition-all flex items-center justify-center gap-2 group"
          >
            <svg className="w-4 h-4 text-slate-400 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Edit Persona
          </button>
        </div>

        {/* Mood Status */}
        <div className="p-6 border-b border-white/5 bg-white/5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Condition</span>
            <span className={`text-xs font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${
              moodState.mood === 'happy' ? 'bg-emerald-500/10 text-emerald-400' :
              moodState.mood === 'stressed' ? 'bg-rose-500/10 text-rose-400' :
              moodState.mood === 'sad' ? 'bg-sky-500/10 text-sky-400' :
              moodState.mood === 'excited' ? 'bg-violet-500/10 text-violet-400' :
              'bg-slate-500/10 text-slate-400'
            }`}>{moodState.mood}</span>
          </div>
          <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
            <div
              className={`h-full transition-all duration-1000 ease-out ${
                moodState.mood === 'happy' ? 'bg-emerald-500' :
                moodState.mood === 'stressed' ? 'bg-rose-500' :
                moodState.mood === 'sad' ? 'bg-sky-500' :
                moodState.mood === 'excited' ? 'bg-violet-500' :
                'bg-slate-500'
              }`}
              style={{ width: `${moodState.stressLevel}%` }}
            ></div>
          </div>
          <div className="flex justify-between mt-2">
            <span className="text-[10px] text-slate-600 font-bold uppercase">Stress Threshold</span>
            <span className="text-[10px] text-slate-400 font-bold">{moodState.stressLevel}%</span>
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
        <div className="p-6">
          <button
            onClick={toggleVoice}
            className={`w-full py-3 px-4 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-3 ${
              state.voiceSettings.enabled
                ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/25'
                : 'bg-white/5 text-slate-400 hover:bg-white/10 border border-white/5'
            }`}
          >
            <div className={`w-2 h-2 rounded-full ${state.voiceSettings.enabled ? 'bg-white animate-pulse' : 'bg-slate-600'}`}></div>
            {state.voiceSettings.enabled ? 'Voice Active' : 'Voice Inactive'}
          </button>
        </div>

        {/* Clear History */}
        <div className="mt-auto p-4 border-t border-gray-700">
          <button
            onClick={clearHistory}
            className="w-full py-2 px-4 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-sm transition-colors"
          >
            Clear History
          </button>
        </div>
      </aside>

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col relative">
        {/* Header */}
        <header className="h-20 border-b border-white/5 flex items-center justify-between px-8 glass z-10">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-white tracking-tight">Maya</h1>
              <span className="px-2 py-0.5 rounded bg-primary-500/10 text-primary-400 text-[10px] font-bold uppercase tracking-widest border border-primary-500/20">Pro</span>
            </div>
            <div className="flex items-center space-x-3 mt-1">
              <span className="text-[11px] text-slate-500 font-medium">{state.character.personality}</span>
              {brainState.apiStatus === 'connected' && (
                <span className="flex items-center text-[10px] text-emerald-400 font-bold uppercase tracking-wider">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse"></div>
                  Neural Link Online
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
              onClick={() => analyzeMood(inputText)}
              className={`p-2 rounded-full transition-colors ${
                moodState.active ? 'bg-red-500 animate-pulse' : 'bg-gray-700 hover:bg-gray-600'
              }`}
              title="Trigger Hidden Agent Analysis"
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
              className={`flex items-end gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : msg.role === 'system' ? 'justify-center' : 'flex-row'} animate-slide-up`}
            >
              {msg.role !== 'system' && (
                <img
                  src={msg.role === 'user' ? `https://ui-avatars.com/api/?name=User&background=6366f1&color=fff` : state.character.avatar}
                  alt={msg.role}
                  className="w-8 h-8 rounded-full border border-white/10 mb-1 flex-shrink-0"
                />
              )}
              <div
                className={`max-w-[75%] p-4 rounded-2xl ${
                  msg.role === 'user'
                    ? 'message-user rounded-br-none text-white'
                    : msg.role === 'system'
                    ? 'bg-amber-500/10 border border-amber-500/20 text-amber-200 rounded-xl text-sm py-2 px-4'
                    : 'message-bot rounded-bl-none text-slate-100'
                }`}
              >
                <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                {msg.role !== 'system' && (
                  <div className="flex items-center justify-end gap-2 mt-2 opacity-40">
                    <span className="text-[10px] font-medium">{msg.timestamp}</span>
                  </div>
                )}
                {/* Streaming indicator dots */}
                {msg.role === 'bot' && brainState.isStreaming && msg.content.length > 0 && (
                  <div className="flex space-x-1 mt-2">
                    <div className="w-1 h-1 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-1 h-1 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-1 h-1 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                )}
              </div>
            </div>
          ))}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-6 relative z-10">
          <div className="max-w-4xl mx-auto glass p-2 rounded-2xl shadow-2xl">
            <div className="flex items-end gap-2">
              <button
                onClick={handleMicrophoneClick}
                className={`p-4 rounded-xl transition-all duration-300 ${
                  listening 
                    ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/40 glow-primary' 
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
                title={listening ? 'Stop Listening' : 'Voice Input'}
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
                  placeholder={listening ? 'Listening to your voice...' : "Send a message..."}
                  className={`w-full p-4 pr-12 bg-transparent text-white rounded-xl border-none focus:ring-0 resize-none h-16 transition-all font-medium placeholder-slate-500`}
                  rows={1}
                  style={{ minHeight: '4rem' }}
                />
              
              {/* Interim Transcript Overlay */}
              {listening && interimTranscript && (
                <div className="absolute inset-0 p-4 bg-slate-900/95 text-primary-400 font-medium italic flex items-center rounded-xl pointer-events-none animate-fade-in">
                  <span className="opacity-50 mr-2">“</span>
                  {interimTranscript}
                  <span className="animate-pulse">...</span>
                </div>
              )}
              {/* Character count indicator */}
              <div className="absolute bottom-3 right-3 text-xs text-gray-500">
                {inputText.length} chars
              </div>
            </div>

              <button
                onClick={() => handleSendMessage()}
                disabled={!inputText.trim()}
                className={`p-4 rounded-xl transition-all duration-300 ${
                  inputText.trim()
                    ? 'bg-primary-500 hover:bg-primary-400 text-white shadow-lg shadow-primary-500/30'
                    : 'text-slate-600'
                }`}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
            
            <VoiceVisualizer analyser={analyser} isActive={listening} />
          </div>
          <div className="flex justify-center mt-3">
             <div className="flex items-center gap-4 text-[10px] font-bold text-slate-600 uppercase tracking-widest">
              <span>Enter to Send</span>
              <div className="w-1 h-1 rounded-full bg-slate-800"></div>
              <span>Shift+Enter for New Line</span>
              {moodState.active && (
                <>
                  <div className="w-1 h-1 rounded-full bg-slate-800"></div>
                  <span className="text-emerald-500/70">Neural Processor Active</span>
                </>
              )}
            </div>
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