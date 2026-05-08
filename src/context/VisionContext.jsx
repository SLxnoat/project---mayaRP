import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { visionService } from '../services/visionService';

const VisionContext = createContext();

export function VisionProvider({ children }) {
  const [isActive, setIsActive] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [currentEmotion, setCurrentEmotion] = useState(null);
  const [isUserPresent, setIsUserPresent] = useState(false);
  const [error, setError] = useState(null);
  
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const detectionLoopRef = useRef(null);

  // Initialize Vision Service
  useEffect(() => {
    visionService.init()
      .then(() => setIsReady(true))
      .catch(err => setError('Failed to initialize vision models'));
  }, []);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 640, height: 480, frameRate: 15 } 
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setIsActive(true);
        setError(null);
      }
    } catch (err) {
      console.error('Camera access denied:', err);
      setError('Camera access denied');
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsActive(false);
    setIsUserPresent(false);
    setCurrentEmotion(null);
    if (detectionLoopRef.current) {
      cancelAnimationFrame(detectionLoopRef.current);
    }
  }, []);

  const toggleVision = useCallback(() => {
    if (isActive) stopCamera();
    else startCamera();
  }, [isActive, startCamera, stopCamera]);

  // Detection Loop
  const runDetection = useCallback(async () => {
    if (!isActive || !videoRef.current) return;

    const result = await visionService.detect(videoRef.current);
    
    if (result) {
      setIsUserPresent(true);
      setCurrentEmotion(result.emotion);
    } else {
      setIsUserPresent(false);
      setCurrentEmotion(null);
    }

    // Run every ~500ms to save CPU
    setTimeout(() => {
      if (isActive) {
        detectionLoopRef.current = requestAnimationFrame(runDetection);
      }
    }, 500);
  }, [isActive]);

  useEffect(() => {
    if (isActive) {
      runDetection();
    }
    return () => {
      if (detectionLoopRef.current) cancelAnimationFrame(detectionLoopRef.current);
    };
  }, [isActive, runDetection]);

  const value = {
    isActive,
    isReady,
    currentEmotion,
    isUserPresent,
    error,
    toggleVision,
    videoRef
  };

  return (
    <VisionContext.Provider value={value}>
      {children}
      {/* Hidden Video Element for processing */}
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        style={{ display: 'none' }}
      />
    </VisionContext.Provider>
  );
}

export function useVision() {
  const context = useContext(VisionContext);
  if (!context) {
    throw new Error('useVision must be used within a VisionProvider');
  }
  return context;
}
