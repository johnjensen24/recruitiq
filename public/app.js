// ============= COACH DATABASE =============
// Baseball launch database: 139 schools (D1/D2/D3/JUCO), every email domain
// MX-verified as deliverable. Loaded from baseball-data.js.
// Other sports get added the same way post-launch.
const COACHES = (typeof BASEBALL_COACHES !== 'undefined') ? BASEBALL_COACHES.slice() : [];

let appState = { user:null, contacted:[], liked:[], filter:'all', currentCoach:null, liveCoaches:[] };
let currentStep = 1;

// ============= ONBOARDING =============
function nextStep(n){ document.getElementById('step'+currentStep).style.display='none'; document.getElementById('step'+n).style.display='block'; document.getElementById('dot'+n).classList.add('done'); currentStep=n; }
function prevStep(n){ document.getElementById('step'+currentStep).style.display='none'; document.getElementById('step'+n).style.display='block'; document.getElementById('dot'+currentStep).classList.remove('done'); currentStep=n; }
function finishOnboarding(){
  const g=id=>document.getElementById(id).value;
  const user={ firstName:g('o_firstname')||'Athlete', lastName:g('o_lastname')||'', email:g('o_email'), gradYear:g('o_gradyear'), sport:g('o_sport'), position:g('o_position'), height:g('o_height'), weight:g('o_weight'), gpa:g('o_gpa'), test:g('o_test'), highSchool:g('o_school'), stats:g('o_stats'), film:g('o_film') };
  if(!user.firstName){ alert('Please enter your name'); return; }
  appState.user=user; saveState(); startApp();
}

// ============= PERSISTENCE =============
function saveState(){ try{ localStorage.setItem('recruitiq_state', JSON.stringify(appState)); }catch(e){} }
function loadState(){ try{ const s=localStorage.getItem('recruitiq_state'); if(s){ appState=JSON.parse(s); return true; } }catch(e){} return false; }
function resetApp(){ if(!confirm('Reset all data and start over?'))return; try{localStorage.removeItem('recruitiq_state');}catch(e){} location.reload(); }

