import { z } from "zod";
import type { Transport } from "../api/transport";
import { parseWithFallback } from "../api/schema";
import { ReactionSchema, AttachmentSchema } from "../api/schemas";
import type { Label } from "../types/label";
import type { TimelineEntry, AssigneeFrequencyEntry } from "../types/activity";
import type { AgentTask, IssueUsageSummary } from "../types/agent";

// ---------------------------------------------------------------------------
// Issues contract module — the Issue domain's side of the wire contract:
// operations, request/response types, response schemas, and fallbacks in one
// place. Reference implementation of the per-domain contract pattern (see
// docs/adr/0001-schemas-from-drizzle-derived-contracts-package.md); every
// domain folds into a module of this shape during the sweep.
//
// Reconciliation contract (per domain, one PR each):
//   1. Replace locally-declared types/schemas with @atb/contracts imports.
//   2. Replace each visible `as` cast below with parseWithFallback + a
//      fallback (the casts are deliberate pre-reconciliation markers —
//      `grep '\bas \b' contract.ts` is this domain's live TODO list).
//   3. Add malformed-response tests next door in contract.test.ts.
// ---------------------------------------------------------------------------

// --- Types (wire + cache shapes owned by the Issue domain) -----------------

export type IssueStatus =
  | "backlog"
  | "todo"
  | "in_progress"
  | "in_review"
  | "done"
  | "blocked"
  | "cancelled";

export type IssuePriority = "urgent" | "high" | "medium" | "low" | "none";

export type IssueAssigneeType = "member" | "agent" | "squad";

export interface IssueReaction {
  id: string;
  issue_id: string;
  actor_type: string;
  actor_id: string;
  emoji: string;
  created_at: string;
}

export interface Issue {
  id: string;
  workspace_id: string;
  number: number;
  identifier: string;
  title: string;
  description: string | null;
  status: IssueStatus;
  priority: IssuePriority;
  assignee_type: IssueAssigneeType | null;
  assignee_id: string | null;
  creator_type: IssueAssigneeType;
  creator_id: string;
  parent_issue_id: string | null;
  project_id: string | null;
  position: number;
  due_date: string | null;
  reactions?: IssueReaction[];
  labels?: Label[];
  created_at: string;
  updated_at: string;
}

export interface CreateIssueRequest {
  title: string;
  description?: string;
  status?: IssueStatus;
  priority?: IssuePriority;
  assignee_type?: IssueAssigneeType;
  assignee_id?: string;
  parent_issue_id?: string;
  project_id?: string;
  due_date?: string;
  attachment_ids?: string[];
}

export interface UpdateIssueRequest {
  title?: string;
  description?: string;
  status?: IssueStatus;
  priority?: IssuePriority;
  assignee_type?: IssueAssigneeType | null;
  assignee_id?: string | null;
  position?: number;
  due_date?: string | null;
  parent_issue_id?: string | null;
  project_id?: string | null;
  /** Attachment IDs to bind to this issue alongside the description update.
   *  Used by the description editor to register newly uploaded files so they
   *  surface in `issueAttachments` and keep their preview Eye on refresh. */
  attachment_ids?: string[];
}

export interface ListIssuesParams {
  limit?: number;
  offset?: number;
  workspace_id?: string;
  status?: IssueStatus;
  priority?: IssuePriority;
  assignee_id?: string;
  assignee_ids?: string[];
  creator_id?: string;
  project_id?: string;
  open_only?: boolean;
}

/** Raw backend response shape for `GET /api/issues`. */
export interface ListIssuesResponse {
  issues: Issue[];
  total: number;
}

/** Per-status bucket in the paginated issue cache. `total` is the server count (all pages), not the length of `issues`. */
export interface IssueStatusBucket {
  issues: Issue[];
  total: number;
}

/**
 * Frontend cache shape for the issue list. Data is bucketed by status so
 * each column can paginate independently. Assembled from per-status
 * `api.listIssues` responses by the query functions in `issues/queries.ts`.
 */
