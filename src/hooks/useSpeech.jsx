import { useState, useEffect, useRef, useCallback } from 'react';

export function useSpeech() {
  const [speaking, setSpeaking] = useState(false);
  const [available, setAvailable] = useState(false);
  const [listening, setListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [voices, setVoices] = useState([]);
  
  const synthRef = useRef(null);
  const recognitionRef = useRef(null);
  const onSpeechRecognizedRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const streamRef = useRef(null);
  const silenceTimerRef = useRef(null);

  // Speech queue for handling multiple messages
  const speechQueue = useRef([]);
  const isProcessingQueue = useRef(false);

  useEffect(() => {
    const synth = window.speechSynthesis;
    setAvailable(!!synth);

    if (synth) {
      synthRef.current = synth;

      // Load voices
      const loadVoices = () => {
        setVoices(synth.getVoices());
      };
      loadVoices();
      if (synth.onvoiceschanged !== undefined) {
        synth.onvoiceschanged = loadVoices;
      }
    }

    if (window.SpeechRecognition || window.webkitSpeechRecognition) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.continuous = true; // Changed to true for better flow
      recognition.interimResults = true; // Changed to true for real-time feedback
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setListening(true);
        setInterimTranscript('');
      };

      recognition.onresult = (event) => {
        let interim = '';
        let final = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            final += event.results[i][0].transcript;
          } else {
            interim += event.results[i][0].transcript;
          }
        }

        if (interim) {
          setInterimTranscript(interim);
          resetSilenceTimer();
        }

        if (final && onSpeechRecognizedRef.current) {
          onSpeechRecognizedRef.current(final, true); // true means isFinal
          setInterimTranscript('');
          resetSilenceTimer();
        }
      };

      recognition.onend = () => {
        setListening(false);
        setInterimTranscript('');
        stopAudioAnalysis();
      };

      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setListening(false);
        stopAudioAnalysis();
      };

      recognitionRef.current = recognition;
    }

    return () => {
      if (recognitionRef.current) recognitionRef.current.stop();
      stopAudioAnalysis();
    };
  }, []);

  const resetSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    
    // Auto-stop after 2 seconds of silence if listening
    silenceTimerRef.current = setTimeout(() => {
      if (recognitionRef.current && listening) {
        console.log('Silence detected, stopping recognition');
        recognitionRef.current.stop();
      }
    }, 2500);
  }, [listening]);

  const startAudioAnalysis = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;
      
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      
      return analyser;
    } catch (error) {
      console.error('Error starting audio analysis:', error);
      return null;
    }
  };

  const stopAudioAnalysis = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
  };

  const recognizeSpeech = async (options = {}) => {
    if (!recognitionRef.current) {
      alert('Voice recognition is not supported in this browser.');
      return;
    }

    try {
      if (options.lang) recognitionRef.current.lang = options.lang;
      
      await startAudioAnalysis();
      recognitionRef.current.start();
      setListening(true);
      
      if (options.autoStop) {
        resetSilenceTimer();
      }
    } catch (error) {
      console.error('Error starting speech recognition:', error);
      if (error.name !== 'InvalidStateError') {
        setListening(false);
      }
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setListening(false);
      stopAudioAnalysis();
    }
  };

  // Process the next item in the speech queue
  const processQueue = useCallback(() => {
    if (isProcessingQueue.current || speechQueue.current.length === 0 || !synthRef.current) {
      return;
    }

    isProcessingQueue.current = true;
    const { text, settings, resolve } = speechQueue.current[0];

    const utterance = new SpeechSynthesisUtterance(text);

    // Get available voices
    const currentVoices = synthRef.current.getVoices();
    const preferredVoice = currentVoices.find(v => 
      v.name === settings.selectedVoice
    ) || currentVoices.find(v =>
      v.lang.includes('en') && !v.name.toLowerCase().includes('google') && !v.name.toLowerCase().includes('zira')
    ) || currentVoices.find(v => v.lang.includes('en'));

    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    utterance.rate = settings.speechRate || 1;
    utterance.pitch = settings.speechPitch || 1;
    utterance.volume = 1;

    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => {
      setSpeaking(false);
      speechQueue.current.shift();
      isProcessingQueue.current = false;
      processQueue();
      if (resolve) resolve();
    };
    utterance.onerror = () => {
      setSpeaking(false);
      speechQueue.current.shift();
      isProcessingQueue.current = false;
      processQueue();
      if (resolve) resolve();
    };

    synthRef.current.speak(utterance);
  }, []);

  const speak = (text, settings = {}) => {
    if (!synthRef.current) return;
    if (!text) return;

    return new Promise((resolve) => {
      speechQueue.current.push({ text, settings, resolve });
      if (!isProcessingQueue.current && !speaking) {
        processQueue();
      }
    });
  };

  const cancelSpeech = useCallback(() => {
    if (synthRef.current) {
      synthRef.current.cancel();
      speechQueue.current = [];
      isProcessingQueue.current = false;
      setSpeaking(false);
    }
  }, []);

  const setOnSpeechRecognized = (callback) => {
    onSpeechRecognizedRef.current = callback;
  };

  return {
    speaking,
    available,
    listening,
    interimTranscript,
    voices,
    analyser: analyserRef.current,
    recognizeSpeech,
    stopListening,
    speak,
    cancelSpeech,
    setOnSpeechRecognized,
  };
}

