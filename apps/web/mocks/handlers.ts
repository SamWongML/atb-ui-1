import { http, HttpResponse } from "msw";
import { MOCK_TOKEN, mockUser, mockWorkspaces } from "./fixtures";

// Dev-only API mock. Paths are relative because the app runs the api client
// with a same-origin base URL (""); MSW matches on pathname either way.
//
// `getMe` is gated on the non-HttpOnly `atb_logged_in` cookie that the web app
// sets on login (see features/auth/auth-cookie.ts). This mirrors real
// cookie-auth: no cookie → 401 → land on /login; cookie present → the session
// resolves and survives reloads. MSW's `cookies` arg is portable — parsed from
// document.cookie in the browser and from the Cookie header under msw/node.
export const handlers = [
  // App config — the first call at boot (AuthInitializer). Non-blocking, but
  // mocking it silences an unhandled-request warning and drives allow_signup.
  http.get("/api/config", () =>
    HttpResponse.json({ cdn_domain: "", allow_signup: true }),
  ),

  // Passwordless login: any email/code is accepted in dev.
  http.post("/auth/send-code", () => new HttpResponse(null, { status: 204 })),

  http.post("/auth/verify-code", () =>
    HttpResponse.json({ token: MOCK_TOKEN, user: mockUser }),
  ),

  http.post("/auth/logout", () => new HttpResponse(null, { status: 204 })),

  // Session check, gated on the login cookie (see note above).
  http.get("/api/me", ({ cookies }) =>
    cookies.atb_logged_in === "1"
      ? HttpResponse.json(mockUser)
      : new HttpResponse(null, { status: 401 }),
  ),

  // At least one workspace with a slug, or routing diverts to /workspaces/new.
  http.get("/api/workspaces", () => HttpResponse.json(mockWorkspaces)),
];
