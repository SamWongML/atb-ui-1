// Contract tests for the MSW dev-auth handlers. The seam under test is the
// handler set: given an HTTP request to a mocked path, assert the status and
// body. Runs via msw/node's setupServer.
//
// Handlers use relative paths (the app runs the api client with a same-origin
// base URL of ""). MSW resolves those against `location`, so the requests here
// are built from the jsdom origin to match.
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { setupServer } from "msw/node";
import { handlers } from "./handlers";
import { mockUser, mockWorkspaces } from "./fixtures";

const server = setupServer(...handlers);
const BASE = window.location.origin;

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("mock handlers — auth session", () => {
  it("POST /auth/verify-code returns a { token, user } login response", async () => {
    const res = await fetch(`${BASE}/auth/verify-code`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "anyone@example.com", code: "000000" }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { token: string; user: unknown };
    expect(typeof body.token).toBe("string");
    expect(body.token.length).toBeGreaterThan(0);
    expect(body.user).toEqual(mockUser);
  });

  it("GET /api/me returns 401 without the session cookie", async () => {
    const res = await fetch(`${BASE}/api/me`);
    expect(res.status).toBe(401);
  });

  it("GET /api/me returns the user when the atb_logged_in cookie is present", async () => {
    const res = await fetch(`${BASE}/api/me`, {
      headers: { Cookie: "atb_logged_in=1" },
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(mockUser);
  });
});

describe("mock handlers — boot + static endpoints", () => {
  it("GET /api/config returns dev defaults with signup allowed", async () => {
    const res = await fetch(`${BASE}/api/config`);

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      cdn_domain: string;
      allow_signup: boolean;
    };
    expect(body.allow_signup).toBe(true);
    expect(typeof body.cdn_domain).toBe("string");
  });

  it("POST /auth/send-code resolves with 204 No Content", async () => {
    const res = await fetch(`${BASE}/auth/send-code`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "anyone@example.com" }),
    });

    expect(res.status).toBe(204);
  });

  it("POST /auth/logout resolves with 204 No Content", async () => {
    const res = await fetch(`${BASE}/auth/logout`, { method: "POST" });

    expect(res.status).toBe(204);
  });

  it("GET /api/workspaces returns at least one workspace with a slug", async () => {
    const res = await fetch(`${BASE}/api/workspaces`);

    expect(res.status).toBe(200);
    const body = (await res.json()) as typeof mockWorkspaces;
    expect(body).toEqual(mockWorkspaces);
    expect(body.length).toBeGreaterThan(0);
    expect(body[0]?.slug).toBeTruthy();
  });
});
