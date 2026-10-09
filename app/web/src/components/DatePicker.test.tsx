import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DatePicker from "./DatePicker";

type Props = React.ComponentProps<typeof DatePicker>;

function renderPicker(overrides: Partial<Props> = {}) {
  const props: Props = {
    departureDate: "2026-09-10",
    returnDate: "2026-09-20",
    onDepartureChange: vi.fn(),
    onReturnChange: vi.fn(),
    tripType: "round-trip",
    onTripTypeChange: vi.fn(),
    ...overrides,
  };
  render(<DatePicker {...props} />);
  return props;
}

// The two triggers render before the popover, so index 0 is always the trigger
// even once the popover's own tabs add matching labels.
const departureTrigger = () => screen.getAllByRole("button", { name: /الذهاب/ })[0];
const returnTrigger = () => screen.getAllByRole("button", { name: /العودة/ })[0];
/** Day cell in the first (left-hand) rendered month. */
const day = (n: number) => screen.getAllByRole("button", { name: String(n) })[0];
const isOpen = () => screen.queryByRole("button", { name: "تأكيد" }) !== null;

describe("triggers", () => {
  it("shows both dates in Arabic long form", () => {
    renderPicker();
    expect(departureTrigger()).toHaveTextContent("10 سبتمبر 2026");
    expect(returnTrigger()).toHaveTextContent("20 سبتمبر 2026");
  });

  it("prompts for a date when none is set", () => {
    renderPicker({ departureDate: "", returnDate: "" });
    expect(departureTrigger()).toHaveTextContent("اختر التاريخ");
  });

  it("offers to add a return leg on a one-way search", () => {
    renderPicker({ tripType: "one-way", returnDate: "" });
    expect(screen.getByText("إضافة عودة")).toBeInTheDocument();
  });

  it("switches the search to round-trip when the return leg is added", async () => {
    const user = userEvent.setup();
    const props = renderPicker({ tripType: "one-way", returnDate: "" });

    await user.click(screen.getByText("إضافة عودة"));

    expect(props.onTripTypeChange).toHaveBeenCalledWith("round-trip");
    expect(isOpen()).toBe(true);
  });
});

describe("the calendar popover", () => {
  it("stays closed until a trigger is clicked", () => {
    renderPicker();
    expect(isOpen()).toBe(false);
  });

  it("opens on the month holding the departure date, plus the next one", async () => {
    const user = userEvent.setup();
    renderPicker();

    await user.click(departureTrigger());

    expect(screen.getByText("سبتمبر 2026")).toBeInTheDocument();
    expect(screen.getByText("أكتوبر 2026")).toBeInTheDocument();
  });

  it("moves forward a month", async () => {
    const user = userEvent.setup();
    renderPicker();
    await user.click(departureTrigger());

    await user.click(screen.getByRole("button", { name: "chevron_left" }));

    expect(screen.getByText("أكتوبر 2026")).toBeInTheDocument();
    expect(screen.getByText("نوفمبر 2026")).toBeInTheDocument();
  });

  it("moves back a month", async () => {
    const user = userEvent.setup();
    renderPicker();
    await user.click(departureTrigger());

    await user.click(screen.getByRole("button", { name: "chevron_right" }));

    expect(screen.getByText("أغسطس 2026")).toBeInTheDocument();
  });

  it("closes on Escape", async () => {
    const user = userEvent.setup();
    renderPicker();
    await user.click(departureTrigger());

    await user.keyboard("{Escape}");

    expect(isOpen()).toBe(false);
  });

  it("closes when clicking outside", async () => {
    const user = userEvent.setup();
    render(
      <div>
        <DatePicker
          departureDate="2026-09-10"
          returnDate="2026-09-20"
          onDepartureChange={vi.fn()}
          onReturnChange={vi.fn()}
          tripType="round-trip"
        />
        <button>elsewhere</button>
      </div>,
    );
    await user.click(screen.getAllByRole("button", { name: /الذهاب/ })[0]);

    await user.click(screen.getByRole("button", { name: "elsewhere" }));

    expect(isOpen()).toBe(false);
  });

  it("closes on confirm", async () => {
    const user = userEvent.setup();
    renderPicker();
    await user.click(departureTrigger());

    await user.click(screen.getByRole("button", { name: "تأكيد" }));

    expect(isOpen()).toBe(false);
  });
});

