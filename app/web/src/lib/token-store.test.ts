import { describe, expect, it } from "vitest";
import { getAccessToken, setAccessToken } from "./token-store";

describe("token store", () => {
  it("starts empty", () => {
    expect(getAccessToken()).toBeNull();
  });

  it("holds a token in memory", () => {
    setAccessToken("jwt-abc");
    expect(getAccessToken()).toBe("jwt-abc");
  });

  it("clears back to null", () => {
    setAccessToken("jwt-abc");
    setAccessToken(null);
    expect(getAccessToken()).toBeNull();
  });

  it("never touches web storage — the token must not survive a reload", () => {
    setAccessToken("jwt-abc");
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.getItem("access_token")).toBeNull();
  });
});
