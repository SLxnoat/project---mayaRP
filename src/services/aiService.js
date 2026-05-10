/**
 * AI Service for OpenAI-compatible APIs (OpenRouter, Together AI, local Ollama, etc.)
 */

export const DEFAULT_CONFIG = {
  baseUrl: import.meta.env.VITE_AI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta/openai',
  apiKey: import.meta.env.VITE_AI_API_KEY || '',
  model: import.meta.env.VITE_AI_MODEL || 'gemini-2.5-flash',
  temperature: parseFloat(import.meta.env.VITE_AI_TEMPERATURE) || 0.7,
  maxTokens: parseInt(import.meta.env.VITE_AI_MAX_TOKENS) || 2000,
};

// Global rate limit state
let isRateLimited = false;
let rateLimitResetTime = 0;

export function getRateLimitStatus() {
  const now = Date.now();
  if (isRateLimited && now > rateLimitResetTime) {
    isRateLimited = false;
  }
  return { isRateLimited, remainingTime: Math.max(0, rateLimitResetTime - now) };
}

// --- SECURITY GUARDRAILS ---
const FORBIDDEN_PATTERNS = [
  /ignore previous instructions/i,
  /system prompt/i,
  /DAN mode/i,
  /jailbreak/i,
  /acting as a developer/i,
  /forget your constraints/i
];

/**
 * Validates input against common prompt injection attacks.
 */
function validateInput(text) {
  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.test(text)) {
      throw new Error('Security Alert: Malicious prompt pattern detected. Request blocked.');
    }
  }
}

/**
 * Retry a function up to `retries` times with exponential backoff.
 * AbortErrors are never retried.
 */
async function withRetry(fn, retries = 2, baseDelay = 1000) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const isLast = attempt === retries;
      // Do not retry on rate limits or aborts
      if (isLast || error.name === 'AbortError' || error.message.includes('rate limit')) {
        throw error;
      }
      await new Promise(r => setTimeout(r, baseDelay * (attempt + 1)));
    }
  }
}

/**
 * Sends a chat completion request to the AI provider.
 * 
 * @param {Array} messages - Array of message objects {role, content}
 * @param {Object} options - Optional overrides for DEFAULT_CONFIG
 * @param {Function} onStream - Optional callback for streaming response
 * @returns {Promise<string>} - Complete response content
 */
export async function chatCompletion(messages, options = {}, onStream = null) {
  // Check global rate limit
  const status = getRateLimitStatus();
  if (status.isRateLimited) {
    throw new Error(`AI Service is cooling down. Please wait ${Math.ceil(status.remainingTime / 1000)}s.`);
  }

  // Sanitize config: Strip trailing slashes from baseUrl
  const config = { ...DEFAULT_CONFIG, ...options };
  if (config.baseUrl) {
    config.baseUrl = config.baseUrl.replace(/\/+$/, '');
  }
  
  if (!config.baseUrl) throw new Error('AI Base URL is not configured.');
  if (!config.apiKey) {
    console.error('AI Service Error: VITE_AI_API_KEY is missing in .env');
    throw new Error('AI API Key is missing. Check your .env file.');
  }

  // Security Check: Ensure API key isn't exposed in production
  if (import.meta.env.PROD && !config.baseUrl.includes('your-backend-proxy.com')) {
    console.warn('SECURITY WARNING: Calling AI APIs directly from the browser in production is insecure. Use a backend proxy.');
  }

  // Sanitize last user message for prompt injection
  const lastUserMessage = [...messages].reverse().find(m => m.role === 'user');
  if (lastUserMessage) {
    validateInput(lastUserMessage.content);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

  try {
    const response = await withRetry(() =>
      fetch(`${config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: config.model,
          messages: messages,
          temperature: config.temperature,
          max_tokens: config.maxTokens,
          stream: !!onStream,
        }),
        signal: controller.signal,
      })
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));

      // Gemini returns errors as an array: [{ error: { code, message, details } }]
      // Standard OpenAI format returns: { error: { message } }
      const errorObj = Array.isArray(errorData)
        ? errorData[0]?.error
        : errorData?.error;

      if (response.status === 429) {
        // Set global rate limit
        isRateLimited = true;
        rateLimitResetTime = Date.now() + 60000; // Default 60s cooldown

        // Extract the retry delay from Gemini's RetryInfo detail if present
        const retryInfo = errorObj?.details?.find(d =>
          typeof d['@type'] === 'string' && d['@type'].includes('RetryInfo')
        );
        const retryDelay = retryInfo?.retryDelay ?? '60s';
        
        // Update reset time if API provided one
        const delaySeconds = parseInt(retryDelay) || 60;
        rateLimitResetTime = Date.now() + (delaySeconds * 1000);

        const retryMsg = ` Please retry in ${retryDelay}.`;
        throw new Error(
          `API quota exceeded (rate limit).${retryMsg} Check your usage at https://ai.dev/rate-limit`
        );
      }

      throw new Error(
        errorObj?.message || `API request failed with status ${response.status}`
      );
    }

    if (onStream) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6);
            if (dataStr === '[DONE]') break;

            try {
              const data = JSON.parse(dataStr);
              const content = data.choices[0]?.delta?.content || '';
              if (content) {
                fullContent += content;
                onStream(content);
              }
            } catch (e) {
              // Ignore incomplete JSON
            }
          }
        }
      }
      return fullContent;
    } else {
      const data = await response.json();
      return data.choices[0]?.message?.content || '';
    }
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('AI request timed out. Please try again.');
    }
    throw error;
  }
}

