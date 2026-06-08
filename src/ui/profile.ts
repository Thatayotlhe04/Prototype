import { signInWithEmail, signOut, onAuth, getProfile, saveProfile, type Profile } from '../data/supabase';
import { modelTrainingEnabled, setModelTrainingEnabled } from '../pandora';

type View = 'menu' | 'profile' | 'settings' | 'privacy' | 'terms' | 'share';

const ICONS = {
  profile: '<circle cx="12" cy="8" r="3.4"/><path d="M5.5 20a6.5 6.5 0 0113 0"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1"/>',
  privacy: '<path d="M12 3l7 3v5c0 4.4-3 7.7-7 9-4-1.3-7-4.6-7-9V6l7-3z"/><path d="M9.5 12l1.8 1.8 3.2-3.6"/>',
  terms: '<path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4M9.5 12h5M9.5 15.5h5"/>',
  share: '<circle cx="6" cy="12" r="2.4"/><circle cx="17" cy="6" r="2.4"/><circle cx="17" cy="18" r="2.4"/><path d="M8.1 10.9l6.8-3.8M8.1 13.1l6.8 3.8"/>',
  chev: '<path d="M9 6l6 6-6 6"/>',
  back: '<path d="M15 6l-6 6 6 6"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>'
};
const PRIVACY = [
  ['', 'Project Prototype is a map of Gaborone. This policy explains what we collect and why, in plain terms. It is a starting template — have it reviewed against the Data Protection Act, 2018 before launch.'],
  ['What we collect', 'Account details you provide (email, display name). Optional places you submit, with their coordinates. Basic app preferences (theme, units). We do not track your live location unless you tap “locate”, and that position is used only to centre the map — it is not stored.'],
  ['Lawful basis & consent', 'Location tied to a person is personal data under Botswana’s Data Protection Act. We only store places you submit when you have given explicit consent, recorded with the submission. You can withdraw consent in Settings at any time.'],
  ['How it is used', 'Submitted places help improve map accuracy and coverage. Pandora model_training is enabled by default and may be used for externally distributed or saleable datasets and machine-learning systems. You can opt out in Settings at any time.'],
  ['Pandora', 'Prototype may send map views, searches, place corrections, and related usage metadata to Pandora. If model_training is off, raw search text is omitted and only internal product_improvement metadata is sent.'],
  ['Your rights', 'You may request access to, correction of, or deletion of your data, and you may object to processing. Contact the operator to exercise these rights.'],
  ['Retention & security', 'Data is stored on managed infrastructure with row-level access controls so each account can reach only its own records. We keep data only as long as needed for the purposes above.']
];
const TERMS = [
  ['', 'By using Project Prototype you agree to these terms. Template only — review with a lawyer before launch.'],
  ['The service', 'Project Prototype provides maps, search and routing for Gaborone. Map geometry is approximate in places and provided “as is”; do not rely on it for emergencies or precise navigation.'],
  ['Your account', 'You are responsible for activity under your account and for the accuracy of places you submit. Don’t submit unlawful, misleading, or infringing content.'],
  ['Acceptable use', 'No scraping, automated bulk submission, or attempts to disrupt or overload the service. Submission limits apply and abuse may lead to suspension.'],
  ['Content you submit', 'You keep ownership of what you submit but grant us a licence to use it to operate and improve the service. Pandora model_training is enabled by default for future model and dataset development, including external distribution or sale, unless you opt out in Settings.'],
  ['Liability', 'The service is provided without warranties. To the extent permitted by law, we are not liable for losses arising from its use.']
];

let view: View = 'menu';
let user: { id: string; email?: string } | null = null;
let profile: Profile | null = null;

const LS = 'pp.settings';
function localSettings(): { theme: 'dark' | 'light'; units: 'km' | 'mi'; consent: boolean } {
  try { return { theme: 'dark', units: 'km', consent: false, ...JSON.parse(localStorage.getItem(LS) || '{}') }; }
  catch { return { theme: 'dark', units: 'km', consent: false }; }
}
function setLocal(p: Partial<{ theme: string; units: string; consent: boolean }>) {
  try { localStorage.setItem(LS, JSON.stringify({ ...localSettings(), ...p })); } catch {}
}

let root: HTMLElement, scrim: HTMLElement, body: HTMLElement, titleEl: HTMLElement, backBtn: HTMLElement;

