"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useAuthStore } from "@atb/core/auth";
import { workspaceListOptions } from "@atb/core/workspace";
import {
  paths,
  resolvePostAuthDestination,
  useHasOnboarded,
} from "@atb/core/paths";

/**
 * Root entry fallback. `/` is a pure entry hop — this app has no marketing
 * landing to render.
 *
 * The proxy (`apps/web/proxy.ts`) resolves `/` server-side wherever it can from
 * cookies alone: logged-out → /login, and logged-in-with-a-known-workspace →
 * that workspace (both flash-free, before this page ever renders). This client
 * page covers the one case the proxy can't: a logged-in user with no
 * `last_workspace_slug` cookie yet (first login, or cookie cleared), where the
 * destination depends on the workspace list. Once auth and that list resolve we
 * `router.replace` to the destination; a neutral spinner covers the brief
 * window. The logged-out branch is defensive — reachable only if the
 * `atb_logged_in` cookie is present but the session no longer resolves to a user.
 */
export default function RootPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const isLoading = useAuthStore((s) => s.isLoading);
  const hasOnboarded = useHasOnboarded();

  const { data: list = [], isFetched } = useQuery({
    ...workspaceListOptions(),
    enabled: !!user,
  });

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.replace(paths.login());
      return;
    }
    if (!isFetched) return;
    router.replace(resolvePostAuthDestination(list, hasOnboarded));
  }, [isLoading, user, isFetched, list, hasOnboarded, router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}
