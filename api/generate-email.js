// /api/generate-email.js
// Vercel serverless function. Runs on the SERVER so ANTHROPIC_API_KEY stays secret.
//
// Two steps:
//   1) Fetch ONE true, current fact about the target program via web search (Haiku).
//      Cached per-school for 7 days. Returns null if nothing reliable is found.
//   2) Generate the email (Sonnet), anchoring the opener on that verified fact.
//      If no fact was found, the model is FORBIDDEN from inventing program
//      specifics and instead opens on the athlete's genuine fit reasoning.

const factCache = new Map(); // schoolKey -> { fact, fetchedAt }
const CACHE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// Tolerant JSON extractor: handles clean JSON, fenced JSON, or JSON with preamble.
function extractJson(text) {
  if (!text) return null;
  const cleaned = text.replace(/```json|```/g, '').trim();
  try { return JSON.parse(cleaned); } catch {}
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (match) { try { return JSON.parse(match[0]); } catch {} }
  return null;
}

async function fetchProgramFact({ apiKey, school, conference, sportName, schoolKey }) {
  // Cache check
  if (schoolKey && factCache.has(schoolKey)) {
    const entry = factCache.get(schoolKey);
    if (Date.now() - entry.fetchedAt < CACHE_MS) return entry.fact;
  }

  const prompt = `Find ONE specific, true, recent fact about the ${school} ${sportName} program (${conference || 'college'}) that a high school recruit could reference in an email to show genuine, accurate knowledge of the program.

Good facts: their most recent season record or postseason result, a recent player who was drafted or transferred up to a higher division, a notable recent win or championship, or a documented coaching/player-development philosophy. Prefer concrete, verifiable facts from the last 1-2 seasons.

Respond ONLY with valid JSON (no markdown fences):
{"fact": "one concrete, specific sentence a recruit could reference"}
If you cannot find a reliable, specific fact, respond with {"fact": null}. Do NOT guess or generalize.`;

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
        max_tokens: 512,
        messages: [{ role: 'user', content: prompt }],
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
      }),
    });

    if (!response.ok) return null; // never block the email on a failed fact search

    const data = await response.json();
    const text = data.content.filter(b => b.type === 'text').map(b => b.text).join('');
    const parsed = extractJson(text);
    const fact = parsed && parsed.fact ? String(parsed.fact).trim() : null;

    if (schoolKey) factCache.set(schoolKey, { fact, fetchedAt: Date.now() });
    return fact;
  } catch {
    return null; // search failed -> proceed factless, never fabricate
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

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

  // Step 1: get one verified, current fact about the program (or null).
  const schoolKey = coach.id || coach.school;
  const programFact = await fetchProgramFact({
    apiKey, school: coach.school, conference: coach.conference, sportName, schoolKey,
  });

  // Step 2: build the email prompt, anchored on the fact (or honest fallback).
  const openerInstruction = programFact
    ? `OPENER — You have ONE verified fact about this program:
"${programFact}"
Open the email by referencing this fact naturally, in the athlete's own voice, to show genuine knowledge of ${coach.school}. Build ONLY on this fact. Do NOT add any other claim about the program's style, history, or reputation that is not contained in this fact — anything you add from assumption is likely wrong and will get the email deleted.`
    : `OPENER — We could NOT verify a specific fact about this program. You therefore must NOT invent or guess anything about ${coach.school}'s record, playing style, history, or reputation; fabricated specifics are the #1 reason coaches delete these emails. Instead, open with the athlete's genuine, concrete reason for targeting a program at this level (${coach.division || ''} ${coach.conference || ''}) — fit, development path, region, academics — and why that fit is real for him. No vague flattery, no made-up program details.`;

  const prompt = `You are helping a high school athlete write a recruiting email that a college coach will actually read and reply to. Most recruiting emails get ignored because they are generic and templated. Write one that is specific, genuine, and grounded only in true information.

ATHLETE:
- Name: ${athlete.firstName} ${athlete.lastName}
- Class of ${athlete.gradYear}, ${athlete.position || 'athlete'} in ${sportName}
- Physical: ${athlete.height || 'n/a'}, ${athlete.weight ? athlete.weight + ' lbs' : 'n/a'}
- Key stats: ${athlete.stats || 'not provided'}
- Academics: ${athlete.gpa ? 'GPA ' + athlete.gpa : ''}${athlete.test ? ', ' + athlete.test : ''}
- High school: ${athlete.highSchool || 'not provided'}
- Highlight film: ${athlete.film || 'will be attached'}

TARGET:
- Coach ${coach.name || 'Head Coach'} (${coach.title || 'Head Coach'})
- ${coach.school} (${coach.division || ''} ${coach.conference || ''})

${openerInstruction}

The rest of the email must:
- Frame the athlete's stats in terms of how they fit THIS program's level and needs.
- Be concise (150-200 words), confident but humble, and sound like a real motivated teenager wrote it — not a corporate template or an adult.
- End with a specific, low-friction call to action (offer film, schedule, upcoming showcases).
- Use the athlete's real email sign-off.
- Never claim anything about the program that is not either the verified fact above or self-evidently true (its division/conference). When in doubt, say less.

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
    const text = data.content.filter(b => b.type === 'text').map(b => b.text).join('');
    const parsed = extractJson(text) || { subject: 'Recruiting inquiry', body: text.trim() };

    // Surface whether a real fact anchored the opener — useful for your test logging.
    parsed.programFactUsed = programFact || null;

    return res.status(200).json(parsed);
  } catch (err) {
    return res.status(500).json({ error: 'Generation failed', detail: err.message });
  }
}