// ============= APP =============
function startApp(){ document.getElementById('onboardShell').classList.remove('open'); document.getElementById('appShell').classList.remove('hidden'); renderEverything(); }
function renderEverything(){
  const u=appState.user; if(!u)return;
  document.getElementById('userName').textContent=`${u.firstName} ${u.lastName}`;
  document.getElementById('userSubtitle').textContent=`Class of ${u.gradYear}`;
  document.getElementById('userInitials').textContent=(u.firstName[0]||'')+(u.lastName[0]||'');
  document.getElementById('dashFirstName').textContent=u.firstName;
  document.getElementById('stat-contacted').textContent=appState.contacted.length;
  document.getElementById('stat-replies').textContent=appState.contacted.filter(c=>c.status==='replied').length;
  document.getElementById('stat-targets').textContent=coachesForUser().length;
  document.getElementById('stat-days').textContent=daysToSigningDay();
  renderSuggestions(); renderActivity(); renderCoachList(); renderOutreach(); renderSchools(); renderProfile();
}
function prettyPosition(u){ const s={'football':'Football','baseball':'Baseball','basketball-m':"Men's Basketball",'basketball-w':"Women's Basketball",'softball':'Softball','volleyball-w':'Volleyball'}[u.sport]||u.sport; return u.position?`${s} · ${u.position}`:s; }
function daysToSigningDay(){ const y=parseInt(appState.user.gradYear); if(!y)return'—'; const feb=new Date(y,1,1); const fw=new Date(y,1,1+((3-feb.getDay()+7)%7)); const d=Math.ceil((fw-new Date())/86400000); return d>0?d:'Past'; }
function switchView(v){ document.querySelectorAll('.view').forEach(x=>x.style.display='none'); document.getElementById('view-'+v).style.display='block'; document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active')); document.querySelector(`.nav-item[data-view="${v}"]`).classList.add('active'); }
function allCoaches(){ return COACHES.concat(appState.liveCoaches||[]); }
function coachesForUser(){ if(!appState.user)return[]; return allCoaches().filter(c=>c.sport===appState.user.sport); }

function renderSuggestions(){ const list=document.getElementById('suggestionsList'); const nc=coachesForUser().filter(c=>!appState.contacted.find(x=>x.coachId===c.id)).slice(0,4); list.innerHTML = nc.length===0 ? '<div class="empty"><div class="big">All caught up!</div><div>Try a live search to find more coaches.</div></div>' : nc.map(coachRowHTML).join(''); }
function renderActivity(){ const list=document.getElementById('activityList'); if(appState.contacted.length===0){ list.innerHTML='<div class="empty"><div class="big">No activity yet</div><div>Emails you send show up here.</div></div>'; return; } list.innerHTML=appState.contacted.slice(-10).reverse().map(item=>{ const c=allCoaches().find(x=>x.id===item.coachId); if(!c)return''; const s=item.status||'sent'; return `<div class="activity-item"><div class="dot ${s}"></div><div class="body"><div class="who"><strong>${c.name}</strong> <span style="color:var(--text-dim);">at ${c.school}</span></div><div style="color:var(--text-faint); font-size:11px;">${humanTime(item.sentAt)} · ${s}</div></div></div>`; }).join(''); }
function humanTime(iso){ const d=new Date(iso); const diff=(Date.now()-d)/1000; if(diff<60)return'just now'; if(diff<3600)return Math.floor(diff/60)+'m ago'; if(diff<86400)return Math.floor(diff/3600)+'h ago'; return Math.floor(diff/86400)+'d ago'; }

function setFilter(f){ appState.filter=f; document.querySelectorAll('#filterPills .pill').forEach(p=>p.classList.toggle('active',p.dataset.filter===f)); renderCoachList(); }
function renderCoachList(){
  const search=document.getElementById('coachSearch')?.value?.toLowerCase()||'';
  let coaches=allCoaches();
  if(appState.filter!=='all')coaches=coaches.filter(c=>c.division===appState.filter);
  if(search)coaches=coaches.filter(c=>c.name.toLowerCase().includes(search)||c.school.toLowerCase().includes(search)||c.conference.toLowerCase().includes(search));
  const list=document.getElementById('coachList'); if(!list)return;
  list.innerHTML=coaches.map(coachRowHTML).join('');
  const panel=document.getElementById('liveSearchPanel');
  panel.style.display=search?'block':'none';
  if(search)document.getElementById('searchQuery').textContent=search;
}
function coachRowHTML(c){
  const hasName = c.name && c.name.trim();
  const displayName = hasName ? c.name : 'Head Coach (name verified when you draft)';
  const initials = hasName ? c.name.split(' ').map(n=>n[0]).slice(0,2).join('') : '?';
  const contacted=appState.contacted.find(x=>x.coachId===c.id);
  const verifiedDot = c.verified2026
    ? '<span title="Name verified for current season" style="color:var(--green); font-size:9px;">●</span>'
    : (hasName
        ? '<span title="Name may be outdated; will verify when you draft an email" style="color:var(--accent-2); font-size:9px;">○</span>'
        : '<span title="Name will be fetched when you draft an email" style="color:var(--text-faint); font-size:9px;">○</span>');
  let emailHtml='';
  if(c.email){
    const conf=c.emailConfidence||'program_inbox';
    const label={ verified_inbox:'✓ verified program inbox', direct_found:'★ direct email', program_inbox:'program inbox', unverified:'unverified' }[conf]||'';
    const color={ verified_inbox:'var(--blue)', direct_found:'var(--green)', program_inbox:'var(--text-dim)', unverified:'var(--accent-2)' }[conf]||'var(--text-dim)';
    emailHtml=`<span class="email-tag">${c.email}</span><span style="font-size:10px; color:${color};" title="${label}">${label}</span>`;
    if(conf!=='direct_found'){
      emailHtml+=`<button class="btn btn-sm" style="padding:2px 8px; font-size:10px;" onclick="findDirectEmail('${c.id}')" id="finddirect-${c.id}">⚡ find direct</button>`;
    }
  }
  return `<div class="coach-row"><div class="coach-avatar">${initials}</div><div class="coach-info"><div class="coach-name">${verifiedDot} ${displayName} <span style="color:var(--text-faint); font-weight:400; font-size:12px;">— ${c.school}</span></div><div class="coach-meta"><span>${c.title}</span><span class="sport-tag">${c.division||c.conference}</span><span class="sport-tag" style="background:transparent;">${c.conference}</span>${c.tier?`<span class="tier-badge tier-${c.tier}">${c.tier}</span>`:''}${emailHtml}</div></div><div class="coach-actions">${contacted?'<button class="btn btn-sm" disabled style="opacity:0.5;">✓ Emailed</button>':`<button class="btn btn-primary btn-sm" onclick="openCompose('${c.id}')">✎ Draft Email</button>`}</div></div>`;
}

// Live upgrade: find a coach's direct email via backend search
async function findDirectEmail(coachId){
  const coach=allCoaches().find(c=>c.id===coachId); if(!coach)return;
  const btn=document.getElementById('finddirect-'+coachId);
  if(btn){ btn.disabled=true; btn.innerHTML='<span class="spinner" style="width:10px;height:10px;"></span> searching'; }
  try{
    const res=await fetch('/api/find-coach',{ method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ school:coach.school, sport:'baseball', query:coach.school+' baseball '+coach.name }) });
    const data=await res.json();
    const found=(data.coaches||[]).find(c=>c.email);
    if(found && found.email){
      coach.email=found.email; coach.emailConfidence='direct_found';
      saveState(); renderCoachList(); renderSuggestions();
    } else {
      if(btn){ btn.disabled=false; btn.innerHTML='no direct found'; setTimeout(()=>renderCoachList(),1500); }
    }
  }catch(e){ if(btn){ btn.disabled=false; btn.innerHTML='⚡ find direct'; } }
}