export function initProfile() {
  scrim = document.createElement('div'); scrim.className = 'scrim';
  root = document.createElement('div'); root.className = 'modal'; root.setAttribute('role', 'dialog');
  root.innerHTML =
    `<div class="mhead">
       <button class="back" aria-label="Back"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS.back}</svg></button>
       <div class="mt">Account</div>
       <button class="x" aria-label="Close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">${ICONS.x}</svg></button>
     </div>
     <div class="mbody"></div>`;
  document.body.append(scrim, root);
  body = root.querySelector('.mbody')!; titleEl = root.querySelector('.mt')!; backBtn = root.querySelector('.back')!;

  document.getElementById('profileBtn')?.addEventListener('click', open);
  scrim.addEventListener('click', close);
  root.querySelector('.x')!.addEventListener('click', close);
  backBtn.addEventListener('click', () => go('menu'));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && scrim.classList.contains('on')) close(); });

  // hydrate from local immediately, then from profile when signed in
  const s = localSettings();
  dispatch('app:theme', s.theme); dispatch('app:units', s.units);

  onAuth(async (u) => {
    user = u;
    document.getElementById('profileBtn')?.classList.toggle('in', !!u);
    profile = u ? await getProfile() : null;
    if (profile) { dispatch('app:theme', profile.theme); dispatch('app:units', profile.units); }
    if (scrim.classList.contains('on')) render();
  });
}

function open() { go('menu'); scrim.classList.add('on'); root.classList.add('on'); }
function close() { scrim.classList.remove('on'); root.classList.remove('on'); }
function go(v: View) { view = v; render(); }
const dispatch = (name: string, detail: any) => window.dispatchEvent(new CustomEvent(name, { detail }));
const cur = () => ({ theme: (profile?.theme ?? localSettings().theme) as 'dark' | 'light', units: (profile?.units ?? localSettings().units) as 'km' | 'mi', consent: profile?.data_consent ?? localSettings().consent });

function render() {
  const titles: Record<View, string> = { menu: 'Account', profile: 'Profile', settings: 'Settings', privacy: 'Privacy Policy', terms: 'Terms of Use', share: 'Share' };
  titleEl.textContent = titles[view];
  backBtn.classList.toggle('on', view !== 'menu');
  if (view === 'menu') return renderMenu();
  if (view === 'profile') return renderProfile();
  if (view === 'settings') return renderSettings();
  if (view === 'share') return renderShare();
  return renderLegal(view === 'privacy' ? PRIVACY : TERMS);
}

function rowBtn(key: keyof typeof ICONS, label: string, v: View) {
  const b = document.createElement('button'); b.className = 'prow';
  b.innerHTML = `<span class="pi"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${ICONS[key]}</svg></span><span>${label}</span><span class="chev"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS.chev}</svg></span>`;
  b.addEventListener('click', () => go(v));
  return b;
}

function renderMenu() {
  body.innerHTML = '';
  const id = document.createElement('div'); id.className = 'idcard';
  id.innerHTML = `<div class="pic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${ICONS.profile}</svg></div>
    <div class="who"><div class="nm">${user ? (profile?.display_name || 'Your account') : 'Guest'}</div><div class="em">${user ? (user.email || 'signed in') : 'Not signed in'}</div></div>`;
  body.append(id);
  body.append(rowBtn('profile', 'Profile', 'profile'));
  body.append(rowBtn('settings', 'Settings', 'settings'));
  body.append(rowBtn('share', 'Share Gaborone', 'share'));
  body.append(rowBtn('privacy', 'Privacy Policy', 'privacy'));
  body.append(rowBtn('terms', 'Terms of Use', 'terms'));
}

function renderProfile() {
  body.innerHTML = '';
  if (!user) {
    const wrap = document.createElement('div');
    wrap.innerHTML = `<div class="field-row"><label>Email</label><input id="ppEmail" type="email" placeholder="you@example.com" autocomplete="email"></div>`;
    const btn = document.createElement('button'); btn.className = 'mbtn'; btn.textContent = 'Send sign-in link';
    const note = document.createElement('div'); note.className = 'mnote'; note.textContent = 'We’ll email you a magic link — no password.';
    btn.addEventListener('click', async () => {
      const email = (document.getElementById('ppEmail') as HTMLInputElement)?.value.trim();
      if (!email) return;
      btn.disabled = true; btn.textContent = 'Sending…';
      const r = await signInWithEmail(email);
      note.textContent = r.ok ? 'Check your inbox for the sign-in link.' : (r.reason === 'supabase_not_configured' ? 'Connect Supabase (.env) to enable accounts.' : 'Could not send link: ' + r.reason);
      btn.disabled = false; btn.textContent = 'Send sign-in link';
    });
    wrap.append(btn, note); body.append(wrap); return;
  }
  const name = profile?.display_name || '';
  const wrap = document.createElement('div');
  wrap.innerHTML = `<div class="field-row"><label>Display name</label><input id="ppName" type="text" maxlength="80" value="${name.replace(/"/g, '&quot;')}" placeholder="Your name"></div>
    <div class="field-row"><label>Email</label><input type="email" value="${(user.email || '').replace(/"/g, '&quot;')}" disabled></div>`;
  const save = document.createElement('button'); save.className = 'mbtn'; save.textContent = 'Save profile';
  const out = document.createElement('button'); out.className = 'mbtn ghost'; out.style.marginTop = '9px'; out.textContent = 'Sign out';
  const note = document.createElement('div'); note.className = 'mnote';
  save.addEventListener('click', async () => {
    const dn = (document.getElementById('ppName') as HTMLInputElement)?.value.trim();
    save.disabled = true; const r = await saveProfile({ display_name: dn });
    if (r.ok && profile) profile.display_name = dn;
    note.textContent = r.ok ? 'Saved.' : 'Could not save: ' + r.reason; save.disabled = false;
  });
  out.addEventListener('click', async () => { await signOut(); go('menu'); });
  wrap.append(save, out, note); body.append(wrap);
}

