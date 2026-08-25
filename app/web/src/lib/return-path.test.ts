import { beforeEach, describe, expect, it, vi } from "vitest";
import { consumeReturnPath, setReturnPath } from "./return-path";

describe("return path", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("round-trips a path", () => {
    setReturnPath("/checkout/payment?booking=abc");
    expect(consumeReturnPath()).toBe("/checkout/payment?booking=abc");
  });

  it("is consumed once — a second read returns null", () => {
    setReturnPath("/checkout");
    consumeReturnPath();
    expect(consumeReturnPath()).toBeNull();
  });

  it("returns null when nothing was stored", () => {
    expect(consumeReturnPath()).toBeNull();
  });

  it("overwrites a previously stored path", () => {
    setReturnPath("/first");
    setReturnPath("/second");
    expect(consumeReturnPath()).toBe("/second");
  });

  it("survives sessionStorage being unavailable on write (private browsing)", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("denied", "SecurityError");
    });
    expect(() => setReturnPath("/checkout")).not.toThrow();
  });

  it("survives sessionStorage being unavailable on read", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("denied", "SecurityError");
    });
    expect(consumeReturnPath()).toBeNull();
  });
});
