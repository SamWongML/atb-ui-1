// Typed fixtures for the MSW dev-auth mock. Because these are annotated with
// the real `@atb/core` types, `tsc` fails the build if the `User`/`Workspace`
// contract drifts — that compile-time check is the contract anchor for the
// mock payloads (there are no zod schemas for these endpoints).
import type { User, Workspace } from "@atb/core/types";

/** Opaque bearer token returned by the mock verify-code endpoint. In cookie
 *  mode the client never persists it; it exists only to satisfy the
 *  `LoginResponse = { token, user }` shape. */
export const MOCK_TOKEN = "mock-dev-token";

/** The signed-in developer. `onboarded_at` is non-null and
 *  `starter_content_state` is terminal so post-login routing goes straight to
 *  the workspace (not /onboarding) and the starter-content dialog stays shut. */
export const mockUser: User = {
  id: "usr_mock_dev",
  name: "Dev User",
  email: "dev@auto-tobe.ai",
  avatar_url: null,
  onboarded_at: "2026-01-01T00:00:00.000Z",
  onboarding_questionnaire: {},
  starter_content_state: "dismissed",
  language: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

/** At least one workspace with a slug, or post-login routing diverts to
 *  /workspaces/new. `slug` avoids the reserved-slug list. */
export const mockWorkspaces: Workspace[] = [
  {
    id: "ws_mock_dev",
    name: "Acme",
    slug: "acme",
    description: "Mock workspace for offline dev",
    context: null,
    settings: {},
    repos: [],
    issue_prefix: "ACME",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  },
];
