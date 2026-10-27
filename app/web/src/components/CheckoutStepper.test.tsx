import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import CheckoutStepper from "./CheckoutStepper";

const LABELS = ["مراجعة الرحلة", "بيانات المسافرين", "الدفع الآمن"];

describe("CheckoutStepper", () => {
  it("names all three booking steps", () => {
    render(<CheckoutStepper current={1} />);
    for (const label of LABELS) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it("marks only the completed steps with a tick", () => {
    render(<CheckoutStepper current={3} />);
    expect(screen.getAllByText("check")).toHaveLength(2);
    expect(screen.getByText("lock")).toBeInTheDocument();
  });

  it("shows no tick on the first step", () => {
    render(<CheckoutStepper current={1} />);
    expect(screen.queryByText("check")).not.toBeInTheDocument();
    expect(screen.getByText("flight")).toBeInTheDocument();
  });

  it("highlights the current step", () => {
    render(<CheckoutStepper current={2} />);
    expect(screen.getByText("بيانات المسافرين").className).toContain("text-primary");
    expect(screen.getByText("الدفع الآمن").className).toContain("text-outline");
  });

  it("keeps the passenger-details icon while that step is current", () => {
    render(<CheckoutStepper current={2} />);
    expect(screen.getByText("group")).toBeInTheDocument();
    expect(screen.getAllByText("check")).toHaveLength(1);
  });
});
