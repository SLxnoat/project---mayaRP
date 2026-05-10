/**
 * Vision Service
 * Handles face detection and emotion recognition using face-api.js.
 */

const FACE_API_URL = 'https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js';

class VisionService {
  constructor() {
    this.isLoaded = false;
    this.isInitializing = false; // NEW: Lock
    this.modelsLoaded = false;
    this.detector = null;
  }

  /**
   * Load face-api.js from CDN and initialize models
   */
  async init() {
    if (this.isLoaded || this.isInitializing) return;
    this.isInitializing = true;

    try {
      // Load the script if not already present
      if (!window.faceapi) {
        await this.loadScript(FACE_API_URL);
      }

      // Load models from a public repository or local path
      const MODEL_URL = 'https://justadudewhohacks.github.io/face-api.js/models';
      
      // Check if already initialized (for dev HMR)
      if (window.faceapi.nets.tinyFaceDetector.params) {
        this.modelsLoaded = true;
        this.isLoaded = true;
        this.isInitializing = false;
        return;
      }

      await Promise.all([
        window.faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        window.faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL)
      ]);

      this.modelsLoaded = true;
      this.isLoaded = true;
      console.log('Vision Service: Models Loaded');
    } catch (error) {
      console.error('Vision Service: Initialization failed', error);
      // Don't re-throw to prevent App crash, just log it
    } finally {
      this.isInitializing = false;
    }
  }

  loadScript(url) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = url;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  /**
   * Detect face and expressions from a video or image element
   */
  async detect(videoElement) {
    if (!this.isLoaded || !this.modelsLoaded) return null;

    try {
      const detection = await window.faceapi
        .detectSingleFace(videoElement, new window.faceapi.TinyFaceDetectorOptions())
        .withFaceExpressions();

      if (!detection) return null;

      // Extract the most likely expression
      const expressions = detection.expressions;
      const dominantExpression = Object.entries(expressions)
        .reduce((a, b) => (a[1] > b[1] ? a : b));

      return {
        emotion: dominantExpression[0],
        confidence: dominantExpression[1],
        allExpressions: expressions,
        box: detection.detection.box
      };
    } catch (error) {
      console.error('Detection error:', error);
      return null;
    }
  }
}

export const visionService = new VisionService();