// ============= LIVE SEARCH (calls backend) =============
async function liveSearchCoach(){
  const query=document.getElementById('coachSearch').value;
  const resultEl=document.getElementById('liveSearchResult');
  resultEl.innerHTML=`<div class="live-search-state"><div class="spinner"></div> Searching the web for "${query}"...</div>`;
  try{
    const res=await fetch('/api/find-coach',{ method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ school:query, sport:appState.user.sport, query }) });
    const data=await res.json();
    if(data.coaches && data.coaches.length){
      data.coaches.forEach((c,i)=>{ appState.liveCoaches.push({ id:'live-'+Date.now()+'-'+i, name:c.name, title:c.title, sport:appState.user.sport, school:query, conference:'Found live', tier:'match', email:c.email||null }); });
      saveState(); renderCoachList();
      resultEl.innerHTML=`<div style="margin-top:12px; font-size:13px; color:var(--green);">✓ Found ${data.coaches.length} coach(es) and added them to your list above.</div>`;
    } else {
      resultEl.innerHTML=`<div style="margin-top:12px; font-size:13px; color:var(--text-dim);">${data.note||'No publicly-listed contacts found. Try the school name directly.'}</div>`;
    }
  }catch(e){ resultEl.innerHTML=`<div style="margin-top:12px; font-size:13px; color:#fca5a5;">Search failed: ${e.message}</div>`; }
}

