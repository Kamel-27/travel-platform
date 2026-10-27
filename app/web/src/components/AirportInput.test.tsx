import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AirportInput from "./AirportInput";

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

/** The backend autocomplete reaches far past the static table — HRG isn't in it. */
const REMOTE_RESULT = {
  data: [
    { code: "HRG", city: "Hurghada", country: "Egypt", type: "airport", name: "Hurghada International" },
  ],
};

function renderInput(props: Partial<React.ComponentProps<typeof AirportInput>> = {}) {
  const onChange = vi.fn();
  render(
    <AirportInput
      icon="flight_takeoff"
      value=""
      onChange={onChange}
      placeholder="من أين؟"
      {...props}
    />,
  );
  return { onChange, input: screen.getByPlaceholderText(props.placeholder ?? "من أين؟") };
}

const option = (name: RegExp | string) => screen.getByRole("button", { name });

afterEach(() => {
  vi.useRealTimers();
});

describe("display value", () => {
  it("shows nothing but the placeholder when no airport is picked", () => {
    const { input } = renderInput();
    expect(input).toHaveValue("");
  });

  it("shows the Arabic label of the selected airport", () => {
    const { input } = renderInput({ value: "DXB" });
    expect(input).toHaveValue("دبي (DXB)");
  });

  it("falls back to the bare code for an airport outside the static table", () => {
    const { input } = renderInput({ value: "HRG" });
    expect(input).toHaveValue("HRG");
  });
});

describe("the suggestion list", () => {
  it("stays closed until the field is focused", () => {
    renderInput();
    expect(screen.queryByText("المطارات الشائعة")).not.toBeInTheDocument();
  });

  it("offers the popular airports on focus", async () => {
    const user = userEvent.setup();
    const { input } = renderInput();

    await user.click(input);

    expect(screen.getByText("المطارات الشائعة")).toBeInTheDocument();
    expect(option(/الرياض/)).toBeInTheDocument();
    expect(option(/لندن/)).toBeInTheDocument();
  });

  it("still offers the popular list when re-focusing a filled field", async () => {
    const user = userEvent.setup();
    const { input } = renderInput({ value: "DXB" });

    await user.click(input);

    // The field's own label must not be treated as a search query.
    expect(screen.getByText("المطارات الشائعة")).toBeInTheDocument();
  });

  it("filters as the user types", async () => {
    const user = userEvent.setup();
    const { input } = renderInput();

    await user.click(input);
    await user.type(input, "jed");

    expect(option(/جدة/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /لندن/ })).not.toBeInTheDocument();
  });

  it("closes on Escape", async () => {
    const user = userEvent.setup();
    const { input } = renderInput();

    await user.click(input);
    await user.keyboard("{Escape}");

    expect(screen.queryByText("المطارات الشائعة")).not.toBeInTheDocument();
  });

  it("closes when the user clicks away", async () => {
    const user = userEvent.setup();
    render(
      <div>
        <AirportInput icon="" value="" onChange={vi.fn()} placeholder="من أين؟" />
        <button>elsewhere</button>
      </div>,
    );

    await user.click(screen.getByPlaceholderText("من أين؟"));
    await user.click(screen.getByRole("button", { name: "elsewhere" }));

    expect(screen.queryByText("المطارات الشائعة")).not.toBeInTheDocument();
  });
});

describe("selection", () => {
  it("emits the IATA code when a suggestion is clicked", async () => {
    const user = userEvent.setup();
    const { onChange, input } = renderInput();

    await user.click(input);
    await user.click(option(/القاهرة/));

    expect(onChange).toHaveBeenCalledWith("CAI");
  });

  it("closes the list after picking", async () => {
    const user = userEvent.setup();
    const { input } = renderInput();

    await user.click(input);
    await user.click(option(/القاهرة/));

    expect(screen.queryByText("المطارات الشائعة")).not.toBeInTheDocument();
  });

  it("picks the highlighted row with the arrow keys and Enter", async () => {
    const user = userEvent.setup();
    const { onChange, input } = renderInput();

    await user.click(input);
    // Popular list order: RUH, JED, DXB, ... — one step down lands on JED.
    await user.keyboard("{ArrowDown}{Enter}");

    expect(onChange).toHaveBeenCalledWith("JED");
  });

  it("wraps around when arrowing up from the first row", async () => {
    const user = userEvent.setup();
    const { onChange, input } = renderInput();

    await user.click(input);
    await user.keyboard("{ArrowUp}{Enter}");

    expect(onChange).toHaveBeenCalledWith("CDG");
  });

  it("ignores Enter when the list is closed", async () => {
    const user = userEvent.setup();
    const { onChange, input } = renderInput();

    await user.click(input);
    await user.keyboard("{Escape}{Enter}");

    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("backend autocomplete", () => {
  it("queries the API after the debounce and merges airports the table doesn't have", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) });
    const fetchMock = vi.fn().mockImplementation(async () => jsonResponse(REMOTE_RESULT));
    vi.stubGlobal("fetch", fetchMock);
    const { input } = renderInput();

    await user.click(input);
    await user.type(input, "hur");
    await vi.advanceTimersByTimeAsync(350);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "http://localhost:3001/api/v1/flights/airports/search?query=hur",
    );
    expect(await screen.findByRole("button", { name: /Hurghada/ })).toBeInTheDocument();
  });

  it("does not call the API for a single character", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) });
    const fetchMock = vi.fn().mockImplementation(async () => jsonResponse(REMOTE_RESULT));
    vi.stubGlobal("fetch", fetchMock);
    const { input } = renderInput();

    await user.click(input);
    await user.type(input, "h");
    await vi.advanceTimersByTimeAsync(1000);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps showing local matches when the API call fails", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    const { input } = renderInput();

    await user.click(input);
    await user.type(input, "jed");
    await vi.advanceTimersByTimeAsync(350);

    expect(option(/جدة/)).toBeInTheDocument();
    consoleError.mockRestore();
  });
});
