import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// The seam under test is the gate: with the flag off, children render and the
// worker never starts; with the flag on, the worker starts (warn on unhandled)
// and children are deferred until it is ready. `./browser` is mocked so no real
// service worker is registered in jsdom.
const { startSpy } = vi.hoisted(() => ({ startSpy: vi.fn() }));
vi.mock("./browser", () => ({ worker: { start: startSpy } }));

import { MockProvider } from "./mock-provider";

describe("MockProvider", () => {
  beforeEach(() => {
    startSpy.mockReset();
    startSpy.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("renders children and never starts the worker when the flag is off", () => {
    vi.stubEnv("NEXT_PUBLIC_ATB_MOCK_API", "");

    render(
      <MockProvider>
        <div>app content</div>
      </MockProvider>,
    );

    expect(screen.getByText("app content")).toBeInTheDocument();
    expect(startSpy).not.toHaveBeenCalled();
  });

  it("starts the worker (warn on unhandled) and renders children once ready when the flag is on", async () => {
    vi.stubEnv("NEXT_PUBLIC_ATB_MOCK_API", "1");

    render(
      <MockProvider>
        <div>app content</div>
      </MockProvider>,
    );

    // Children are deferred until the (dynamically imported) worker starts, so
    // wait for them to appear, then assert how the worker was started.
    expect(await screen.findByText("app content")).toBeInTheDocument();
    expect(startSpy).toHaveBeenCalledWith({ onUnhandledRequest: "warn" });
  });
});