// ============= EMAIL COMPOSE (calls backend) =============
async function openCompose(coachId){
  const coach=allCoaches().find(c=>c.id===coachId); if(!coach)return;
  appState.currentCoach=coachId;
  const displayName = (coach.name && coach.name.trim()) || 'Coach';
  document.getElementById('composeCoachName').textContent=displayName;
  document.getElementById('composeMeta').textContent=`${coach.title}, ${coach.school} · ${coach.conference}`;
  document.getElementById('composeTo').value=(coach.emailConfidence==='direct_found'?coach.email:'')||'';
  document.getElementById('composeSubject').value='';
  document.getElementById('composeBody').value='';
  document.getElementById('composeModal').classList.add('open');
  document.getElementById('aiBanner').style.display='flex';

  // Lazy verification: trigger if (a) not yet verified, OR (b) name is blank.
  const needsVerify = !coach.verified2026 && !coach._lazyChecked;
  const nameBlank = !coach.name || !coach.name.trim();

  if(needsVerify || nameBlank){
    const banner=document.getElementById('aiBanner');
    banner.innerHTML='<span class="spinner"></span><span>'+(nameBlank?'Finding':'Verifying')+' current head coach at '+coach.school+'...</span>';
    try{
      const r=await fetch('/api/verify-coach',{ method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ schoolId:coach.id, school:coach.school, sport:'baseball' }) });
      const d=await r.json();
      coach._lazyChecked=true;
      if(d.name && d.name.trim()){
        const newName = d.name.trim();
        const oldName = coach.name;
        const changed = oldName && newName.toLowerCase() !== oldName.toLowerCase();
        coach.name = newName;
        coach.verified2026 = true;
        document.getElementById('composeCoachName').textContent = newName;
        if(changed){
          document.getElementById('composeMeta').textContent = `${coach.title}, ${coach.school} · ${coach.conference} · updated from ${oldName}`;
        }
        saveState(); renderCoachList(); renderSuggestions();
      } else if(nameBlank){
        // Couldn't find a name. Fall back to "Coach" in the salutation; user can edit.
        coach._verifyFailed = true;
      }
    }catch(e){ /* non-fatal; continue with whatever name we have */ }
  }

  // Lazy EMAIL verification. The stored address is a guessed program inbox
  // (baseball@domain) that frequently bounces. Replace it with a real,
  // publicly-listed address found via web search — or leave it BLANK so we
  // never send to a guess.
  const emailIsGuess = (coach.emailConfidence !== 'direct_found');
  if(emailIsGuess && !coach._emailChecked){
    coach._emailChecked = true;
    const banner=document.getElementById('aiBanner');
    banner.style.display='flex';
    banner.innerHTML='<span class="spinner"></span><span>Finding a verified email for '+coach.school+'...</span>';
    try{
      const er=await fetch('/api/find-coach',{ method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ school:coach.school, sport:'baseball', query:coach.school+' baseball recruiting coordinator coach email' }) });
      const ed=await er.json();
      // Prefer a recruiting coordinator with a real listed email, else any coach with one.
      const withEmail=(ed.coaches||[]).filter(c=>c.email && /@/.test(c.email));
      const pick=withEmail.find(c=>/recruit/i.test(c.title||'')) || withEmail[0];
      if(pick && pick.email){
        coach.email=pick.email.trim(); coach.emailConfidence='direct_found';
        document.getElementById('composeTo').value=coach.email;
        saveState(); renderCoachList();
      } else {
        // No real email published — do NOT fall back to the guessed inbox.
        coach.email=''; coach.emailConfidence='none_found';
        coach._noEmailNote = ed.note || 'No public email is listed for this program — most use an online recruiting questionnaire. We left To: blank so you don\u2019t send to an address that bounces.';
        document.getElementById('composeTo').value='';
        saveState();
      }
    }catch(e){
      coach.email=''; coach.emailConfidence='none_found';
      coach._noEmailNote='Couldn\u2019t verify an email right now \u2014 find the program\u2019s recruiting questionnaire or staff directory before sending.';
      document.getElementById('composeTo').value='';
    }
  }

  await generateAIEmail(coach);

  // If we have no deliverable address, say so plainly (overrides the success banner).
  if(!coach.email){
    const banner=document.getElementById('aiBanner');
    banner.style.display='flex';
    banner.innerHTML='<span>\u26a0\ufe0f</span><span>'+(coach._noEmailNote||'No verified email found \u2014 use this program\u2019s recruiting questionnaire instead. To: left blank to prevent a bounce.')+'</span>';
  }
}
function closeCompose(){ document.getElementById('composeModal').classList.remove('open'); appState.currentCoach=null; }

