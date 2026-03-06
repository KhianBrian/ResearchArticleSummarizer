

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.1-8b-instant';

async function summarizeWithGroq(abstractText, apiKey) {
  const systemPrompt = `You are a research paper summarizer. Given an abstract from an academic paper, produce a concise structured summary in valid JSON. Return ONLY a JSON object with no markdown fences, no extra text. The JSON must have these exact keys:
{
  "mainIdea": "One sentence describing the core research goal or question.",
  "keyContributions": ["bullet 1", "bullet 2", "bullet 3"],
  "methods": "Short explanation of how the research was conducted."
}`;

  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      max_tokens: 512,
      temperature: 0.3,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Summarize this research abstract:\n\n${abstractText}` }
      ]
    })
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    const msg = err?.error?.message || `API error ${response.status}`;
    throw new Error(msg);
  }

  const data = await response.json();
  const rawText = data.choices?.[0]?.message?.content?.trim();
  if (!rawText) throw new Error('Empty response from API.');

  try {
    return JSON.parse(rawText);
  } catch {
    // Try to extract JSON if wrapped in markdown fences
    const match = rawText.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error('Could not parse API response as JSON.');
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'summarize') {
    (async () => {
      try {
        const { apiKey } = await chrome.storage.sync.get('apiKey');
        if (!apiKey) {
          sendResponse({ success: false, error: 'API key not set. Open Settings to add your Anthropic API key.' });
          return;
        }

        const truncatedText = message.text.slice(0, 3000);
        const summary = await summarizeWithGroq(truncatedText, apiKey);

        // Save to local storage history
        const { history = [] } = await chrome.storage.local.get('history');
        history.unshift({
          id: Date.now(),
          title: message.pageTitle || 'Untitled',
          url: message.pageUrl || '',
          summary,
          savedAt: new Date().toISOString()
        });
        // Keep only the last 20 entries
        if (history.length > 20) history.splice(20);
        await chrome.storage.local.set({ history });

        sendResponse({ success: true, summary });
      } catch (e) {
        sendResponse({ success: false, error: e.message });
      }
    })();
    return true; // Keep channel open for async response
  }

  if (message.action === 'saveSummary') {
    (async () => {
      try {
        const { history = [] } = await chrome.storage.local.get('history');
        const entry = history.find(h => h.id === message.id);
        if (entry) entry.pinned = true;
        await chrome.storage.local.set({ history });
        sendResponse({ success: true });
      } catch (e) {
        sendResponse({ success: false, error: e.message });
      }
    })();
    return true;
  }

  if (message.action === 'getHistory') {
    chrome.storage.local.get('history', ({ history = [] }) => {
      sendResponse({ success: true, history });
    });
    return true;
  }
});
