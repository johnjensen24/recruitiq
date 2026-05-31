// /api/generate-email.js
// This is a Vercel serverless function. It runs on the SERVER, not the browser,
// so your ANTHROPIC_API_KEY stays secret. The browser calls THIS endpoint;
// this endpoint calls Claude.

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Basic rate-limit guard: reject absurdly large requests
  const athlete = req.body?.athlete;
  const coach = req.body?.coach;
  if (!athlete || !coach) {
    return res.status(400).json({ error: 'Missing athlete or coach data' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Server not configured. Set ANTHROPIC_API_KEY in Vercel env vars.' });
  }

  const sportName = {
    'football': 'football', 'baseball': 'baseball',
    'basketball-m': "men's basketball", 'basketball-w': "women's basketball",
    'softball': 'softball', 'volleyball-w': 'volleyball',
  }[athlete.sport] || athlete.sport;

  const prompt = `You are helping a high school athlete write a recruiting email that a college coach will actually read and reply to. Most recruiting emails get ignored because they are generic and templated. Write one that is specific, genuine, and compelling.

ATHLETE:
- Name: ${athlete.firstName} ${athlete.lastName}
- Class of ${athlete.gradYear}, ${athlete.position || 'athlete'} in ${sportName}
- Physical: ${athlete.height || 'n/a'}, ${athlete.weight ? athlete.weight + ' lbs' : 'n/a'}
- Key stats: ${athlete.stats || 'not provided'}
- Academics: ${athlete.gpa ? 'GPA ' + athlete.gpa : ''}${athlete.test ? ', ' + athlete.test : ''}
- High school: ${athlete.highSchool || 'not provided'}
- Highlight film: ${athlete.film || 'will be attached'}

TARGET:
- Coach ${coach.name} (${coach.title})
- ${coach.school} (${coach.conference})

Write a recruiting email that:
- Opens with something SPECIFIC and genuine about ${coach.school}'s ${sportName} program — their playing style, recent success, development reputation, or what makes them distinct. Use what you actually know about this program. Never use generic flattery like "your prestigious program."
- Frames the athlete's stats in terms of how they fit THIS program's level and needs.
- Is concise (150-200 words), confident but humble, and sounds like a real motivated teenager wrote it — not a corporate template or an adult.
- Ends with a specific, low-friction call to action (offer film, schedule, upcoming showcases).
- Uses the athlete's real email sign-off.

Respond ONLY with valid JSON, no markdown fences, no preamble:
{"subject": "...", "body": "..."}`;

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
      // Fallback if model didn't return clean JSON
      parsed = { subject: 'Recruiting inquiry', body: text };
    }

    return res.status(200).json(parsed);
  } catch (err) {
    return res.status(500).json({ error: 'Generation failed', detail: err.message });
  }
}