async function generateAIEmail(coach){
  const banner=document.getElementById('aiBanner');
  banner.style.display='flex';
  banner.innerHTML='<span class="spinner"></span><span>Researching '+coach.school+' and writing your personalized email...</span>';
  try{
    const res=await fetch('/api/generate-email',{ method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ athlete:appState.user, coach }) });
    const data=await res.json();
    if(data.subject||data.body){
      document.getElementById('composeSubject').value=data.subject||'';
      document.getElementById('composeBody').value=data.body||'';
      banner.innerHTML='<span>✨</span><span>Personalized for '+coach.school+'. Edit anything before sending.</span>';
    } else { throw new Error(data.error||'No content'); }
  }catch(e){
    // Fallback to a basic template if the API fails
    document.getElementById('composeSubject').value=fallbackSubject(coach);
    document.getElementById('composeBody').value=fallbackBody(coach);
    banner.innerHTML='<span>⚠️</span><span>AI generation unavailable — showing a basic draft. (Check your backend API key.)</span>';
  }
}
function regenerateEmail(){ const c=allCoaches().find(x=>x.id===appState.currentCoach); if(c)generateAIEmail(c); }

function fallbackSubject(coach){ const u=appState.user; const pos=u.position?u.position+' ':''; return `${u.gradYear} ${pos}${u.firstName} ${u.lastName} — Interested in ${coach.school}`; }
function fallbackBody(coach){
  const u=appState.user;
  // Build the salutation: "Dear Coach Smith," if we have a name, otherwise "Dear Coach,"
  const lastName = (coach.name && coach.name.trim()) ? coach.name.trim().split(/\s+/).slice(-1)[0] : '';
  const salutation = lastName ? `Dear Coach ${lastName},` : 'Dear Coach,';
  const lines = [
    salutation,
    '',
    `My name is ${u.firstName} ${u.lastName}, a ${u.gradYear} ${u.position||'athlete'} at ${u.highSchool||'my high school'}. I'm very interested in your program at ${coach.school}.`,
    '',
  ];
  if(u.stats) lines.push('Key stats: '+u.stats);
  if(u.gpa) lines.push('GPA: '+u.gpa+(u.test?', '+u.test:''));
  if(u.film) lines.push('Film: '+u.film);
  if(u.stats||u.gpa||u.film) lines.push('');
  lines.push("I'd welcome the chance to talk and can send film or transcripts anytime.");
  lines.push('');
  lines.push('Thank you,');
  lines.push(`${u.firstName} ${u.lastName}`);
  if(u.email) lines.push(u.email);
  return lines.join('\n');
}

function copyEmail(){ const t=`To: ${document.getElementById('composeTo').value}\nSubject: ${document.getElementById('composeSubject').value}\n\n${document.getElementById('composeBody').value}`; navigator.clipboard.writeText(t).then(()=>alert('Copied!')); }
function sendEmail(){
  const coach=allCoaches().find(c=>c.id===appState.currentCoach); if(!coach)return;
  const to=encodeURIComponent(document.getElementById('composeTo').value);
  const subject=encodeURIComponent(document.getElementById('composeSubject').value);
  const body=encodeURIComponent(document.getElementById('composeBody').value);
  window.location.href=`mailto:${to}?subject=${subject}&body=${body}`;
  appState.contacted.push({ coachId:coach.id, sentAt:new Date().toISOString(), status:'sent' });
  saveState(); closeCompose(); renderEverything();
}

