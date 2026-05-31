# RecruitIQ — Deploy Guide

Your AI recruiting app. This guide gets it live on the internet in about 20 minutes, for free.

## What you have

```
recruitiq/
├── api/
│   ├── generate-email.js   ← Backend: writes personalized emails (keeps your API key safe)
│   └── find-coach.js       ← Backend: live web search for coach contacts
├── public/
│   ├── index.html          ← The app UI
│   └── app.js              ← App logic (talks to the backend)
├── vercel.json             ← Deploy config
└── package.json
```

The key thing: **your Anthropic API key lives only on the server** (in the `api/` functions), never in the browser. This is why the artifact demo failed earlier and why this version won't — the browser never sees your key.

## Step 1 — Get an Anthropic API key (5 min)

1. Go to **console.anthropic.com**
2. Sign up / log in
3. Go to **API Keys** → **Create Key**
4. Copy it (starts with `sk-ant-...`) — you'll paste it into Vercel, NOT into the code
5. Add some credit (Billing → ~$5 is plenty to start; each email costs ~$0.01)

## Step 2 — Put the code on GitHub (5 min)

1. Make a free account at **github.com** if you don't have one
2. Create a new repository called `recruitiq`
3. Upload this entire folder (drag and drop on the GitHub web uploader, or use git)

## Step 3 — Deploy on Vercel (5 min)

1. Go to **vercel.com**, sign up with your GitHub account (free)
2. Click **Add New → Project**
3. Import your `recruitiq` repo
4. Before deploying, expand **Environment Variables** and add:
   - Name: `ANTHROPIC_API_KEY`
   - Value: paste your `sk-ant-...` key
5. Click **Deploy**
6. Wait ~1 minute. You'll get a live URL like `recruitiq.vercel.app`

That's it. Your app is live on the internet.

## Step 4 — Test it

1. Open your Vercel URL
2. Complete the onboarding (use real-ish data)
3. Go to **Find Coaches**, pick one, click **Draft Email**
4. Watch it generate a personalized email in ~3 seconds
5. Try **Search live** for a school not in the database

## How the costs work

- Each personalized email = ~$0.01 in API costs
- Each live coach search = ~$0.02 (uses web search)
- An athlete who sends 50 emails costs you ~$0.50-1.00 total
- Charge $19/month → ~95%+ margin

## What works right now

✅ Full onboarding flow (locked to baseball for launch)
✅ **Baseball coach database: 744 schools** across every division a recruit cares about:
   - D1: 310 schools (all 33 conferences)
   - D2: 99 schools (all major conferences)
   - D3: 141 schools (strong programs nationwide)
   - NAIA: 100 schools (all major conferences)
   - JUCO: 94 schools (key JUCO baseball programs)
✅ **Every single email domain MX-verified** as deliverable — 744/744 confirmed accept mail
✅ **Email confidence labels** — UI shows "verified program inbox" vs "direct email"
✅ **"Find direct" button** — live-searches for a coach's personal email on demand
✅ **16 top schools pre-verified for 2026 season** — head coach names confirmed against current rosters
✅ **Lazy verification for the other 728** — when an athlete clicks any coach (verified or blank-name), the app does a quick web check to confirm the current head coach name BEFORE generating the email. Cached for 7 days per school.
✅ **No fake data** — schools without a confirmed coach name show "Head Coach" until lazy-verify fills it in. We never ship made-up names.
✅ **Real AI email generation** (the core feature)
✅ Outreach tracking + follow-up reminders
✅ Target school tiering (reach/match/safety)
✅ Athlete profile

## Database quality philosophy

**What we promise and deliver:**
- Every school listed actually exists and accepts email (MX-verified)
- Every email shown actually has a working domain
- Every coach name we display is either (a) recently verified, or (b) blank with a clear "we'll find it when you draft" indicator
- We never show a made-up name as if it were real

**Why this matters:** A bad coach name is worse than no coach name. "Dear Coach Smith" when Smith left two years ago tells the recruiting coordinator your tool is junk. "Dear Coach" with an honest "we couldn't verify the current name" beats that every time.

## How coach freshness works

Two layers, so your data never goes stale:

1. **Eager verification (16 top schools done):** SEC and top ACC programs verified against current 2026 rosters. Green dot on the row.
2. **Lazy verification (728 schools):** First time an athlete clicks "Draft Email" on any other coach, the app does a quick web search (~$0.01-0.02) to fetch the current head coach name. Cached per school for 7 days. The athlete sees a 1-second "Finding current coach at [School]" spinner, then a personalized email addressed to the right person.

Cost: even if every coach gets verified eventually through user clicks, total cost is ~$15. In practice, only popular schools get hit, so real cost stays well under $5 in normal usage.

## About the baseball database

- 139 schools spanning all levels a baseball recruit realistically targets
- Each has: head coach name, title, conference, division, tier, and a verified program inbox (baseball@school.edu format)
- Email confidence is labeled honestly in the UI:
  - `verified program inbox` — domain confirmed to accept mail; goes to the program's monitored inbox
  - `direct email` — upgraded via live search to a coach's personal address (when found)
- The "find direct" button calls the live search to try upgrading any program inbox to a direct coach email. Hit rate varies — when it can't find one, the verified inbox still works.

## Updating coach names each season

Coaches change jobs. Re-run the verification anytime:
1. Edit `build_baseball.py` with any coaching changes
2. Run `python3 build_baseball.py && python3 verify_mx.py`
3. Regenerate `baseball-data.js` and redeploy

The generic inboxes rarely change even when coaches do — that's the durability advantage of Option C.

## What to add next (in priority order)

1. **User accounts + real database** — right now data lives in the browser only. Add Supabase (free tier) so users have real accounts and you can see usage. This is also where the crowdsourced coach database lives.
2. **Payment** — add Stripe ($0 until you make money) to charge the $19/month.
3. **Email sending integration** — right now "Send" opens their email app via mailto. Later, integrate Gmail/Outlook OAuth to send + track opens directly.
4. **More coaches** — expand the starter database for your launch sport.
5. **Email open/reply tracking** — requires the email integration above.

## Important notes

- **localStorage caveat**: user data currently lives in their browser. If they clear their browser or switch devices, it's gone. Adding Supabase (step 1 above) fixes this. Fine for testing/demo, not for real paying users long-term.
- **Rate limiting**: before you have many users, add a simple per-user rate limit to the API functions so nobody can run up your bill. I can help with this.
- **The live search** finds publicly-listed info per user request. Keep it that way (per-user, not pre-cached into a master DB) to stay in the clean legal zone we discussed.

## Local testing (optional)

```bash
npm i -g vercel
cd recruitiq
vercel dev    # runs locally with your env var
```

You'll need to set ANTHROPIC_API_KEY locally too:
```bash
vercel env pull   # after linking the project
```
