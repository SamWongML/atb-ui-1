"use client";

import { DashboardLayout } from "@atb/views/layout";
import { AtbIcon } from "@atb/ui/components/common/atb-icon";
import { SearchCommand, SearchTrigger } from "@atb/views/search";
import { ChatFab, ChatWindow } from "@atb/views/chat";
import { StarterContentPrompt } from "@atb/views/onboarding";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardLayout
      loadingIndicator={<AtbIcon className="size-6" />}
      searchSlot={<SearchTrigger />}
      extra={
        <>
          <SearchCommand />
          <ChatWindow />
          <ChatFab />
          <StarterContentPrompt />
        </>
      }
    >
      {children}
    </DashboardLayout>
  );
}
