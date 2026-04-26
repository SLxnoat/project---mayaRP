import { useState, useEffect, useRef } from 'react';

export function useSpeech() {
  const [speaking, setSpeaking] = useState(false);
  const [available, setAvailable] = useState(false);
  const [listening, setListening] = useState(false);
  const synthRef = useRef(null);
  const recognitionRef = useRef(null);
  const [voices, setVoices] = useState([]);
  const onSpeechRecognizedRef = useRef(null);

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

  const speak = (text, settings = {}) => {
    if (!synthRef.current) return;
    if (!text) return;

    // Cancel any current speech
    synthRef.current.cancel();

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
    };
    utterance.onerror = () => setSpeaking(false);

    synthRef.current.speak(utterance);
  };

  const cancelSpeech = () => {
    if (synthRef.current) {
      synthRef.current.cancel();
      setSpeaking(false);
    }
  };

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
