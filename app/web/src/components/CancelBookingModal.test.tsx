import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CancelBookingModal from "./CancelBookingModal";
import type { Booking, CancellationQuote } from "@/lib/types";

const BOOKING: Booking = {
  id: "bk_1",
  status: "confirmed",
  supplier: "duffel",
  booking_reference: "ABC123",
  total_amount: 2454400,
  base_amount: 2200000,
  markup_amount: 254400,
  currency: "EGP",
  created_at: "2026-07-18T10:00:00.000Z",
  updated_at: "2026-07-18T10:05:00.000Z",
  snapshot: null,
  passengers: [],
};

const REFUNDABLE_QUOTE: CancellationQuote = {
  refundable: true,
  requires_admin: false,
  penalty: { amount: 450000, currency: "EGP" },
  customer_receives: { amount: 2004400, currency: "EGP" },
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function errorResponse(status: number, code: string, message: string): Response {
  return jsonResponse(status, { error: { code, message, details: {} } });
}

/** Routes the quote GET and the cancel POST independently. */
function stubApi({
  quote,
  cancel,
}: {
  quote: () => Response;
  cancel?: () => Response;
}) {
  const fetchMock = vi.fn(async (url: string | URL, init?: RequestInit) => {
    const href = String(url);
    if (href.endsWith("/cancellation-quote")) return quote();
    if (href.endsWith("/cancel")) return cancel ? cancel() : jsonResponse(200, { requires_admin: false });
    throw new Error(`unexpected request: ${init?.method ?? "GET"} ${href}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function renderModal(overrides: Partial<React.ComponentProps<typeof CancelBookingModal>> = {}) {
  const props = {
    booking: BOOKING,
    onClose: vi.fn(),
    onCancelled: vi.fn(),
    ...overrides,
  };
  render(<CancelBookingModal {...props} />);
  return props;
}

const confirmButton = () => screen.getByRole("button", { name: "تأكيد إلغاء الحجز" });

afterEach(() => {
  vi.useRealTimers();
});

describe("loading the refund quote", () => {
  it("shows a spinner while the quote is being calculated", () => {
    stubApi({ quote: () => jsonResponse(200, REFUNDABLE_QUOTE) });
    renderModal();
    expect(screen.getByText("جاري احتساب سياسة استرداد المبلغ...")).toBeInTheDocument();
  });

  it("asks the API for this booking's quote", async () => {
    const fetchMock = stubApi({ quote: () => jsonResponse(200, REFUNDABLE_QUOTE) });
    renderModal();
    await waitFor(() =>
      expect(fetchMock.mock.calls[0][0]).toBe(
        "http://localhost:3001/api/v1/bookings/bk_1/cancellation-quote",
      ),
    );
  });

  it("renders the penalty and the refundable amount in the booking's currency", async () => {
    stubApi({ quote: () => jsonResponse(200, REFUNDABLE_QUOTE) });
    renderModal();

    expect(await screen.findByText(/4,500\.00/)).toBeInTheDocument();
    expect(screen.getByText(/20,044\.00/)).toBeInTheDocument();
    expect(screen.getByText(/24,544\.00/)).toBeInTheDocument();
  });

  it("says so when the supplier quotes no penalty figure", async () => {
    stubApi({
      quote: () =>
        jsonResponse(200, { ...REFUNDABLE_QUOTE, penalty: null, customer_receives: null }),
    });
    renderModal();

    expect(await screen.findByText("مجهول / لا يوجد")).toBeInTheDocument();
    expect(screen.getByText("كامل المبلغ")).toBeInTheDocument();
  });

  it("warns that the refund needs a human when the quote says so", async () => {
    stubApi({ quote: () => jsonResponse(200, { ...REFUNDABLE_QUOTE, requires_admin: true }) });
    renderModal();

    expect(await screen.findByText(/مراجعة يدوية من قبل الدعم الفني/)).toBeInTheDocument();
  });

  it("does not warn about manual review on an automatic refund", async () => {
    stubApi({ quote: () => jsonResponse(200, REFUNDABLE_QUOTE) });
    renderModal();

    await screen.findByText(/20,044\.00/);
    expect(screen.queryByText(/مراجعة يدوية من قبل الدعم الفني/)).not.toBeInTheDocument();
  });

  it("surfaces the API message when the quote can't be loaded", async () => {
    stubApi({ quote: () => errorResponse(404, "BOOKING_NOT_FOUND", "الحجز غير موجود") });
    renderModal();

    expect(await screen.findByText("الحجز غير موجود")).toBeInTheDocument();
  });

  it("offers no confirm button while there is no quote to confirm against", async () => {
    stubApi({ quote: () => errorResponse(409, "NOT_CANCELLABLE", "لا يمكن إلغاء هذا الحجز") });
    renderModal();

    await screen.findByText("لا يمكن إلغاء هذا الحجز");
    expect(screen.queryByRole("button", { name: "تأكيد إلغاء الحجز" })).not.toBeInTheDocument();
  });
});

describe("submitting the cancellation", () => {
  it("posts the selected reason", async () => {
    const user = userEvent.setup();
    const fetchMock = stubApi({ quote: () => jsonResponse(200, REFUNDABLE_QUOTE) });
    renderModal();
    await screen.findByText(/20,044\.00/);

    await user.selectOptions(screen.getByRole("combobox"), "medical_reason");
    await user.click(confirmButton());

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const cancelCall = fetchMock.mock.calls[1];
    expect(String(cancelCall[0])).toBe("http://localhost:3001/api/v1/bookings/bk_1/cancel");
    expect((cancelCall[1] as RequestInit).body).toBe(JSON.stringify({ reason: "medical_reason" }));
  });

  it("defaults the reason to a plan change", async () => {
    const user = userEvent.setup();
    const fetchMock = stubApi({ quote: () => jsonResponse(200, REFUNDABLE_QUOTE) });
    renderModal();
    await screen.findByText(/20,044\.00/);

    await user.click(confirmButton());

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect((fetchMock.mock.calls[1][1] as RequestInit).body).toBe(
      JSON.stringify({ reason: "customer_cancel" }),
    );
  });

  it("tells the customer the refund is under way, not already paid out", async () => {
    const user = userEvent.setup();
    stubApi({
      quote: () => jsonResponse(200, REFUNDABLE_QUOTE),
      cancel: () => jsonResponse(200, { id: "bk_1", status: "cancelled", requires_admin: false }),
    });
    renderModal();
    await screen.findByText(/20,044\.00/);

    await user.click(confirmButton());

    expect(await screen.findByText(/وجارٍ تنفيذ عملية الاسترداد/)).toBeInTheDocument();
  });

  it("shows the server's own message when the refund goes to manual review", async () => {
    const user = userEvent.setup();
    stubApi({
      quote: () => jsonResponse(200, { ...REFUNDABLE_QUOTE, requires_admin: true }),
      cancel: () =>
        jsonResponse(200, {
          id: "bk_1",
          status: "cancelled",
          requires_admin: true,
          message: "تم تسجيل طلبك وسيراجعه الدعم خلال 24 ساعة.",
        }),
    });
    renderModal();
    await screen.findByText(/20,044\.00/);

    await user.click(confirmButton());

    expect(await screen.findByText("تم تسجيل طلبك وسيراجعه الدعم خلال 24 ساعة.")).toBeInTheDocument();
  });

  it("notifies the caller so it can refresh its booking list", async () => {
    const user = userEvent.setup();
    stubApi({ quote: () => jsonResponse(200, REFUNDABLE_QUOTE) });
    const props = renderModal();
    await screen.findByText(/20,044\.00/);

    await user.click(confirmButton());

    await waitFor(() => expect(props.onCancelled).toHaveBeenCalledOnce());
  });

  it("hides the confirm button once the cancellation went through", async () => {
    const user = userEvent.setup();
    stubApi({ quote: () => jsonResponse(200, REFUNDABLE_QUOTE) });
    renderModal();
    await screen.findByText(/20,044\.00/);

    await user.click(confirmButton());

    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "تأكيد إلغاء الحجز" })).not.toBeInTheDocument(),
    );
  });

  it("keeps the modal usable when the cancel call fails", async () => {
    const user = userEvent.setup();
    stubApi({
      quote: () => jsonResponse(200, REFUNDABLE_QUOTE),
      cancel: () => errorResponse(409, "ALREADY_CANCELLED", "تم إلغاء الحجز مسبقاً"),
    });
    const props = renderModal();
    await screen.findByText(/20,044\.00/);

    await user.click(confirmButton());

    expect(await screen.findByText("تم إلغاء الحجز مسبقاً")).toBeInTheDocument();
    expect(props.onCancelled).not.toHaveBeenCalled();
  });

  it("closes itself a few seconds after a successful cancellation", async () => {
    // shouldAdvanceTime keeps the fetch promises (and RTL's own waits) moving;
    // without it the fake clock deadlocks against the pending quote request.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) });
    stubApi({ quote: () => jsonResponse(200, REFUNDABLE_QUOTE) });
    const props = renderModal();
    await screen.findByText(/20,044\.00/);

    await user.click(confirmButton());
    await screen.findByText(/وجارٍ تنفيذ عملية الاسترداد/);
    expect(props.onClose).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(3000);

    expect(props.onClose).toHaveBeenCalledOnce();
  });
});

describe("dismissing", () => {
  it("closes on the header button without cancelling anything", async () => {
    const user = userEvent.setup();
    const fetchMock = stubApi({ quote: () => jsonResponse(200, REFUNDABLE_QUOTE) });
    const props = renderModal();
    await screen.findByText(/20,044\.00/);

    await user.click(screen.getByText("close"));

    expect(props.onClose).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("closes on the back button", async () => {
    const user = userEvent.setup();
    stubApi({ quote: () => jsonResponse(200, REFUNDABLE_QUOTE) });
    const props = renderModal();
    await screen.findByText(/20,044\.00/);

    await user.click(screen.getByRole("button", { name: "تراجع" }));

    expect(props.onClose).toHaveBeenCalledOnce();
  });
});
