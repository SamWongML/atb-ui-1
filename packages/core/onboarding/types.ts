// The "runtime" (connect a local runtime / install the CLI) and "agent"
// (create an agent bound to that runtime) steps were removed with the
// local-runtime surfaces during the frontend extraction. Onboarding now
// runs welcome → questionnaire → workspace → first_issue; agent creation
// re-enters onboarding once cloud runtimes are modeled (see INTEGRATION.md § Deferred).
export type OnboardingStep =
  | "welcome"
  | "questionnaire"
  | "workspace"
  | "first_issue";

/**
 * Exit path from the onboarding flow. Sent to
 * POST /api/me/onboarding/complete and mirrored on the PostHog
 * `onboarding_completed` event. The api owns the canonical set (kept in sync
 * during reconciliation), so the union is left intact even though the
 * runtime-connect flow that emitted `full` / `cloud_waitlist` was removed —
 * the client now only ever emits `runtime_skipped`, `skip_existing`, or
 * `invite_accept`.
 */
export type OnboardingCompletionPath =
  | "full" // was: reached first_issue with a runtime connected (no longer emitted)
  | "runtime_skipped" // completed onboarding without a runtime — the default path now
  | "cloud_waitlist" // was: submitted the cloud waitlist (no longer emitted)
  | "skip_existing" // "I've done this before" from Welcome
  | "invite_accept"; // Accepted at least one invite from /invitations

export type TeamSize = "solo" | "team" | "other";

export type Role =
  | "developer"
  | "product_lead"
  | "writer"
  | "founder"
  | "other";

export type UseCase =
  | "coding"
  | "planning"
  | "writing_research"
  | "explore"
  | "other";

export interface QuestionnaireAnswers {
  team_size: TeamSize | null;
  team_size_other: string | null;
  role: Role | null;
  role_other: string | null;
  use_case: UseCase | null;
  use_case_other: string | null;
}