// ============= OUTREACH =============
function renderOutreach(){
  const list=document.getElementById('outreachList'); if(!list)return;
  if(appState.contacted.length===0){ list.innerHTML='<div class="card"><div class="empty"><div class="big">No emails sent yet</div><div>Start reaching out and track it all here.</div><br><button class="btn btn-primary" onclick="switchView(\'coaches\')">Find coaches</button></div></div>'; return; }
  list.innerHTML='<div class="card"><h3>'+appState.contacted.length+' emails sent</h3><div class="coach-list">'+appState.contacted.slice().reverse().map(item=>{ const c=allCoaches().find(x=>x.id===item.coachId); if(!c)return''; const days=Math.floor((Date.now()-new Date(item.sentAt))/86400000); const fu=days>=7&&item.status==='sent'; return `<div class="coach-row"><div class="coach-avatar">${c.name.split(' ').map(n=>n[0]).slice(0,2).join('')}</div><div class="coach-info"><div class="coach-name">${c.name}</div><div class="coach-meta"><span>${c.school}</span><span class="sport-tag">${item.status}</span><span style="color:var(--text-faint);">${humanTime(item.sentAt)}</span>${fu?'<span class="tier-badge tier-reach">FOLLOW UP</span>':''}</div></div><div class="coach-actions">${item.status!=='replied'?`<button class="btn btn-sm" onclick="markReplied('${item.coachId}')">Mark replied</button>`:'<span style="color:var(--green); font-size:12px;">✓ Replied</span>'}</div></div>`; }).join('')+'</div></div>';
}
function markReplied(id){ const i=appState.contacted.find(c=>c.coachId===id); if(i){ i.status='replied'; saveState(); renderEverything(); } }

// ============= SCHOOLS =============
function renderSchools(){
  const el=document.getElementById('schoolsList'); if(!el||!appState.user)return;
  const schools={}; coachesForUser().forEach(c=>{ if(!schools[c.school])schools[c.school]={name:c.school,conference:c.conference,tier:c.tier,coaches:[]}; schools[c.school].coaches.push(c); });
  const tiers={reach:[],match:[],safety:[]}; Object.values(schools).forEach(s=>{ if(tiers[s.tier])tiers[s.tier].push(s); });
  const desc={reach:'Top programs — aim high.',match:'Strong fits for your profile — highest yield.',safety:'Strong odds for you — don\'t overlook.'};
  el.innerHTML=['reach','match','safety'].map(t=>`<div class="card" style="margin-bottom:16px;"><h3><span class="tier-badge tier-${t}">${t}</span> &nbsp; ${tiers[t].length} schools</h3><p style="font-size:13px; color:var(--text-dim); margin-bottom:12px;">${desc[t]}</p><div class="coach-list">${tiers[t].map(s=>`<div class="coach-row"><div class="coach-avatar">${s.name.split(' ').map(w=>w[0]).slice(0,2).join('')}</div><div class="coach-info"><div class="coach-name">${s.name}</div><div class="coach-meta"><span class="sport-tag">${s.conference}</span><span>${s.coaches.length} coach(es)</span></div></div><div class="coach-actions"><button class="btn btn-sm" onclick="switchView('coaches')">View →</button></div></div>`).join('')||'<div class="empty">No schools in this tier yet.</div>'}</div></div>`).join('');
}

// ============= PROFILE =============
function renderProfile(){
  const el=document.getElementById('profileCard'); if(!el||!appState.user)return; const u=appState.user;
  el.innerHTML=`<div class="card"><h3>Athlete profile</h3><div style="display:grid; grid-template-columns:120px 1fr; gap:12px 24px; font-size:14px;"><div style="color:var(--text-dim);">Name</div><div>${u.firstName} ${u.lastName}</div><div style="color:var(--text-dim);">Sport</div><div>${prettyPosition(u)}</div><div style="color:var(--text-dim);">Grad year</div><div>Class of ${u.gradYear}</div><div style="color:var(--text-dim);">High school</div><div>${u.highSchool||'—'}</div><div style="color:var(--text-dim);">Height/Weight</div><div>${u.height||'—'}${u.weight?', '+u.weight+' lbs':''}</div><div style="color:var(--text-dim);">GPA / Test</div><div>${u.gpa||'—'}${u.test?' · '+u.test:''}</div><div style="color:var(--text-dim);">Stats</div><div>${u.stats||'—'}</div><div style="color:var(--text-dim);">Film</div><div>${u.film?`<a href="${u.film}" target="_blank" style="color:var(--blue);">${u.film}</a>`:'—'}</div></div></div>`;
  const se=document.getElementById('set_email'); if(se)se.value=u.email||'';
}

// ============= BOOT =============
if(loadState() && appState.user){ startApp(); }
