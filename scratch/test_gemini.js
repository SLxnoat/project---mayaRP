
const API_KEY = 'AIzaSyCg9uX4v50mTQMI0pW4xXQ85a0MeJcQgE8';
const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/openai';

async function testGemini() {
  console.log('Testing Gemini API (gemini-2.0-flash)...');
  try {
    const response = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gemini-2.0-flash',
        messages: [{ role: 'user', content: 'Hello, how are you?' }],
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('API Error:', JSON.stringify(error, null, 2));
      return;
    }

    const data = await response.json();
    console.log('Response:', data.choices[0].message.content);
  } catch (error) {
    console.error('Request failed:', error);
  }
}

testGemini();
