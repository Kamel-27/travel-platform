import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import ManageBookingsRedirect from "./page";
import type { SessionUser } from "@/lib/types";

const auth = vi.hoisted(() => ({
  user: null as SessionUser | null,
  isAuthenticated: false,
  isLoading: true,
  login: vi.fn(),
  logout: vi.fn(),
}));
const router = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn() }));

vi.mock("@/lib/auth-context", () => ({ useAuth: () => auth }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

function settle(role: string | null) {
  auth.isLoading = false;
  auth.user = role
    ? { id: "u_1", email: "t@example.com", full_name: null, phone: null, role }
    : null;
  auth.isAuthenticated = role !== null;
}

beforeEach(() => {
  auth.user = null;
  auth.isAuthenticated = false;
  auth.isLoading = true;
  router.replace = vi.fn();
});

describe("/manage-bookings", () => {
  it("waits for the session before deciding where to send the visitor", () => {
    render(<ManageBookingsRedirect />);
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("shows a redirect notice rather than a blank screen", () => {
    render(<ManageBookingsRedirect />);
    expect(screen.getByText("جاري تحويلك إلى صفحة حجوزاتك...")).toBeInTheDocument();
  });

  it("sends a customer to their dashboard", async () => {
    settle("user");
    render(<ManageBookingsRedirect />);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/user-dashboard"));
  });

  it("sends a technical admin to the admin booking queue", async () => {
    settle("technical_admin");
    render(<ManageBookingsRedirect />);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/admin/bookings"));
  });

  it("sends a signed-out visitor to the customer dashboard, which handles the auth gate", async () => {
    settle(null);
    render(<ManageBookingsRedirect />);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/user-dashboard"));
  });

  it("replaces the entry rather than pushing, so Back doesn't bounce", async () => {
    settle("user");
    render(<ManageBookingsRedirect />);
    await waitFor(() => expect(router.replace).toHaveBeenCalledOnce());
    expect(router.push).not.toHaveBeenCalled();
  });
});