export interface ListIssuesCache {
  byStatus: Partial<Record<IssueStatus, IssueStatusBucket>>;
}

export interface SearchIssueResult extends Issue {
  match_source: "title" | "description" | "comment";
  matched_snippet?: string;
}

export interface SearchIssuesResponse {
  issues: SearchIssueResult[];
  total: number;
}

// --- Schemas + fallbacks ---------------------------------------------------
// Lenient by the rules documented in ../api/schemas.ts: string enums stay
// `z.string()`, arrays default to `[]`, every object ends with `.loose()` so
// unknown server-side fields pass through unchanged.

const IssueSchema = z.object({
  id: z.string(),
  workspace_id: z.string(),
  number: z.number(),
  identifier: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  status: z.string(),
  priority: z.string(),
  assignee_type: z.string().nullable(),
  assignee_id: z.string().nullable(),
  creator_type: z.string(),
  creator_id: z.string(),
  parent_issue_id: z.string().nullable(),
  project_id: z.string().nullable(),
  position: z.number(),
  due_date: z.string().nullable(),
  reactions: z.array(z.unknown()).optional(),
  labels: z.array(z.unknown()).optional(),
  created_at: z.string(),
  updated_at: z.string(),
}).loose();

export const ListIssuesResponseSchema = z.object({
  issues: z.array(IssueSchema).default([]),
  total: z.number().default(0),
}).loose();

export const EMPTY_LIST_ISSUES_RESPONSE: ListIssuesResponse = {
  issues: [],
  total: 0,
};

export const ChildIssuesResponseSchema = z.object({
  issues: z.array(IssueSchema).default([]),
}).loose();

const TimelineEntrySchema = z.object({
  type: z.string(),
  id: z.string(),
  actor_type: z.string(),
  actor_id: z.string(),
  created_at: z.string(),
  action: z.string().optional(),
  details: z.record(z.string(), z.unknown()).optional(),
  content: z.string().optional(),
  parent_id: z.string().nullable().optional(),
  updated_at: z.string().optional(),
  comment_type: z.string().optional(),
  reactions: z.array(ReactionSchema).optional(),
  attachments: z.array(AttachmentSchema).optional(),
  coalesced_count: z.number().optional(),
}).loose();

// /timeline returns a flat array of TimelineEntry, oldest first. The
// previously cursor-paginated wrapper was removed (#1929) — at observed data
// sizes (p99 ~30 entries per issue) paged delivery only created bugs.
export const TimelineEntriesSchema = z.array(TimelineEntrySchema);

export const EMPTY_TIMELINE_ENTRIES: TimelineEntry[] = [];

// --- Operations ------------------------------------------------------------

