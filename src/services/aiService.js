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
      if (isLast || error.name === 'AbortError') throw error;
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
  const config = { ...DEFAULT_CONFIG, ...options };
  
  if (!config.baseUrl) throw new Error('AI Base URL is not configured.');

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
        // Extract the retry delay from Gemini's RetryInfo detail if present
        const retryInfo = errorObj?.details?.find(d =>
          typeof d['@type'] === 'string' && d['@type'].includes('RetryInfo')
        );
        const retryDelay = retryInfo?.retryDelay ?? null;
        const retryMsg = retryDelay ? ` Please retry in ${retryDelay}.` : '';
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

/**
 * Checks connectivity to the AI provider.
 */
export async function checkAiConnection(config = DEFAULT_CONFIG) {
  if (!config.baseUrl) return false;
  
  try {
    const response = await fetch(`${config.baseUrl}/models`, {
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
      },
    });
    return response.ok;
  } catch (error) {
    console.error('AI Connection check failed:', error);
    return false;
  }
}
