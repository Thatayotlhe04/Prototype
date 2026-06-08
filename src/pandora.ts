const PREF_KEY = 'prototype_pandora_model_training';
const USER_KEY = 'prototype_pandora_user';
const CONSENT_KEY = 'prototype_cookie_consent';

type PandoraScope = 'product_improvement' | 'model_training';

export function modelTrainingEnabled(): boolean {
  try { return localStorage.getItem(PREF_KEY) !== 'off'; } catch { return true; }
}

export function setModelTrainingEnabled(enabled: boolean): void {
  try { localStorage.setItem(PREF_KEY, enabled ? 'on' : 'off'); } catch {}
}

export function initPandoraCookieBanner(): void {
  try {
    if (localStorage.getItem(CONSENT_KEY)) return;
  } catch {}

  const style = document.createElement('style');
  style.textContent = `
    #prototype-cookie-banner{position:fixed;left:14px;right:14px;bottom:14px;z-index:10000;max-width:520px;margin:0 auto;background:#fff;color:#14151a;border:1px solid rgba(20,21,26,.1);border-radius:22px;padding:20px;box-shadow:0 22px 64px rgba(0,0,0,.28);font-family:Inter,system-ui,sans-serif}
    #prototype-cookie-banner p{margin:0;font-size:15px;line-height:1.5;color:#262833}
    #prototype-cookie-banner .cookie-actions{display:flex;gap:10px;margin-top:18px}
    #prototype-cookie-banner button{border-radius:14px;padding:12px 20px;font:inherit;font-weight:700;font-size:15px;cursor:pointer;border:1px solid #d8dbe6}
    #prototype-cookie-banner .cookie-continue{background:#171923;color:#fff;border-color:#171923}
    #prototype-cookie-banner .cookie-reject{background:#fff;color:#171923}
  `;
  document.head.appendChild(style);

  const banner = document.createElement('div');
  banner.id = 'prototype-cookie-banner';
  banner.setAttribute('role', 'dialog');
  banner.setAttribute('aria-label', 'Cookie consent');
  banner.innerHTML = `
    <p>We use cookies to improve Prototype and build better map data. Reject opts future activity out of Pandora model training.</p>
    <div class="cookie-actions">
      <button type="button" class="cookie-continue">Continue</button>
      <button type="button" class="cookie-reject">Reject</button>
    </div>
  `;
  document.body.appendChild(banner);

  const choose = (accepted: boolean) => {
    try { localStorage.setItem(CONSENT_KEY, accepted ? 'continued' : 'rejected'); } catch {}
    setModelTrainingEnabled(accepted);
    banner.remove();
  };
  banner.querySelector('.cookie-continue')?.addEventListener('click', () => choose(true));
  banner.querySelector('.cookie-reject')?.addEventListener('click', () => choose(false));
}

export function pandoraScope(): PandoraScope {
  return modelTrainingEnabled() ? 'model_training' : 'product_improvement';
}

export function pandoraUserId(): string {
  try {
    let id = localStorage.getItem(USER_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(USER_KEY, id);
    }
    return id;
  } catch {
    return 'anonymous';
  }
}

export async function trackPandora(type: string, data: Record<string, unknown> = {}): Promise<boolean> {
  const proxyUrl = import.meta.env.VITE_PANDORA_PROXY_URL;
  if (!proxyUrl) return false;

  try {
    const res = await fetch(proxyUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        source: 'prototype',
        scope: pandoraScope(),
        type,
        userId: pandoraUserId(),
        ts: new Date().toISOString(),
        data,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
