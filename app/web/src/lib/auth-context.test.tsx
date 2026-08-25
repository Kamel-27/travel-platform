import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthProvider, useAuth } from "./auth-context";
import { getAccessToken, setAccessToken } from "./token-store";
import type { SessionResponse } from "./types";

const SESSION: SessionResponse = {
  access_token: "jwt-fresh",
  expires_in: 900,
  user: {
    id: "u_1",
    email: "traveller@example.com",
    full_name: "مسافر تجريبي",
    phone: null,
    role: "user",
  },
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function unauthorized(): Response {
  return jsonResponse(401, { error: { code: "NO_SESSION", message: "no refresh cookie", details: {} } });
}

/** Renders the whole context surface so each test can assert on it. */
function AuthProbe() {
  const { user, isLoading, isAuthenticated, login, logout } = useAuth();
  return (
    <div>
      <span data-testid="loading">{String(isLoading)}</span>
      <span data-testid="authenticated">{String(isAuthenticated)}</span>
      <span data-testid="email">{user?.email ?? "none"}</span>
      <button onClick={() => login({ ...SESSION, access_token: "jwt-from-login" })}>login</button>
      <button onClick={() => void logout()}>logout</button>
    </div>
  );
}

function renderWithProvider() {
  return render(
    <AuthProvider>
      <AuthProbe />
    </AuthProvider>,
  );
}

const settled = () => waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("false"));

beforeEach(() => {
  setAccessToken(null);
});

describe("session hydration on mount", () => {
  it("recovers the session from the refresh cookie", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, SESSION)));

    renderWithProvider();
    await settled();

    expect(screen.getByTestId("authenticated")).toHaveTextContent("true");
    expect(screen.getByTestId("email")).toHaveTextContent("traveller@example.com");
    // The access token lives in memory only — this is where it gets put back.
    expect(getAccessToken()).toBe("jwt-fresh");
  });

  it("calls the refresh endpoint without a retry loop or an Authorization header", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, SESSION));
    vi.stubGlobal("fetch", fetchMock);
    setAccessToken("stale-jwt");

    renderWithProvider();
    await settled();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("http://localhost:3001/api/v1/auth/refresh");
    expect((fetchMock.mock.calls[0][1] as RequestInit).headers).not.toHaveProperty("Authorization");
  });

  it("settles as logged out when there is no valid refresh cookie", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => unauthorized()));
    setAccessToken("stale-jwt");

    renderWithProvider();
    await settled();

    expect(screen.getByTestId("authenticated")).toHaveTextContent("false");
    expect(screen.getByTestId("email")).toHaveTextContent("none");
    expect(getAccessToken()).toBeNull();
  });

  it("settles as logged out when the API is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    renderWithProvider();
    await settled();

    expect(screen.getByTestId("authenticated")).toHaveTextContent("false");
  });

  it("starts in a loading state so guarded pages don't redirect too early", () => {
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise(() => {})));

    renderWithProvider();

    expect(screen.getByTestId("loading")).toHaveTextContent("true");
    expect(screen.getByTestId("authenticated")).toHaveTextContent("false");
  });
});

describe("login", () => {
  it("stores the token and the user from a completed sign-in", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => unauthorized()));
    renderWithProvider();
    await settled();

    await userEvent.click(screen.getByRole("button", { name: "login" }));

    expect(screen.getByTestId("authenticated")).toHaveTextContent("true");
    expect(getAccessToken()).toBe("jwt-from-login");
  });
});

describe("logout", () => {
  it("revokes the session server-side and clears it locally", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, SESSION))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    renderWithProvider();
    await settled();

    await userEvent.click(screen.getByRole("button", { name: "logout" }));

    await waitFor(() => expect(screen.getByTestId("authenticated")).toHaveTextContent("false"));
    expect(fetchMock.mock.calls[1][0]).toBe("http://localhost:3001/api/v1/auth/logout");
    expect(getAccessToken()).toBeNull();
  });

  it("clears the local session even when the server-side revoke fails", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, SESSION))
      // Both the logout call and the 401-triggered refresh retry fail. A fresh
      // Response per call: a body can only be read once.
      .mockImplementation(async () => unauthorized());
    vi.stubGlobal("fetch", fetchMock);

    renderWithProvider();
    await settled();

    await userEvent.click(screen.getByRole("button", { name: "logout" }));

    await waitFor(() => expect(screen.getByTestId("authenticated")).toHaveTextContent("false"));
    expect(getAccessToken()).toBeNull();
  });
});

describe("useAuth", () => {
  it("refuses to run outside an AuthProvider", () => {
    // React logs the error boundary trace for the throw; silence it.
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => render(<AuthProbe />)).toThrow(/must be used within an AuthProvider/);

    consoleError.mockRestore();
  });
});
