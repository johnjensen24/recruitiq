// /api/find-coach.js
// Live coach lookup. When an athlete searches for a coach not in the starter
// database, this uses Claude with web search to find publicly-listed contact info.
// Runs server-side so the API key stays safe.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { school, sport, query } = req.body || {};
  if (!school && !query) {
    return res.status(400).json({ error: 'Provide a school or search query' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Server not configured' });
  }

  const sportName = {
    'football': 'football', 'baseball': 'baseball',
    'basketball-m': "men's basketball", 'basketball-w': "women's basketball",
    'softball': 'softball', 'volleyball-w': 'volleyball',
  }[sport] || sport || '';

  const prompt = `Find the publicly-listed coaching staff contact information for the ${sportName} program at ${school || query}. 

I'm looking for the head coach and recruiting coordinator, with their publicly available email addresses if they are listed on the official athletics website. Only return information that is publicly posted on official sources. Do not guess or fabricate email addresses.

Respond ONLY with valid JSON (no markdown):
{"coaches": [{"name": "...", "title": "...", "email": "... or null if not publicly listed", "source": "where you found it"}], "note": "any caveats about availability"}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(502).json({ error: 'Claude API error', detail: errText });
    }

    const data = await response.json();
    let text = data.content.filter(b => b.type === 'text').map(b => b.text).join('');
    text = text.replace(/```json|```/g, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      parsed = { coaches: [], note: text };
    }

    return res.status(200).json(parsed);
  } catch (err) {
    return res.status(500).json({ error: 'Search failed', detail: err.message });
  }
}