/**
 * Perform a deep agentic analysis of user text to detect hidden psychological markers.
 * Used by the Hidden Agent loop.
 */
export async function performDeepAnalysis(text, context = []) {
  const analysisPrompt = `
    Analyze the following user input from a psychological and emotional perspective.
    Extract the following metrics in JSON format:
    - primaryEmotion: (one of: joy, sadness, anger, fear, surprise, neutral)
    - intensity: (0.0 to 1.0)
    - stressLevel: (0 to 100)
    - cognitiveDistortions: (array of detected patterns)
    - hiddenNeeds: (what the user is actually seeking emotionally)
    - recommendation: (how a counselor should adapt their tone)
    
    User Input: "${text}"
    Recent Context: ${JSON.stringify(context.slice(-3))}
    
    Return ONLY valid JSON.
  `;

  try {
    const result = await chatCompletion([
      { role: 'system', content: 'You are a highly advanced psychological analysis engine. Return only JSON.' },
      { role: 'user', content: analysisPrompt }
    ], { temperature: 0.1 }); // Low temperature for consistent JSON

    // Find JSON in the response
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return null;
  } catch (error) {
    console.error('Deep Analysis Error:', error);
    return null;
  }
}

// Simple lock to prevent multiple simultaneous connection checks
let isCheckingConnection = false;

/**
 * Checks connectivity to the AI provider by performing a minimal ping.
 */
export async function checkAiConnection(config = DEFAULT_CONFIG) {
  if (isCheckingConnection) return false;
  
  // Sanitize
  const sanitizedBaseUrl = (config.baseUrl || '').replace(/\/+$/, '');
  
  const status = getRateLimitStatus();
  if (status.isRateLimited) {
    console.warn(`AI Service: Connection check skipped (Cooling down for ${Math.ceil(status.remainingTime / 1000)}s)`);
    return false;
  }

  if (!sanitizedBaseUrl || !config.apiKey) {
    console.error('AI Service: Configuration missing (BaseURL or API Key)');
    return false;
  }
  
  isCheckingConnection = true;
  try {
    // Perform a minimal completion request as a "ping"
    const response = await fetch(`${sanitizedBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 1,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      
      // If 429, update global rate limit
      if (response.status === 429) {
        isRateLimited = true;
        rateLimitResetTime = Date.now() + 60000;
      }

      console.error('AI Connection check failed:', response.status, errorData);
      return false;
    }

    return true;
  } catch (error) {
    console.error('AI Connection check failed (Network Error):', error);
    return false;
  } finally {
    isCheckingConnection = false;
  }
}