export function createIssuesContract(transport: Transport) {
  return {
    async listIssues(params?: ListIssuesParams): Promise<ListIssuesResponse> {
      const search = new URLSearchParams();
      if (params?.limit) search.set("limit", String(params.limit));
      if (params?.offset) search.set("offset", String(params.offset));
      if (params?.workspace_id) search.set("workspace_id", params.workspace_id);
      if (params?.status) search.set("status", params.status);
      if (params?.priority) search.set("priority", params.priority);
      if (params?.assignee_id) search.set("assignee_id", params.assignee_id);
      if (params?.assignee_ids?.length) search.set("assignee_ids", params.assignee_ids.join(","));
      if (params?.creator_id) search.set("creator_id", params.creator_id);
      if (params?.project_id) search.set("project_id", params.project_id);
      if (params?.open_only) search.set("open_only", "true");
      const raw = await transport.json(`/api/issues?${search}`);
      return parseWithFallback(raw, ListIssuesResponseSchema, EMPTY_LIST_ISSUES_RESPONSE, {
        endpoint: "GET /api/issues",
      });
    },

    async searchIssues(params: { q: string; limit?: number; offset?: number; include_closed?: boolean; signal?: AbortSignal }): Promise<SearchIssuesResponse> {
      const search = new URLSearchParams({ q: params.q });
      if (params.limit !== undefined) search.set("limit", String(params.limit));
      if (params.offset !== undefined) search.set("offset", String(params.offset));
      if (params.include_closed) search.set("include_closed", "true");
      return await transport.json(
        `/api/issues/search?${search}`,
        params.signal ? { signal: params.signal } : undefined,
      ) as SearchIssuesResponse;
    },

    async getIssue(id: string): Promise<Issue> {
      return await transport.json(`/api/issues/${id}`) as Issue;
    },

    async createIssue(data: CreateIssueRequest): Promise<Issue> {
      return await transport.json("/api/issues", {
        method: "POST",
        body: JSON.stringify(data),
      }) as Issue;
    },

    async quickCreateIssue(data: {
      agent_id?: string;
      squad_id?: string;
      prompt: string;
      project_id?: string | null;
    }): Promise<{ task_id: string }> {
      return await transport.json("/api/issues/quick-create", {
        method: "POST",
        body: JSON.stringify(data),
      }) as { task_id: string };
    },

    async updateIssue(id: string, data: UpdateIssueRequest): Promise<Issue> {
      return await transport.json(`/api/issues/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }) as Issue;
    },

    async listChildIssues(id: string): Promise<{ issues: Issue[] }> {
      const raw = await transport.json(`/api/issues/${id}/children`);
      return parseWithFallback(raw, ChildIssuesResponseSchema, { issues: [] }, {
        endpoint: "GET /api/issues/:id/children",
      });
    },

    async getChildIssueProgress(): Promise<{ progress: { parent_issue_id: string; total: number; done: number }[] }> {
      return await transport.json("/api/issues/child-progress") as {
        progress: { parent_issue_id: string; total: number; done: number }[];
      };
    },

    async deleteIssue(id: string): Promise<void> {
      await transport.json(`/api/issues/${id}`, { method: "DELETE" });
    },

    async batchUpdateIssues(issueIds: string[], updates: UpdateIssueRequest): Promise<{ updated: number }> {
      return await transport.json("/api/issues/batch-update", {
        method: "POST",
        body: JSON.stringify({ issue_ids: issueIds, updates }),
      }) as { updated: number };
    },

    async batchDeleteIssues(issueIds: string[]): Promise<{ deleted: number }> {
      return await transport.json("/api/issues/batch-delete", {
        method: "POST",
        body: JSON.stringify({ issue_ids: issueIds }),
      }) as { deleted: number };
    },

    async listTimeline(issueId: string): Promise<TimelineEntry[]> {
      const raw = await transport.json(`/api/issues/${issueId}/timeline`);
      return parseWithFallback(raw, TimelineEntriesSchema, EMPTY_TIMELINE_ENTRIES, {
        endpoint: "GET /api/issues/:id/timeline",
      });
    },

    async getAssigneeFrequency(): Promise<AssigneeFrequencyEntry[]> {
      return await transport.json("/api/assignee-frequency") as AssigneeFrequencyEntry[];
    },

    async getActiveTasksForIssue(issueId: string): Promise<{ tasks: AgentTask[] }> {
      return await transport.json(`/api/issues/${issueId}/active-task`) as { tasks: AgentTask[] };
    },

    async listTasksByIssue(issueId: string): Promise<AgentTask[]> {
      return await transport.json(`/api/issues/${issueId}/task-runs`) as AgentTask[];
    },

    async getIssueUsage(issueId: string): Promise<IssueUsageSummary> {
      return await transport.json(`/api/issues/${issueId}/usage`) as IssueUsageSummary;
    },

    async rerunIssue(issueId: string): Promise<AgentTask> {
      return await transport.json(`/api/issues/${issueId}/rerun`, {
        method: "POST",
      }) as AgentTask;
    },
  };
}

export type IssuesContract = ReturnType<typeof createIssuesContract>;
