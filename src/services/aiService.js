/**
 * AI Service for OpenAI-compatible APIs (OpenRouter, Together AI, local Ollama, etc.)
 */

export const DEFAULT_CONFIG = {
  baseUrl: import.meta.env.VITE_AI_BASE_URL || 'https://api.ollama.com/v1',
  apiKey: import.meta.env.VITE_AI_API_KEY || '5dc5eb2ffd5e42edbae56d6fdb11b506.Dwc8mH9P_b8FBhZepxLgyj-x',
  model: import.meta.env.VITE_AI_MODEL || 'dolphin-mixtral',
  temperature: parseFloat(import.meta.env.VITE_AI_TEMPERATURE) || 0.7,
  maxTokens: parseInt(import.meta.env.VITE_AI_MAX_TOKENS) || 2000,
};

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
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
        'HTTP-Referer': window.location.origin, // Required by OpenRouter
        'X-Title': 'Maya RP', // Required by OpenRouter
      },
      body: JSON.stringify({
        model: config.model,
        messages: messages,
        temperature: config.temperature,
        max_tokens: config.maxTokens,
        stream: !!onStream,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `API request failed with status ${response.status}`);
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
 * Checks connectivity to the AI provider.
 */
export async function checkAiConnection(config = DEFAULT_CONFIG) {
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