describe("picking dates", () => {
  it("emits an ISO date for the day that was clicked", async () => {
    const user = userEvent.setup();
    const props = renderPicker();
    await user.click(departureTrigger());

    await user.click(day(15));

    expect(props.onDepartureChange).toHaveBeenCalledWith("2026-09-15");
  });

  it("closes straight away on a one-way search", async () => {
    const user = userEvent.setup();
    renderPicker({ tripType: "one-way", returnDate: "" });
    await user.click(departureTrigger());

    await user.click(day(15));

    expect(isOpen()).toBe(false);
  });

  it("moves on to the return leg on a round trip instead of closing", async () => {
    const user = userEvent.setup();
    renderPicker();
    await user.click(departureTrigger());

    await user.click(day(15));

    expect(isOpen()).toBe(true);
  });

  it("pushes the return out a week when the departure jumps past it", async () => {
    const user = userEvent.setup();
    const props = renderPicker();
    await user.click(departureTrigger());

    await user.click(day(25));

    expect(props.onDepartureChange).toHaveBeenCalledWith("2026-09-25");
    expect(props.onReturnChange).toHaveBeenCalledWith("2026-10-02");
  });

  it("leaves a still-valid return date alone", async () => {
    const user = userEvent.setup();
    const props = renderPicker();
    await user.click(departureTrigger());

    await user.click(day(15));

    expect(props.onReturnChange).not.toHaveBeenCalled();
  });

  it("records the return date and closes", async () => {
    const user = userEvent.setup();
    const props = renderPicker();
    await user.click(returnTrigger());

    await user.click(day(25));

    expect(props.onReturnChange).toHaveBeenCalledWith("2026-09-25");
    expect(isOpen()).toBe(false);
  });

  it("restarts the range when a return earlier than the departure is picked", async () => {
    const user = userEvent.setup();
    const props = renderPicker();
    await user.click(returnTrigger());

    await user.click(day(5));

    expect(props.onDepartureChange).toHaveBeenCalledWith("2026-09-05");
    expect(props.onReturnChange).not.toHaveBeenCalled();
    expect(isOpen()).toBe(true);
  });
});

describe("minimum date", () => {
  it("disables days before it", async () => {
    const user = userEvent.setup();
    renderPicker({ minDate: "2026-09-10" });
    await user.click(departureTrigger());

    expect(day(5)).toBeDisabled();
    expect(day(15)).toBeEnabled();
  });

  it("blocks navigating to an earlier month", async () => {
    const user = userEvent.setup();
    renderPicker({ minDate: "2026-09-10" });
    await user.click(departureTrigger());

    expect(screen.getByRole("button", { name: "chevron_right" })).toBeDisabled();
  });

  it("allows going back while later months are on screen", async () => {
    const user = userEvent.setup();
    renderPicker({ minDate: "2026-08-01" });
    await user.click(departureTrigger());

    expect(screen.getByRole("button", { name: "chevron_right" })).toBeEnabled();
  });
});

describe("cancelling", () => {
  it("puts back the dates the picker opened with", async () => {
    const user = userEvent.setup();
    const props = renderPicker();
    await user.click(departureTrigger());
    await user.click(day(15));

    await user.click(screen.getByRole("button", { name: "إلغاء" }));

    expect(props.onDepartureChange).toHaveBeenLastCalledWith("2026-09-10");
    expect(props.onReturnChange).toHaveBeenLastCalledWith("2026-09-20");
    expect(isOpen()).toBe(false);
  });
});
