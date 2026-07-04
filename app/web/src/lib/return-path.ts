// Lets a page that requires auth (checkout) send the user to /signin and
// land back where they were after a successful login, without any backend
// support for a redirect param (the magic-link email URL is built entirely
// server-side with no room for one). sessionStorage is fine here — it's
// just a path string, not session-sensitive data.
const KEY = "post_login_return_path";

export function setReturnPath(path: string): void {
  try {
    sessionStorage.setItem(KEY, path);
  } catch {
    // sessionStorage unavailable (e.g. private browsing) — non-fatal, just no return-path
  }
}

export function consumeReturnPath(): string | null {
  try {
    const path = sessionStorage.getItem(KEY);
    if (path) sessionStorage.removeItem(KEY);
    return path;
  } catch {
    return null;
  }
}
