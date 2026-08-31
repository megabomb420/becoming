const SITE_KEY = ((import.meta as ImportMeta & { env?: { VITE_TURNSTILE_SITE_KEY?: string } }).env?.VITE_TURNSTILE_SITE_KEY ?? '');
const SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
const VERIFY_TIMEOUT_MS = 20_000;

type TurnstileWidget = string | number;
type TurnstileApi = {
  render: (container: HTMLElement, options: Record<string, unknown>) => TurnstileWidget;
  execute: (widget: TurnstileWidget) => void;
  remove: (widget: TurnstileWidget) => void;
};

declare global { interface Window { turnstile?: TurnstileApi } }

let scriptPromise: Promise<TurnstileApi> | null = null;
let activeChallenge: Promise<string> | null = null;

function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_URL}"]`);
    const script = existing ?? document.createElement('script');
    const finish = () => window.turnstile ? resolve(window.turnstile) : reject(new Error('Human verification did not load.'));
    script.addEventListener('load', finish, { once: true });
    script.addEventListener('error', () => reject(new Error('Human verification is unavailable.')), { once: true });
    if (!existing) {
      script.src = SCRIPT_URL;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
  });
  return scriptPromise;
}

export function getTurnstileToken(): Promise<string> {
  if (!SITE_KEY) return Promise.resolve('');
  if (activeChallenge) return activeChallenge;
  activeChallenge = loadTurnstile().then(api => new Promise<string>((resolve, reject) => {
    const container = document.createElement('div');
    container.className = 'turnstile-challenge';
    container.setAttribute('aria-live', 'polite');
    document.body.appendChild(container);
    let widget: TurnstileWidget | undefined;
    let settled = false;
    const cleanup = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      if (widget !== undefined) api.remove(widget);
      container.remove();
    };
    const fail = () => { cleanup(); reject(new Error('Human verification failed.')); };
    const timeout = window.setTimeout(fail, VERIFY_TIMEOUT_MS);
    widget = api.render(container, {
      sitekey: SITE_KEY,
      action: 'becoming_chat',
      appearance: 'interaction-only',
      execution: 'execute',
      theme: 'dark',
      size: 'flexible',
      callback: (token: string) => { cleanup(); resolve(token); },
      'error-callback': fail,
      'expired-callback': fail,
      'timeout-callback': fail,
    });
    if (!settled) api.execute(widget);
  })).finally(() => { activeChallenge = null; });
  return activeChallenge;
}
