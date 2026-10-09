import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, ApiError, apiFetch, apiFetchBlob } from "./api-client";
import { getAccessToken, setAccessToken } from "./token-store";

const BASE = "http://localhost:3001/api/v1";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function errorResponse(status: number, code: string, message: string, details: unknown = {}): Response {
  return jsonResponse(status, { error: { code, message, details } });
}

/** Stubs global fetch with a queue of responses, one per call, in order. */
function stubFetchSequence(...responses: Response[]) {
  const mock = vi.fn();
  for (const res of responses) mock.mockResolvedValueOnce(res);
  vi.stubGlobal("fetch", mock);
  return mock;
}

function initOf(mock: ReturnType<typeof stubFetchSequence>, call = 0): RequestInit {
  return mock.mock.calls[call][1] as RequestInit;
}

function headersOf(mock: ReturnType<typeof stubFetchSequence>, call = 0): Record<string, string> {
  return initOf(mock, call).headers as Record<string, string>;
}

beforeEach(() => {
  setAccessToken(null);
});

describe("request building", () => {
  it("prefixes the API base and version", async () => {
    const fetchMock = stubFetchSequence(jsonResponse(200, { ok: true }));
    await api.get("/me");
    expect(fetchMock.mock.calls[0][0]).toBe(`${BASE}/me`);
  });

  it("attaches the in-memory access token", async () => {
    setAccessToken("jwt-abc");
    const fetchMock = stubFetchSequence(jsonResponse(200, {}));
    await api.get("/me");
    expect(headersOf(fetchMock).Authorization).toBe("Bearer jwt-abc");
  });

  it("sends no Authorization header when there is no token", async () => {
    const fetchMock = stubFetchSequence(jsonResponse(200, {}));
    await api.get("/flights/search");
    expect(headersOf(fetchMock).Authorization).toBeUndefined();
  });

  it("omits the token on endpoints marked public even when signed in", async () => {
    setAccessToken("jwt-abc");
    const fetchMock = stubFetchSequence(jsonResponse(200, {}));
    await api.get("/flights/search", { skipAuth: true });
    expect(headersOf(fetchMock).Authorization).toBeUndefined();
  });

  it("sends cookies so the httpOnly refresh cookie rides along", async () => {
    const fetchMock = stubFetchSequence(jsonResponse(200, {}));
    await api.get("/me");
    expect(initOf(fetchMock).credentials).toBe("include");
  });

  it("serialises the body as JSON", async () => {
    const fetchMock = stubFetchSequence(jsonResponse(200, {}));
    await api.post("/bookings", { offer_id: "off_123" });
    expect(initOf(fetchMock).body).toBe(JSON.stringify({ offer_id: "off_123" }));
    expect(headersOf(fetchMock)["Content-Type"]).toBe("application/json");
  });

  it("sends no body when none was given", async () => {
    const fetchMock = stubFetchSequence(jsonResponse(200, {}));
    await api.post("/auth/logout");
    expect(initOf(fetchMock).body).toBeUndefined();
  });

  it("lets a caller override headers", async () => {
    const fetchMock = stubFetchSequence(jsonResponse(200, {}));
    await apiFetch("/me", { headers: { "Idempotency-Key": "key-1" } });
    expect(headersOf(fetchMock)["Idempotency-Key"]).toBe("key-1");
  });

  it("maps each verb helper to its HTTP method", async () => {
    const fetchMock = stubFetchSequence(
      jsonResponse(200, {}),
      jsonResponse(200, {}),
      jsonResponse(200, {}),
      jsonResponse(200, {}),
    );
    await api.get("/a");
    await api.post("/b");
    await api.put("/c");
    await api.patch("/d");
    expect(fetchMock.mock.calls.map((c) => (c[1] as RequestInit).method)).toEqual([
      "GET",
      "POST",
      "PUT",
      "PATCH",
    ]);
  });
});

describe("response handling", () => {
  it("returns the parsed JSON body", async () => {
    stubFetchSequence(jsonResponse(200, { id: "bk_1", status: "confirmed" }));
    await expect(api.get("/bookings/bk_1")).resolves.toEqual({ id: "bk_1", status: "confirmed" });
  });

  it("returns undefined for 204 No Content instead of trying to parse it", async () => {
    stubFetchSequence(new Response(null, { status: 204 }));
    await expect(api.post("/auth/logout")).resolves.toBeUndefined();
  });

  it("returns null when a successful response is not JSON", async () => {
    stubFetchSequence(new Response("plain text", { status: 200 }));
    await expect(api.get("/health")).resolves.toBeNull();
  });

  it("turns the error envelope into an ApiError", async () => {
    stubFetchSequence(errorResponse(422, "OFFER_EXPIRED", "انتهت صلاحية العرض", { offer_id: "off_1" }));

    const err = await api.get("/bookings/bk_1").catch((e: unknown) => e);

    expect(err).toBeInstanceOf(ApiError);
    const apiError = err as ApiError;
    expect(apiError.status).toBe(422);
    expect(apiError.code).toBe("OFFER_EXPIRED");
    expect(apiError.message).toBe("انتهت صلاحية العرض");
    expect(apiError.details).toEqual({ offer_id: "off_1" });
    expect(apiError.name).toBe("ApiError");
  });

  it("falls back to INTERNAL_ERROR when the body has no envelope", async () => {
    stubFetchSequence(new Response("<html>502</html>", { status: 502, statusText: "Bad Gateway" }));

    const err = (await api.get("/me").catch((e: unknown) => e)) as ApiError;

    expect(err.code).toBe("INTERNAL_ERROR");
    expect(err.status).toBe(502);
    expect(err.details).toEqual({});
  });
});

