import { getAccessToken, setAccessToken } from "./token-store";
import type { SessionResponse } from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

// Flight searches proxy a live Duffel call and can legitimately take a while,
// but nothing should ever hang a page forever (nfr.md §5 — no hung spinners).
const REQUEST_TIMEOUT_MS = 45_000;

export class ApiError extends Error {
  code: string;
  status: number;
  details: Record<string, unknown>;

  constructor(status: number, code: string, message: string, details: Record<string, unknown>) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  /** Skip the 401->refresh->retry dance (used by the refresh call itself). */
  skipAuthRetry?: boolean;
  /** Skip attaching the Authorization header (public endpoints). */
  skipAuth?: boolean;
}

let refreshInFlight: Promise<boolean> | null = null;

async function refreshSession(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const session = await apiFetch<SessionResponse>("/auth/refresh", {
          method: "POST",
          skipAuthRetry: true,
          skipAuth: true,
        });
        setAccessToken(session.access_token);
        return true;
      } catch {
        setAccessToken(null);
        return false;
      } finally {
        refreshInFlight = null;
      }
    })();
  }
  return refreshInFlight;
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, skipAuthRetry, skipAuth, headers, ...rest } = options;

  const doFetch = async (): Promise<Response> => {
    const finalHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      ...(headers as Record<string, string> | undefined),
    };

    if (!skipAuth) {
      const token = getAccessToken();
      if (token) finalHeaders["Authorization"] = `Bearer ${token}`;
    }

    try {
      return await fetch(`${API_BASE}/api/v1${path}`, {
        ...rest,
        headers: finalHeaders,
        credentials: "include",
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: rest.signal ?? AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (err) {
      if (err instanceof DOMException && (err.name === "TimeoutError" || err.name === "AbortError")) {
        throw new ApiError(408, "TIMEOUT", "انتهت مهلة الاتصال بالخادم، يرجى المحاولة مرة أخرى", {});
      }
      throw new ApiError(0, "NETWORK_ERROR", "تعذر الاتصال بالخادم، تحقق من اتصالك بالإنترنت", {});
    }
  };

  let res = await doFetch();

  if (res.status === 401 && !skipAuthRetry) {
    const refreshed = await refreshSession();
    if (refreshed) {
      res = await doFetch();
    }
  }

  if (res.status === 204) {
    return undefined as T;
  }

  const contentType = res.headers.get("content-type") || "";
  const data = contentType.includes("application/json") ? await res.json() : null;

  if (!res.ok) {
    const envelope = data?.error;
    throw new ApiError(
      res.status,
      envelope?.code || "INTERNAL_ERROR",
      envelope?.message || res.statusText || "Request failed",
      envelope?.details || {},
    );
  }

  return data as T;
}

/** For binary responses (e.g. PDF downloads) — apiFetch assumes JSON. */
export async function apiFetchBlob(path: string): Promise<Blob> {
  const token = getAccessToken();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}/api/v1${path}`, {
    headers,
    credentials: "include",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!res.ok) {
    const envelope = (await res.json().catch(() => null))?.error;
    throw new ApiError(
      res.status,
      envelope?.code || "INTERNAL_ERROR",
      envelope?.message || res.statusText || "Request failed",
      envelope?.details || {},
    );
  }

  return res.blob();
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) => apiFetch<T>(path, { ...options, method: "GET" }),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: "POST", body }),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: "PUT", body }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: "PATCH", body }),
};
