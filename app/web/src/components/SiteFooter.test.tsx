import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import SiteFooter from "./SiteFooter";
import type { SessionUser } from "@/lib/types";

const auth = vi.hoisted(() => ({
  user: null as SessionUser | null,
  isAuthenticated: false,
  isLoading: false,
  login: vi.fn(),
  logout: vi.fn(),
}));

vi.mock("@/lib/auth-context", () => ({ useAuth: () => auth }));

function signInAs(role: string) {
  auth.user = { id: "u_1", email: "t@example.com", full_name: null, phone: null, role };
  auth.isAuthenticated = true;
}

const hrefsFor = (name: string | RegExp) =>
  screen.getAllByRole("link", { name }).map((el) => el.getAttribute("href"));

beforeEach(() => {
  auth.user = null;
  auth.isAuthenticated = false;
});

describe("legal and support links", () => {
  it("links the pages that actually exist", () => {
    render(<SiteFooter />);

    expect(screen.getByRole("link", { name: "سياسة الخصوصية" })).toHaveAttribute("href", "/privacy");
    expect(screen.getByRole("link", { name: "الشروط والأحكام" })).toHaveAttribute("href", "/terms");
    expect(screen.getByRole("link", { name: "مركز المساعدة" })).toHaveAttribute("href", "/support");
    expect(screen.getByRole("link", { name: "اتصل بنا" })).toHaveAttribute("href", "/support");
  });
});

describe("role-aware booking links", () => {
  it("sends signed-out visitors to the customer dashboard", () => {
    render(<SiteFooter />);
    expect(hrefsFor("إدارة حجوزاتي")).toEqual(["/user-dashboard"]);
  });

  it("sends customers to their own dashboard", () => {
    signInAs("user");
    render(<SiteFooter />);

    expect(hrefsFor("إدارة حجوزاتي")).toEqual(["/user-dashboard"]);
    expect(hrefsFor(/حسابي/)).toEqual(["/user-dashboard"]);
  });

  it("sends technical admins to the admin console", () => {
    signInAs("technical_admin");
    render(<SiteFooter />);

    expect(hrefsFor("إدارة حجوزاتي")).toEqual(["/admin/bookings"]);
    expect(hrefsFor(/حسابي/)).toEqual(["/admin"]);
  });

  it("keeps the mobile bottom nav in step with the role", () => {
    signInAs("technical_admin");
    render(<SiteFooter />);
    expect(hrefsFor(/حجوزاتي$/)).toContain("/admin/bookings");
  });
});