describe("401 refresh-and-retry", () => {
  it("refreshes the session and replays the original request", async () => {
    setAccessToken("expired-jwt");
    const fetchMock = stubFetchSequence(
      errorResponse(401, "UNAUTHORIZED", "expired"),
      jsonResponse(200, { access_token: "fresh-jwt", expires_in: 900, user: { id: "u1" } }),
      jsonResponse(200, { id: "bk_1" }),
    );

    await expect(api.get("/bookings/bk_1")).resolves.toEqual({ id: "bk_1" });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[1][0]).toBe(`${BASE}/auth/refresh`);
    // The replay must carry the *new* token, not the expired one.
    expect(headersOf(fetchMock, 2).Authorization).toBe("Bearer fresh-jwt");
    expect(getAccessToken()).toBe("fresh-jwt");
  });

  it("clears the token and surfaces the 401 when the refresh fails", async () => {
    setAccessToken("expired-jwt");
    stubFetchSequence(
      errorResponse(401, "UNAUTHORIZED", "expired"),
      errorResponse(401, "NO_SESSION", "no refresh cookie"),
    );

    const err = (await api.get("/me").catch((e: unknown) => e)) as ApiError;

    expect(err.status).toBe(401);
    expect(getAccessToken()).toBeNull();
  });

  it("refreshes only once when several requests hit 401 together", async () => {
    setAccessToken("expired-jwt");
    let refreshCalls = 0;
    const seen = new Set<string>();
    const fetchMock = vi.fn(async (url: string) => {
      const href = String(url);
      if (href.endsWith("/auth/refresh")) {
        refreshCalls += 1;
        return jsonResponse(200, { access_token: "fresh-jwt", expires_in: 900, user: { id: "u1" } });
      }
      if (!seen.has(href)) {
        seen.add(href);
        return errorResponse(401, "UNAUTHORIZED", "expired");
      }
      return jsonResponse(200, { path: href });
    });
    vi.stubGlobal("fetch", fetchMock);

    await Promise.all([api.get("/me"), api.get("/bookings"), api.get("/support/tickets")]);

    expect(refreshCalls).toBe(1);
  });

  it("does not try to refresh when the caller opted out", async () => {
    const fetchMock = stubFetchSequence(errorResponse(401, "UNAUTHORIZED", "expired"));

    await expect(apiFetch("/auth/refresh", { skipAuthRetry: true })).rejects.toBeInstanceOf(ApiError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("transport failures", () => {
  it("reports a timeout as a 408 ApiError rather than a raw DOMException", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new DOMException("The operation timed out", "TimeoutError")),
    );

    const err = (await api.get("/flights/search").catch((e: unknown) => e)) as ApiError;

    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(408);
    expect(err.code).toBe("TIMEOUT");
  });

  it("reports an aborted request the same way", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new DOMException("Aborted", "AbortError")));

    const err = (await api.get("/flights/search").catch((e: unknown) => e)) as ApiError;

    expect(err.code).toBe("TIMEOUT");
  });

  it("reports an unreachable server as a NETWORK_ERROR", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    const err = (await api.get("/me").catch((e: unknown) => e)) as ApiError;

    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(0);
    expect(err.code).toBe("NETWORK_ERROR");
  });
});

describe("apiFetchBlob", () => {
  it("returns the raw blob for a PDF download", async () => {
    // Body given as a string, not a jsdom Blob: mixing jsdom's Blob into Node's
    // Response stringifies it to "[object Blob]".
    const pdf = new Response("%PDF-1.7", {
      status: 200,
      headers: { "content-type": "application/pdf" },
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(pdf));

    const blob = await apiFetchBlob("/bookings/bk_1/documents/ticket.pdf");

    expect(await blob.text()).toBe("%PDF-1.7");
    expect(blob.type).toBe("application/pdf");
  });

  it("attaches the access token", async () => {
    setAccessToken("jwt-abc");
    const fetchMock = vi.fn().mockResolvedValue(new Response("x", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await apiFetchBlob("/bookings/bk_1/documents/ticket.pdf");

    expect((fetchMock.mock.calls[0][1] as RequestInit).headers).toEqual({
      Authorization: "Bearer jwt-abc",
    });
  });

  it("raises an ApiError carrying the envelope on failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(errorResponse(404, "NOT_FOUND", "لا توجد وثيقة")));

    const err = (await apiFetchBlob("/bookings/bk_1/documents/ticket.pdf").catch(
      (e: unknown) => e,
    )) as ApiError;

    expect(err.status).toBe(404);
    expect(err.code).toBe("NOT_FOUND");
    expect(err.message).toBe("لا توجد وثيقة");
  });

  it("still raises an ApiError when the failure body is not JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("nope", { status: 500, statusText: "Server Error" })),
    );

    const err = (await apiFetchBlob("/bookings/bk_1/documents/ticket.pdf").catch(
      (e: unknown) => e,
    )) as ApiError;

    expect(err.code).toBe("INTERNAL_ERROR");
    expect(err.status).toBe(500);
  });
});
