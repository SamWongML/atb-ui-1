"use client";

import { IssuesPage } from "@atb/views/issues/components";
import { ErrorBoundary } from "@atb/ui/components/common/error-boundary";

export default function Page() {
  return (
    <ErrorBoundary>
      <IssuesPage />
    </ErrorBoundary>
  );
}
