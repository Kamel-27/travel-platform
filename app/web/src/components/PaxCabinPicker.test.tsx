import { describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PaxCabinPicker, { type PaxCabinValue } from "./PaxCabinPicker";

const DEFAULT_VALUE: PaxCabinValue = { adults: 1, children: 0, infants: 0, cabin: "economy" };

/**
 * The picker is controlled, so interaction tests need a parent that actually
 * applies the emitted value — otherwise every click reads from stale props.
 */
function Harness({
  initial = DEFAULT_VALUE,
  onChange,
}: {
  initial?: PaxCabinValue;
  onChange?: (value: PaxCabinValue) => void;
}) {
  const [value, setValue] = useState<PaxCabinValue>(initial);
  return (
    <PaxCabinPicker
      value={value}
      onChange={(next) => {
        onChange?.(next);
        setValue(next);
      }}
    />
  );
}

const trigger = () => screen.getByRole("button", { name: /مسافر/ });
const plus = (label: string) => screen.getByRole("button", { name: `زيادة ${label}` });
const minus = (label: string) => screen.getByRole("button", { name: `إنقاص ${label}` });

async function open(user: ReturnType<typeof userEvent.setup>) {
  await user.click(trigger());
}

describe("trigger summary", () => {
  it("describes a single passenger in the singular", () => {
    render(<Harness />);
    expect(trigger()).toHaveTextContent("مسافر واحد · الدرجة الاقتصادية");
  });

  it("uses the Arabic dual for two passengers", () => {
    render(<Harness initial={{ ...DEFAULT_VALUE, adults: 2 }} />);
    expect(trigger()).toHaveTextContent("مسافران");
  });

  it("uses the plural form for 3–10 passengers", () => {
    render(<Harness initial={{ ...DEFAULT_VALUE, adults: 2, children: 1 }} />);
    expect(trigger()).toHaveTextContent("3 مسافرين");
  });

  it("switches to the accusative singular past ten", () => {
    render(<Harness initial={{ ...DEFAULT_VALUE, adults: 9, infants: 2 }} />);
    expect(trigger()).toHaveTextContent("11 مسافراً");
  });

  it("shows the selected cabin", () => {
    render(<Harness initial={{ ...DEFAULT_VALUE, cabin: "business" }} />);
    expect(trigger()).toHaveTextContent("درجة رجال الأعمال");
  });

  it("falls back to the raw cabin key if the API ever sends an unknown one", () => {
    render(<Harness initial={{ ...DEFAULT_VALUE, cabin: "premium_first" }} />);
    expect(trigger()).toHaveTextContent("premium_first");
  });
});

describe("opening and closing", () => {
  it("is closed until the trigger is clicked", () => {
    render(<Harness />);
    expect(screen.queryByText("المسافرون")).not.toBeInTheDocument();
  });

  it("opens on click", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await open(user);
    expect(screen.getByText("المسافرون")).toBeInTheDocument();
  });

  it("closes again on a second click", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await open(user);
    await user.click(trigger());
    expect(screen.queryByText("المسافرون")).not.toBeInTheDocument();
  });

  it("closes via the done button", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await open(user);
    await user.click(screen.getByRole("button", { name: "تم" }));
    expect(screen.queryByText("المسافرون")).not.toBeInTheDocument();
  });

  it("closes on Escape", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await open(user);
    await user.keyboard("{Escape}");
    expect(screen.queryByText("المسافرون")).not.toBeInTheDocument();
  });

  it("closes when clicking outside it", async () => {
    const user = userEvent.setup();
    render(
      <div>
        <Harness />
        <button>elsewhere</button>
      </div>,
    );
    await open(user);
    await user.click(screen.getByRole("button", { name: "elsewhere" }));
    expect(screen.queryByText("المسافرون")).not.toBeInTheDocument();
  });
});

describe("passenger counts", () => {
  it("emits the new count when adults are added", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await open(user);

    await user.click(plus("بالغون"));

    expect(onChange).toHaveBeenCalledWith({ adults: 2, children: 0, infants: 0, cabin: "economy" });
  });

  it("never lets the last adult be removed", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await open(user);
    expect(minus("بالغون")).toBeDisabled();
  });

  it("caps seated passengers (adults + children) at 9", async () => {
    const user = userEvent.setup();
    render(<Harness initial={{ ...DEFAULT_VALUE, adults: 7, children: 2 }} />);
    await open(user);

    expect(plus("بالغون")).toBeDisabled();
    expect(plus("أطفال")).toBeDisabled();
  });

  it("allows a 9th seated passenger when there is room", async () => {
    const user = userEvent.setup();
    render(<Harness initial={{ ...DEFAULT_VALUE, adults: 6, children: 2 }} />);
    await open(user);

    expect(plus("بالغون")).toBeEnabled();
  });

  it("caps infants at one per adult — they travel on a lap", async () => {
    const user = userEvent.setup();
    render(<Harness initial={{ ...DEFAULT_VALUE, adults: 1, infants: 1 }} />);
    await open(user);

    expect(plus("رضع")).toBeDisabled();
  });

  it("drops an infant when the adult carrying it is removed", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness initial={{ ...DEFAULT_VALUE, adults: 2, infants: 2 }} onChange={onChange} />);
    await open(user);

    await user.click(minus("بالغون"));

    expect(onChange).toHaveBeenCalledWith({ adults: 1, children: 0, infants: 1, cabin: "economy" });
  });

  it("keeps infants untouched when adults are added", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness initial={{ ...DEFAULT_VALUE, adults: 1, infants: 1 }} onChange={onChange} />);
    await open(user);

    await user.click(plus("بالغون"));

    expect(onChange).toHaveBeenCalledWith({ adults: 2, children: 0, infants: 1, cabin: "economy" });
  });

  it("cannot take children or infants below zero", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await open(user);

    expect(minus("أطفال")).toBeDisabled();
    expect(minus("رضع")).toBeDisabled();
  });
});

describe("cabin class", () => {
  it("emits the selected cabin", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await open(user);

    await user.click(screen.getByRole("button", { name: "درجة رجال الأعمال" }));

    expect(onChange).toHaveBeenCalledWith({ ...DEFAULT_VALUE, cabin: "business" });
  });

  it("offers all four Duffel cabin classes", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await open(user);

    // Scoped to the cabin list: the trigger label repeats the selected cabin,
    // and the selected option's accessible name carries its check icon too.
    const cabinList = screen.getByText("درجة السفر").nextElementSibling as HTMLElement;
    for (const label of ["الدرجة الاقتصادية", "اقتصادية مميزة", "درجة رجال الأعمال", "الدرجة الأولى"]) {
      expect(within(cabinList).getByRole("button", { name: new RegExp(label) })).toBeInTheDocument();
    }
  });

  it("keeps the popover open after picking a cabin so counts can still be adjusted", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await open(user);

    await user.click(screen.getByRole("button", { name: "الدرجة الأولى" }));

    expect(screen.getByText("المسافرون")).toBeInTheDocument();
  });
});
