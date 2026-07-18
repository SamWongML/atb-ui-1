"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { captureEvent } from "@atb/core/analytics";
import { setCurrentWorkspace } from "@atb/core/platform";
import { useAuthStore } from "@atb/core/auth";
import {
  completeOnboarding,
  ONBOARDING_STEP_ORDER,
  saveQuestionnaire,
  type OnboardingStep,
  type QuestionnaireAnswers,
} from "@atb/core/onboarding";
import { workspaceListOptions } from "@atb/core/workspace/queries";
import type { Workspace } from "@atb/core/types";
import { DragStrip } from "@atb/views/platform";
import { StepHeader } from "./components/step-header";
import { StepWelcome } from "./steps/step-welcome";
import { StepQuestionnaire } from "./steps/step-questionnaire";
import { StepWorkspace } from "./steps/step-workspace";
import { StepFirstIssue } from "./steps/step-first-issue";
import { useT } from "../i18n";

const EMPTY_QUESTIONNAIRE: QuestionnaireAnswers = {
  team_size: null,
  team_size_other: null,
  role: null,
  role_other: null,
  use_case: null,
  use_case_other: null,
};

function mergeQuestionnaire(
  raw: Record<string, unknown>,
): QuestionnaireAnswers {
  return { ...EMPTY_QUESTIONNAIRE, ...(raw as Partial<QuestionnaireAnswers>) };
}

/**
 * Shell's onComplete contract:
 *   onComplete(workspace?) — if present, navigate into its issues list;
 *   if omitted, fall back to root. A Starter-content opt-in dialog runs
 *   on the issues page itself (see `StarterContentPrompt`), so the flow
 *   doesn't carry `firstIssueId` any more — there is no welcome issue
 *   created by onboarding.
 *
 * SEAM (cloud re-model pending — see INTEGRATION.md § Deferred): the "connect a
 * runtime / install the CLI" step and the runtime-bound "create an agent"
 * step were removed with the local-runtime surfaces. The flow now runs
 * welcome → questionnaire → workspace → first_issue; onboarding-time agent
 * creation returns once cloud runtimes are modeled.
 */
export function OnboardingFlow({
  onComplete,
}: {
  onComplete: (workspace?: Workspace) => void;
}) {
  const { t } = useT("onboarding");
  const user = useAuthStore((s) => s.user);
  if (!user) {
    throw new Error("OnboardingFlow requires an authenticated user");
  }

  // Questionnaire answers are server-persisted and pre-fill Step 1
  // on re-entry. That's the only piece of onboarding state persisted
  // across sessions — which step the user is on is deliberately not
  // saved, so every entry starts at Welcome.
  const storedQuestionnaire = mergeQuestionnaire(user.onboarding_questionnaire);

  const [step, setStep] = useState<OnboardingStep>("welcome");
  const [workspace, setWorkspace] = useState<Workspace | null>(null);

  // Fetched at Step 0 + Step 2. Step 2 uses it to detect a pre-existing
  // workspace from an earlier abandoned onboarding (so StepWorkspace shows
  // "Continue with {name}" instead of CreateWorkspaceForm — avoiding the
  // slug conflict that creation would hit). Step 0 uses it to decide
  // whether to render the "I've done this before" skip button — only
  // shown when the user already has at least one workspace, otherwise
  // skipping would land them in limbo.
  const { data: workspaces = [], isFetched: workspacesFetched } = useQuery({
    ...workspaceListOptions(),
    enabled: step === "welcome" || step === "workspace",
  });
  const existingWorkspace = workspace ?? workspaces[0] ?? null;
  const canSkipWelcome = workspacesFetched && workspaces.length > 0;
  const startedEmittedRef = useRef(false);
  useEffect(() => {
    if (startedEmittedRef.current || !workspacesFetched) return;
    startedEmittedRef.current = true;
    captureEvent("onboarding_started", {
      source: "onboarding",
      ...(existingWorkspace ? { workspace_id: existingWorkspace.id } : {}),
    });
  }, [existingWorkspace, workspacesFetched]);

  const handleWelcomeNext = useCallback(() => {
    setStep("questionnaire");
  }, []);

  // "I've done this before" path — returning user who already has a
  // workspace and just wants to land there. Marks onboarding complete
  // server-side (idempotent via COALESCE on onboarded_at) and navigates
  // to their first workspace. Because starter_content_state is NULL for
  // any user reaching this button (it's freshly added), they'll see the
  // StarterContentPrompt dialog on arrival — which is correct, since
  // they never got a starter project and may want one now.
  const handleWelcomeSkip = useCallback(async () => {
    try {
      await completeOnboarding("skip_existing", workspaces[0]?.id);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : t(($) => $.errors.skip_failed),
      );
      return;
    }
    onComplete(workspaces[0] ?? undefined);
  }, [workspaces, onComplete]);

  const handleQuestionnaireSubmit = useCallback(
    async (answers: QuestionnaireAnswers) => {
      await saveQuestionnaire(answers);
      setStep("workspace");
    },
    [],
  );

  const handleWorkspaceCreated = useCallback((ws: Workspace) => {
    setWorkspace(ws);
    setCurrentWorkspace(ws.slug, ws.id);
    setStep("first_issue");
  }, []);

  const handleBack = useCallback((from: OnboardingStep) => {
    const idx = ONBOARDING_STEP_ORDER.indexOf(from);
    if (idx <= 0) return;
    const prev = ONBOARDING_STEP_ORDER[idx - 1]!;
    setStep(prev);
  }, []);

  // Step fired `completeOnboarding` itself. Here we just route the
  // user to their workspace — the starter-content decision happens
  // inside the workspace via the `StarterContentPrompt` dialog.
  const handleFinished = useCallback(() => {
    onComplete(workspace ?? undefined);
  }, [workspace, onComplete]);

  // Welcome, Questionnaire, and Workspace own full-bleed two-column
  // layouts (hero / side panel) with their own DragStrip + StepHeader.
  // The final first_issue step still renders inside the narrow legacy
  // single-column shell below.
  if (step === "welcome") {
    return (
      <StepWelcome
        onNext={handleWelcomeNext}
        onSkip={canSkipWelcome ? handleWelcomeSkip : undefined}
      />
    );
  }

  if (step === "questionnaire") {
    return (
      <StepQuestionnaire
        initial={storedQuestionnaire}
        onSubmit={handleQuestionnaireSubmit}
      />
    );
  }

  if (step === "workspace") {
    return (
      <StepWorkspace
        existing={existingWorkspace}
        onCreated={handleWorkspaceCreated}
        onBack={() => handleBack("workspace")}
      />
    );
  }

  return (
    <div className="animate-onboarding-enter flex min-h-full flex-col">
      <DragStrip />
      <div className="flex flex-1 flex-col items-center px-6 pb-12">
        <div className="flex w-full max-w-xl flex-col gap-8">
          <StepHeader currentStep={step} />
          {step === "first_issue" && (
            <StepFirstIssue
              onFinished={handleFinished}
              completionPath="runtime_skipped"
              workspaceId={workspace?.id}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export type { OnboardingStep };
