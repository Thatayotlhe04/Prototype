const PREF_KEY = 'prototype_pandora_model_training';
const USER_KEY = 'prototype_pandora_user';

type PandoraScope = 'product_improvement' | 'model_training';

export function modelTrainingEnabled(): boolean {
  try { return localStorage.getItem(PREF_KEY) !== 'off'; } catch { return true; }
}

export function setModelTrainingEnabled(enabled: boolean): void {
  try { localStorage.setItem(PREF_KEY, enabled ? 'on' : 'off'); } catch {}
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
