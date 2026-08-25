import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SiteHeader from "./SiteHeader";
import type { SessionUser } from "@/lib/types";

const auth = vi.hoisted(() => ({
  user: null as SessionUser | null,
  isAuthenticated: false,
  isLoading: false,
  login: vi.fn(),
  logout: vi.fn(),
}));

vi.mock("@/lib/auth-context", () => ({ useAuth: () => auth }));

const USER: SessionUser = {
  id: "u_1",
  email: "traveller@example.com",
  full_name: "مسافر",
  phone: null,
  role: "user",
};

function signIn(role: string) {
  auth.user = { ...USER, role };
  auth.isAuthenticated = true;
}

const link = (name: string) => screen.getByRole("link", { name });

beforeEach(() => {
  auth.user = null;
  auth.isAuthenticated = false;
  auth.logout = vi.fn();
});

describe("signed out", () => {
  it("offers sign-in instead of an account menu", () => {
    render(<SiteHeader />);
    expect(link("تسجيل الدخول")).toHaveAttribute("href", "/signin");
    expect(screen.queryByRole("button", { name: "تسجيل الخروج" })).not.toBeInTheDocument();
  });

  it("still points رحلاتي at the customer dashboard", () => {
    render(<SiteHeader />);
    expect(link("رحلاتي")).toHaveAttribute("href", "/user-dashboard");
  });
});

describe("signed in as a customer", () => {
  it("links رحلاتي and حسابي to the customer dashboard", () => {
    signIn("user");
    render(<SiteHeader />);

    expect(link("رحلاتي")).toHaveAttribute("href", "/user-dashboard");
    expect(link("حسابي")).toHaveAttribute("href", "/user-dashboard");
  });

  it("logs out on demand", async () => {
    signIn("user");
    const user = userEvent.setup();
    render(<SiteHeader />);

    await user.click(screen.getByRole("button", { name: "تسجيل الخروج" }));

    expect(auth.logout).toHaveBeenCalledOnce();
  });
});

describe("signed in as a technical admin", () => {
  it("routes رحلاتي to the admin booking queue", () => {
    signIn("technical_admin");
    render(<SiteHeader />);
    expect(link("رحلاتي")).toHaveAttribute("href", "/admin/bookings");
  });

  it("routes حسابي to the admin console", () => {
    signIn("technical_admin");
    render(<SiteHeader />);
    expect(link("حسابي")).toHaveAttribute("href", "/admin");
  });
});

describe("overlay mode", () => {
  it("is transparent over the hero before any scrolling", () => {
    const { container } = render(<SiteHeader overlay />);
    expect(container.querySelector("header")?.className).toContain("bg-transparent");
  });

  it("turns solid once the page is scrolled past the hero edge", async () => {
    const { container } = render(<SiteHeader overlay />);

    await act(async () => {
      window.scrollY = 200;
      window.dispatchEvent(new Event("scroll"));
    });

    expect(container.querySelector("header")?.className).not.toContain("bg-transparent");
  });

  it("is solid from the start on ordinary pages", () => {
    const { container } = render(<SiteHeader />);
    expect(container.querySelector("header")?.className).not.toContain("bg-transparent");
  });
});
