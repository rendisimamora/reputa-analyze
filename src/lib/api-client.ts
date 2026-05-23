/**
 * Client-side auth + fetch helper.
 *
 * - Token is stored in localStorage under 'reputascan_token'.
 * - apiFetch() is a drop-in replacement for `fetch` that automatically attaches
 *   `Authorization: Bearer <token>` header AND handles 401 by redirecting to /login.
 * - getToken / setToken / clearToken expose the storage primitives for the
 *   login/logout pages.
 *
 * Why localStorage instead of cookie? Because the user explicitly chose
 * Bearer-token auth so the same API can be hit by mobile apps / Postman /
 * external integrations. Cookies wouldn't help those cases.
 *
 * XSS hardening: this file is loaded by client components only; the token
 * never reaches server-rendered HTML. Make sure dependencies (markdown
 * renderers, dangerouslySetInnerHTML, etc) are audited — XSS would expose
 * the token via localStorage.
 */

const TOKEN_KEY = 'reputascan_token';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* quota / private mode — silently ignore */
  }
}

export function clearToken(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

export interface ApiFetchOptions extends Omit<RequestInit, 'headers'> {
  headers?: Record<string, string>;
  /** Set to true to suppress auto-redirect on 401 (e.g., for /api/auth/me probe). */
  noRedirectOn401?: boolean;
}

/**
 * Wrapper around `fetch` that attaches the bearer token + sane defaults.
 * On 401, clears the local token and redirects to /login (unless noRedirectOn401).
 */
export async function apiFetch(input: RequestInfo | URL, init: ApiFetchOptions = {}): Promise<Response> {
  const { noRedirectOn401, headers: extraHeaders, ...rest } = init;
  const token = getToken();
  const headers: Record<string, string> = { ...(extraHeaders ?? {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  // JSON body shortcut: if body is a plain object, stringify + set content-type.
  // Keep it backwards compatible — only auto-process when body is non-string and not FormData/Blob.
  if (
    rest.body &&
    typeof rest.body === 'object' &&
    !(rest.body instanceof FormData) &&
    !(rest.body instanceof Blob) &&
    !(rest.body instanceof ArrayBuffer) &&
    !(rest.body instanceof URLSearchParams)
  ) {
    if (!headers['Content-Type'] && !headers['content-type']) {
      headers['Content-Type'] = 'application/json';
    }
    rest.body = JSON.stringify(rest.body);
  }

  const res = await fetch(input, { ...rest, headers });
  if (res.status === 401 && !noRedirectOn401 && typeof window !== 'undefined') {
    clearToken();
    // Save where we were so user can come back after re-login (optional UX).
    const here = window.location.pathname + window.location.search;
    if (here && here !== '/login') {
      try {
        sessionStorage.setItem('reputascan_redirect_after_login', here);
      } catch {
        /* ignore */
      }
    }
    window.location.href = '/login';
  }
  return res;
}
