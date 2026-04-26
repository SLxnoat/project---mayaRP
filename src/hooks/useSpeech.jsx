import { useState, useEffect, useRef, useCallback } from 'react';

export function useSpeech() {
  const [speaking, setSpeaking] = useState(false);
  const [available, setAvailable] = useState(false);
  const [listening, setListening] = useState(false);
  const synthRef = useRef(null);
  const recognitionRef = useRef(null);
  const [voices, setVoices] = useState([]);
  const onSpeechRecognizedRef = useRef(null);

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
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onresult = (event) => {
        if (onSpeechRecognizedRef.current) {
          const transcript = event.results[0][0].transcript;
          onSpeechRecognizedRef.current(transcript);
        }
      };

      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setListening(false);
      };

      recognitionRef.current = recognition;
    }
  }, []);

  const recognizeSpeech = () => {
    if (!recognitionRef.current) {
      alert('Voice recognition is not supported in this browser. Please use Chrome or Edge.');
      return;
    }
    try {
      recognitionRef.current.start();
      setListening(true);
    } catch (error) {
      console.error('Error starting speech recognition:', error);
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setListening(false);
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

    // Get available voices and try to find a good English voice
    const currentVoices = synthRef.current.getVoices();
    const preferredVoice = currentVoices.find(v =>
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
      speechQueue.current.shift(); // Remove processed item
      isProcessingQueue.current = false;
      processQueue(); // Process next item
      if (resolve) resolve();
    };
    utterance.onerror = () => {
      setSpeaking(false);
      speechQueue.current.shift(); // Remove errored item
      isProcessingQueue.current = false;
      processQueue(); // Process next item
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
    voices,
    recognizeSpeech,
    stopListening,
    speak,
    cancelSpeech,
    setOnSpeechRecognized,
  };
}
