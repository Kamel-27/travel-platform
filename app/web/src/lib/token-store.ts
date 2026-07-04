// In-memory only — never localStorage/sessionStorage. Lost on reload by
// design; AuthProvider re-hydrates via POST /auth/refresh (httpOnly cookie)
// on mount. Module-level so api-client.ts can read/attach it without a
// circular import against auth-context.tsx (which calls api-client for the
// actual network requests).
let accessToken: string | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}
