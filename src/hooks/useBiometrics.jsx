import { useState, useEffect, useCallback } from 'react';

export function useBiometrics() {
  const [biometrics, setBiometrics] = useState({
    heartRate: null,
    skinConductance: null,
    bodyTemperature: null,
    sleepQuality: null,
    energyLevel: null,
    lastSync: null
  });
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState(null);

  // Simulate biometric data (since we don't have actual wearables)
  // In production, this would connect to Fitbit, Apple Health, Google Fit, etc.
  const syncBiometrics = useCallback(async () => {
    setSyncing(true);
    setError(null);

    try {
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 500));

      // Generate realistic biometric data
      const newBiometrics = {
        heartRate: Math.floor(Math.random() * (75 - 60) + 60), // 60-75 bpm
        skinConductance: (Math.random() * (5 - 1) + 1).toFixed(1), // 1-5 uS
        bodyTemperature: (Math.random() * (98.8 - 97.6) + 97.6).toFixed(1), // 97.6-98.8°F
        sleepQuality: Math.floor(Math.random() * (95 - 70) + 70), // 70-95%
        energyLevel: Math.floor(Math.random() * (90 - 40) + 40), // 40-90%
        lastSync: new Date().toISOString()
      };

      setBiometrics(newBiometrics);
      return newBiometrics;
    } catch (err) {
      setError('Failed to sync biometrics');
      throw err;
    } finally {
      setSyncing(false);
    }
  }, []);

  // Load biometrics from localStorage
  useEffect(() => {
    const loadBiometrics = () => {
      try {
        const saved = localStorage.getItem('maya-biometrics');
        if (saved) {
          setBiometrics(JSON.parse(saved));
        }
      } catch (error) {
        console.error('Failed to load biometrics:', error);
      }
    };

    loadBiometrics();
  }, []);

  // Save biometrics to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('maya-biometrics', JSON.stringify(biometrics));
    } catch (error) {
      console.error('Failed to save biometrics:', error);
    }
  }, [biometrics]);

  // Update specific biometric
  const updateBiometric = useCallback((key, value) => {
    setBiometrics(prev => ({
      ...prev,
      [key]: value,
      lastSync: new Date().toISOString()
    }));
  }, []);

  // Get wellness score
  const getWellnessScore = useCallback(() => {
    let score = 50;

    if (biometrics.heartRate) {
      // Optimal HR range: 60-75
      if (biometrics.heartRate >= 60 && biometrics.heartRate <= 75) {
        score += 15;
      } else if (biometrics.heartRate < 60 || biometrics.heartRate > 75) {
        score -= 10;
      }
    }

    if (biometrics.sleepQuality) {
      score += (biometrics.sleepQuality - 50) / 2;
    }

    if (biometrics.energyLevel) {
      score += (biometrics.energyLevel - 50) / 2;
    }

    return Math.min(100, Math.max(0, Math.round(score)));
  }, [biometrics]);

  // Reset all biometrics
  const reset = useCallback(() => {
    setBiometrics({
      heartRate: null,
      skinConductance: null,
      bodyTemperature: null,
      sleepQuality: null,
      energyLevel: null,
      lastSync: null
    });
    localStorage.removeItem('maya-biometrics');
  }, []);

  return {
    biometrics,
    syncing,
    error,
    syncBiometrics,
    updateBiometric,
    getWellnessScore,
    reset
  };
}
