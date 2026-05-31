// /api/verify-coach.js
// Quick verification: given a school, return the current head baseball coach
// name. Used to refresh stale data the moment an athlete clicks on a coach.
// Caches per-school in memory for 7 days so we don't re-search constantly.

const cache = new Map(); // schoolId -> { name, fetchedAt }
const CACHE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { schoolId, school, sport } = req.body || {};
  if (!school) return res.status(400).json({ error: 'Missing school' });

  // Cache check
  if (schoolId && cache.has(schoolId)) {
    const entry = cache.get(schoolId);
    if (Date.now() - entry.fetchedAt < CACHE_MS) {
      return res.status(200).json({ name: entry.name, cached: true });
    }
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Server not configured' });

  const sportName = sport === 'baseball' ? 'baseball' : (sport || 'baseball');

  const prompt = `Who is the current head ${sportName} coach at ${school} for the 2026 season? Respond ONLY with valid JSON (no markdown fences): {"name": "Full Name"}. If you cannot find a reliable current answer, respond with {"name": null}.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 256,
        messages: [{ role: 'user', content: prompt }],
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
      }),
    });

    if (!response.ok) {
      const t = await response.text();
      return res.status(502).json({ error: 'Search failed', detail: t });
    }

    const data = await response.json();
    let text = data.content.filter(b => b.type === 'text').map(b => b.text).join('');
    text = text.replace(/```json|```/g, '').trim();

    let parsed;
    try { parsed = JSON.parse(text); }
    catch { parsed = { name: null }; }

    if (parsed.name && schoolId) {
      cache.set(schoolId, { name: parsed.name, fetchedAt: Date.now() });
    }

    return res.status(200).json({ name: parsed.name, cached: false });
  } catch (err) {
    return res.status(500).json({ error: 'Verify failed', detail: err.message });
  }
}
