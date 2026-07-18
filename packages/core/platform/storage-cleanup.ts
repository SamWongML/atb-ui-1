import type { StorageAdapter } from "../types/storage";

/**
 * Keys that are namespaced per workspace (stored as `${key}:${slug}`).
 *
 * IMPORTANT: When adding a new workspace-scoped persist store or storage key,
 * add its key here so that workspace deletion and logout properly clean it up.
 * Also ensure the store uses `createWorkspaceAwareStorage` for its persist config.
 */
const WORKSPACE_SCOPED_KEYS = [
  "atb_issue_draft",
  "atb_issues_view",
  "atb_issues_scope",
  "atb_my_issues_view",
  "auto-tobe:chat:selectedAgentId",
  "auto-tobe:chat:activeSessionId",
  "auto-tobe:chat:drafts",
  "auto-tobe:chat:expanded",
  "atb_navigation",
];

/** Remove all workspace-scoped storage entries for the given workspace slug. */
export function clearWorkspaceStorage(
  adapter: StorageAdapter,
  slug: string,
) {
  for (const key of WORKSPACE_SCOPED_KEYS) {
    adapter.removeItem(`${key}:${slug}`);
  }
}