function renderSettings() {
  body.innerHTML = '';
  const s = cur();
  // theme
  const themeRow = segRow('Appearance', [['dark', 'Dark'], ['light', 'Light']], s.theme, (v) => {
    dispatch('app:theme', v); setLocal({ theme: v }); if (user) saveProfile({ theme: v as any });
  });
  // units
  const unitRow = segRow('Distance units', [['km', 'Kilometres'], ['mi', 'Miles']], s.units, (v) => {
    dispatch('app:units', v); setLocal({ units: v }); if (user) saveProfile({ units: v as any });
  });
  // consent toggle
  const consent = toggleRow('Contribute place data', 'Allow places you submit to be stored and used to improve the map. Required to add places. Withdraw anytime.', s.consent, (on) => {
    setLocal({ consent: on }); if (user) saveProfile({ data_consent: on });
  });
  const training = toggleRow('Pandora model training', 'Enabled by default. Turn off to stop future raw map/search activity from being sent to model_training datasets.', modelTrainingEnabled(), (on) => {
    setModelTrainingEnabled(on);
  });
  body.append(themeRow, unitRow, consent, training);
  if (!user) { const n = document.createElement('div'); n.className = 'mnote'; n.textContent = 'Sign in to sync settings across devices.'; body.append(n); }
}

function segRow(label: string, opts: [string, string][], value: string, on: (v: string) => void) {
  const wrap = document.createElement('div'); wrap.className = 'field-row';
  const seg = document.createElement('div'); seg.className = 'segpill';
  opts.forEach(([val, lbl]) => {
    const b = document.createElement('button'); b.textContent = lbl; if (val === value) b.classList.add('on');
    b.addEventListener('click', () => { seg.querySelectorAll('button').forEach(x => x.classList.remove('on')); b.classList.add('on'); on(val); });
    seg.append(b);
  });
  wrap.innerHTML = `<label>${label}</label>`; wrap.append(seg); return wrap;
}
function toggleRow(name: string, desc: string, value: boolean, on: (v: boolean) => void) {
  const row = document.createElement('div'); row.className = 'toggle-row';
  row.innerHTML = `<div class="tl"><div class="tn">${name}</div><div class="td">${desc}</div></div>`;
  const sw = document.createElement('div'); sw.className = 'sw' + (value ? ' on' : ''); sw.setAttribute('role', 'switch');
  sw.addEventListener('click', () => { const next = !sw.classList.contains('on'); sw.classList.toggle('on', next); on(next); });
  row.append(sw); return row;
}

function renderShare() {
  body.innerHTML = '';
  const url = window.location.href;
  const wrap = document.createElement('div');
  wrap.innerHTML = `<div class="field-row"><label>Link</label><input type="text" value="${url}" readonly id="ppLink"></div>`;
  const sBtn = document.createElement('button'); sBtn.className = 'mbtn'; sBtn.textContent = 'Share…';
  const cBtn = document.createElement('button'); cBtn.className = 'mbtn ghost'; cBtn.style.marginTop = '9px'; cBtn.textContent = 'Copy link';
  const note = document.createElement('div'); note.className = 'mnote';
  sBtn.addEventListener('click', async () => {
    if (navigator.share) { try { await navigator.share({ title: 'Gaborone — Project Prototype', text: 'A map of Gaborone', url }); } catch {} }
    else { note.textContent = 'Sharing not supported here — copy the link instead.'; }
  });
  cBtn.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(url); note.textContent = 'Link copied.'; }
    catch { (document.getElementById('ppLink') as HTMLInputElement)?.select(); note.textContent = 'Press ⌘/Ctrl+C to copy.'; }
  });
  wrap.append(sBtn, cBtn, note); body.append(wrap);
}

function renderLegal(sections: string[][]) {
  const d = document.createElement('div'); d.className = 'legal';
  d.innerHTML = sections.map(([h, p]) => (h ? `<h4>${h}</h4>` : '') + `<p>${p}</p>`).join('') +
    `<p class="meta">Last updated on first deploy. This is a template, not legal advice.</p>`;
  body.innerHTML = ''; body.append(d);
}
