# Frontend ⇄ Backend Contract Expectations

**What this is.** A complete catalog of what the extracted `auto-tobe` frontend
expects from its backend **today** — every REST endpoint it calls, every
response schema/fallback it enforces, every WebSocket event it consumes, and the
auth/transport surface. It is the diff target for the deliberate follow-on:
reconciling the data layer in-place against the diverged `auto-tobe` **api** +
**gateway**.

**Source of truth.** All HTTP calls originate from
[`packages/core/api/client.ts`](../packages/core/api/client.ts) (`ApiClient`).
WebSocket types live in
[`packages/core/types/events.ts`](../packages/core/types/events.ts); the client
consumes them in [`packages/core/realtime/use-realtime-sync.ts`](../packages/core/realtime/use-realtime-sync.ts)
and the per-domain `*/ws-updaters.ts`. TS request/response types live in
`packages/core/types/*` (one file per domain).

**How to read the tables.** `Request` names a TS request type
(`packages/core/types/*`) or an inline body; `Response` names the TS return type
of the `ApiClient` method. `Method` is the `ApiClient` method name. Path params
are shown as `:id`. Every path is prefixed by the api origin
(`NEXT_PUBLIC_ATB_API_URL`); `/auth/*` and `/api/*` both resolve there.

> **Note on `runtimes/*/local-skills` + `runtimes/*/models` + `runtimes/*/update`:**
> the local-runtime **UI** was stripped during the extraction (see the wayfinder
> map / ticket #4), but the `ApiClient` methods remain and are listed here for
> completeness. Model discovery is kept behind a seam; the CLI-update and
> local-skill endpoints are dormant callers-removed and are flagged **[dormant]**.

---

## 1. Auth & transport surface

**Base origins (env-driven, ticket #5).**
- `NEXT_PUBLIC_ATB_API_URL` → `ApiClient` base; all `/api/*` and `/auth/*`.
- `NEXT_PUBLIC_ATB_GATEWAY_WS_URL` → `WSClient` base (the gateway `/ws`).

**HTTP request headers** (set by `ApiClient.authHeaders()` / `request()`):

| Header | Value | When |
|---|---|---|
| `Authorization` | `Bearer <token>` | Token mode only (localStorage `atb_token`) |
| `X-Workspace-Slug` | active workspace slug | Set whenever a workspace is active (URL-driven singleton, `workspace-storage.ts`) |
| `X-CSRF-Token` | value of `atb_csrf` cookie | Cookie mode (double-submit CSRF) |
| `X-Client-Platform` / `X-Client-Version` / `X-Client-OS` | client identity | Always (web sends `platform=web`, `version`) |
| `X-Request-ID` | per-request uuid | Always (log correlation) |
| `credentials` | `include` | Always (cookies flow cross-origin — api must allow-credentials) |

**Auth modes.** Cookie mode is the default (`cookieAuth = !hasLegacyToken()`):
HttpOnly session cookie + `atb_csrf` double-submit token. Token mode is the
legacy path — a bearer token in localStorage under `atb_token`. `401` on any
request runs `handleUnauthorized()` → clears the token → `onUnauthorized` callback.

**Login / magic-link / OAuth endpoints:**

| Method | Verb | Path | Request | Response |
|---|---|---|---|---|
| `sendCode` | POST | `/auth/send-code` | `{ email }` | `void` (code emailed / logged) |
| `verifyCode` | POST | `/auth/verify-code` | `{ email, code }` | `LoginResponse` (`{ token, user }`) |
| `googleLogin` | POST | `/auth/google` | `{ credential }` (Google OAuth) | `LoginResponse` |
| `logout` | POST | `/auth/logout` | — | `void` (clears session cookie) |
| `issueCliToken` | POST | `/api/cli-token` | — | `{ token }` (browser→CLI login handoff) |

**Runtime config** (`google_client_id`, `posthog_key`, `allow_signup`,
`cdn_domain`, …) is fetched from `getConfig` → `GET /api/config`, **not** from
`NEXT_PUBLIC_*` — see [§4](#4-config--me--onboarding).

**WebSocket handshake** (`packages/core/api/ws-client.ts`). Browsers cannot set
WS headers, so identity + workspace ride as **query params** on the upgrade URL:
`workspace_slug`, `client_platform`, `client_version`, `client_os`. Token is
**never** in the URL:
- **Cookie mode:** HttpOnly cookie is sent with the upgrade automatically.
- **Token mode:** after `onopen`, the client sends `{ type: "auth", payload: { token } }`
  and waits for a `{ type: "auth_ack" }` before processing events.

Reconnect is automatic; on reconnect the client fires registered
`onReconnect` callbacks (used to refetch/re-invalidate). Workspace switch tears
down and reopens the socket bound to the new slug.

---

## 2. Response validation (parse-don't-cast boundary)

`parseWithFallback(raw, schema, fallback, { endpoint })`
([`packages/core/api/schema.ts`](../packages/core/api/schema.ts)) validates a
response body with a `zod` schema; on failure it **logs a warning and returns the
fallback — it never throws into the UI**. Schemas + fallbacks live in
[`packages/core/api/schemas.ts`](../packages/core/api/schemas.ts).

| Endpoint (method) | Schema | Fallback |
|---|---|---|
| `listIssues` | `ListIssuesResponseSchema` | `EMPTY_LIST_ISSUES_RESPONSE` |
| `listChildIssues` | `ChildIssuesResponseSchema` | `{ issues: [] }` |
| `listComments` | `CommentsListSchema` | `[]` |
| `listTimeline` | `TimelineEntriesSchema` | `EMPTY_TIMELINE_ENTRIES` |
| `listIssueSubscribers` | `SubscribersListSchema` | `[]` |
| `listAgentTemplates` | `AgentTemplateSummaryListSchema` | `EMPTY_AGENT_TEMPLATE_SUMMARY_LIST` |
| `getAgentTemplate` | `AgentTemplateSchema` | `EMPTY_AGENT_TEMPLATE_DETAIL` |
| `createAgentFromTemplate` | `CreateAgentFromTemplateResponseSchema` | `EMPTY_CREATE_AGENT_FROM_TEMPLATE_RESPONSE` |
| `getDashboardUsageDaily` | `DashboardUsageDailyListSchema` | `[]` |
| `getDashboardUsageByAgent` | `DashboardUsageByAgentListSchema` | `[]` |
| `getDashboardAgentRunTime` | `DashboardAgentRunTimeListSchema` | `[]` |
| `uploadFile` / `listAttachments` | `AttachmentResponseSchema` | `EMPTY_ATTACHMENT` |

Every **other** endpoint returns a bare `as`-typed body (the diverged-contract
risk the reconciliation follow-on addresses); adding a schema per endpoint is the
per-domain reconciliation work, not this catalog.

---

## 3. REST endpoints by domain

### Issues — types: `types/issue.ts`

| Method | Verb | Path | Request | Response |
|---|---|---|---|---|
| `listIssues` | GET | `/api/issues` | `ListIssuesParams` (query) | `ListIssuesResponse` |
| `searchIssues` | GET | `/api/issues/search` | `{ q, … }` (query) | `SearchIssuesResponse` |
| `getIssue` | GET | `/api/issues/:id` | — | `Issue` |
| `createIssue` | POST | `/api/issues` | `CreateIssueRequest` | `Issue` |
| `updateIssue` | PUT | `/api/issues/:id` | `UpdateIssueRequest` | `Issue` |
| `deleteIssue` | DELETE | `/api/issues/:id` | — | `void` |
| `batchUpdateIssues` | POST | `/api/issues/batch-update` | `{ ids, patch }` | `{ updated }` |
| `batchDeleteIssues` | POST | `/api/issues/batch-delete` | `{ ids }` | `{ deleted }` |
| `quickCreateIssue` | POST | `/api/issues/quick-create` | `{ agent_id?/squad_id?, prompt, project_id? }` | `{ task_id }` |
| `getChildIssueProgress` | GET | `/api/issues/child-progress` | `{ parent_ids }` (query) | `{ progress[] }` |
| `rerunIssue` | POST | `/api/issues/:id/rerun` | — | `AgentTask` |
| `getActiveTasksForIssue` | GET | `/api/issues/:id/active-task` | — | `{ tasks: AgentTask[] }` |
| `listTasksByIssue` | GET | `/api/issues/:id/task-runs` | — | `AgentTask[]` |
| `getIssueUsage` | GET | `/api/issues/:id/usage` | — | `IssueUsageSummary` |
| `listChildIssues` | GET | `/api/issues/:id/children` | — | `{ issues: Issue[] }` |
| `listTimeline` | GET | `/api/issues/:issueId/timeline` | — | `TimelineEntry[]` |
| `getAssigneeFrequency` | GET | `/api/assignee-frequency` | — | `AssigneeFrequencyEntry[]` |

### Comments & reactions — types: `types/comment.ts`

| Method | Verb | Path | Response |
|---|---|---|---|
| `listComments` | GET | `/api/issues/:issueId/comments` | `Comment[]` |
| `createComment` | POST | `/api/issues/:issueId/comments` | `Comment` |
| `updateComment` | PUT | `/api/comments/:commentId` | `Comment` |
| `deleteComment` | DELETE | `/api/comments/:commentId` | `void` |
| `resolveComment` / `unresolveComment` | POST/DELETE | `/api/comments/:commentId/resolve` | `Comment` |
| `addReaction` / `removeReaction` | POST/DELETE | `/api/comments/:commentId/reactions` | `Reaction` / `void` |
| `addIssueReaction` / `removeIssueReaction` | POST/DELETE | `/api/issues/:issueId/reactions` | `IssueReaction` / `void` |

### Subscribers — types: `types/subscriber.ts`

| Method | Verb | Path | Response |
|---|---|---|---|
| `listIssueSubscribers` | GET | `/api/issues/:issueId/subscribers` | `IssueSubscriber[]` |
| `subscribeToIssue` / `unsubscribeFromIssue` | POST | `/api/issues/:issueId/subscribe` \| `/unsubscribe` | `void` |

### Agents & templates — types: `types/agent.ts`

| Method | Verb | Path | Request | Response |
|---|---|---|---|---|
| `listAgents` | GET | `/api/agents` | `{ … }` (query) | `Agent[]` |
| `getAgent` | GET | `/api/agents/:id` | — | `Agent` |
| `createAgent` | POST | `/api/agents` | `CreateAgentRequest` | `Agent` |
| `updateAgent` | PUT | `/api/agents/:id` | `UpdateAgentRequest` | `Agent` |
| `archiveAgent` / `restoreAgent` | POST | `/api/agents/:id/archive` \| `/restore` | — | `Agent` |
| `cancelAgentTasks` | POST | `/api/agents/:id/cancel-tasks` | — | `{ cancelled }` |
| `listAgentTemplates` | GET | `/api/agent-templates` | — | `AgentTemplateSummary[]` |
| `getAgentTemplate` | GET | `/api/agent-templates/:slug` | — | `AgentTemplate` |
| `createAgentFromTemplate` | POST | `/api/agents/from-template` | `CreateAgentFromTemplateRequest` | `CreateAgentFromTemplateResponse` |

### Agent tasks — types: `types/agent.ts`

| Method | Verb | Path | Response |
|---|---|---|---|
| `listAgentTasks` | GET | `/api/agents/:agentId/tasks` | `AgentTask[]` |
| `getAgentTaskSnapshot` | GET | `/api/agent-task-snapshot` | `AgentTask[]` |
| `getWorkspaceAgentActivity30d` | GET | `/api/agent-activity-30d` | `AgentActivityBucket[]` |
| `getWorkspaceAgentRunCounts` | GET | `/api/agent-run-counts` | `AgentRunCount[]` |
| `listTaskMessages` | GET | `/api/tasks/:taskId/messages` | `TaskMessagePayload[]` |
| `cancelTask` | POST | `/api/issues/:issueId/tasks/:taskId/cancel` | `AgentTask` |
| `cancelTaskById` | POST | `/api/tasks/:taskId/cancel` | `void` |

### Runtimes — types: `types/agent.ts` (`AgentRuntime`, `RuntimeUsage*`)

| Method | Verb | Path | Response | |
|---|---|---|---|---|
| `listRuntimes` | GET | `/api/runtimes` | `AgentRuntime[]` | |
| `deleteRuntime` | DELETE | `/api/runtimes/:id` | `void` | |
| `updateRuntime` | PATCH | `/api/runtimes/:id` | `AgentRuntime` | (timezone / visibility) |
| `getRuntimeUsage` | GET | `/api/runtimes/:id/usage` | `RuntimeUsage[]` | |
| `getRuntimeUsageByAgent` | GET | `/api/runtimes/:id/usage/by-agent` | `RuntimeUsageByAgent[]` | |
| `getRuntimeUsageByHour` | GET | `/api/runtimes/:id/usage/by-hour` | `RuntimeUsageByHour[]` | |
| `getRuntimeTaskActivity` | GET | `/api/runtimes/:id/activity` | `RuntimeHourlyActivity[]` | |
| `initiateListModels` / `getListModelsResult` | POST/GET | `/api/runtimes/:id/models[/:requestId]` | `RuntimeModelListRequest` | seam (model discovery) |
| `initiateUpdate` / `getUpdateResult` | POST/GET | `/api/runtimes/:id/update[/:updateId]` | `RuntimeUpdate` | **[dormant]** CLI self-update |
| `initiateListLocalSkills` / `getListLocalSkillsResult` | POST/GET | `/api/runtimes/:id/local-skills[/:requestId]` | `RuntimeLocalSkillListRequest` | **[dormant]** |
| `initiateImportLocalSkill` / `getImportLocalSkillResult` | POST/GET | `/api/runtimes/:id/local-skills/import[/:requestId]` | `RuntimeLocalSkillImportRequest` | **[dormant]** |

### Inbox — types: `types/inbox.ts`

| Method | Verb | Path | Response |
|---|---|---|---|
| `listInbox` | GET | `/api/inbox` | `InboxItem[]` |
| `getUnreadInboxCount` | GET | `/api/inbox/unread-count` | `{ count }` |
| `markInboxRead` / `archiveInbox` | POST | `/api/inbox/:id/read` \| `/archive` | `InboxItem` |
| `markAllInboxRead` | POST | `/api/inbox/mark-all-read` | `{ count }` |
| `archiveAllInbox` / `archiveAllReadInbox` / `archiveCompletedInbox` | POST | `/api/inbox/archive-all[-read]` \| `/archive-completed` | `{ count }` |

### Notifications — types: `types/notification-preference.ts`

| Method | Verb | Path | Response |
|---|---|---|---|
| `getNotificationPreferences` | GET | `/api/notification-preferences` | `NotificationPreferenceResponse` |
| `updateNotificationPreferences` | PUT | `/api/notification-preferences` | `NotificationPreferenceResponse` |

### Workspaces / members / invitations — types: `types/workspace.ts`

| Method | Verb | Path | Response |
|---|---|---|---|
| `listWorkspaces` / `getWorkspace` | GET | `/api/workspaces[/:id]` | `Workspace[]` / `Workspace` |
| `createWorkspace` | POST | `/api/workspaces` | `Workspace` |
| `updateWorkspace` | PATCH | `/api/workspaces/:id` | `Workspace` |
| `deleteWorkspace` | DELETE | `/api/workspaces/:id` | `void` |
| `leaveWorkspace` | POST | `/api/workspaces/:id/leave` | `void` |
| `listMembers` | GET | `/api/workspaces/:workspaceId/members` | `MemberWithUser[]` |
| `createMember` | POST | `/api/workspaces/:workspaceId/members` | `Invitation` |
| `updateMember` / `deleteMember` | PATCH/DELETE | `/api/workspaces/:workspaceId/members/:memberId` | `MemberWithUser` / `void` |
| `listWorkspaceInvitations` | GET | `/api/workspaces/:workspaceId/invitations` | `Invitation[]` |
| `revokeInvitation` | DELETE | `/api/workspaces/:workspaceId/invitations/:invitationId` | `void` |
| `listMyInvitations` / `getInvitation` | GET | `/api/invitations[/:invitationId]` | `Invitation[]` / `Invitation` |
| `acceptInvitation` / `declineInvitation` | POST | `/api/invitations/:invitationId/accept` \| `/decline` | `MemberWithUser` / `void` |

### Skills — types: `types/index.ts` (`Skill`, `SkillSummary`)

| Method | Verb | Path | Response |
|---|---|---|---|
| `listSkills` / `getSkill` | GET | `/api/skills[/:id]` | `SkillSummary[]` / `Skill` |
| `createSkill` / `updateSkill` / `deleteSkill` | POST/PUT/DELETE | `/api/skills[/:id]` | `Skill` / `void` |
| `importSkill` | POST | `/api/skills/import` | `Skill` |
| `listAgentSkills` / `setAgentSkills` | GET/PUT | `/api/agents/:agentId/skills` | `SkillSummary[]` / `void` |

### Personal access tokens

| Method | Verb | Path | Response |
|---|---|---|---|
| `listPersonalAccessTokens` | GET | `/api/tokens` | `PersonalAccessToken[]` |
| `createPersonalAccessToken` | POST | `/api/tokens` | `CreatePersonalAccessTokenResponse` |
| `revokePersonalAccessToken` | DELETE | `/api/tokens/:id` | `void` |

### Chat — types: `types/chat.ts`

| Method | Verb | Path | Response |
|---|---|---|---|
| `listChatSessions` / `getChatSession` | GET | `/api/chat/sessions[/:id]` | `ChatSession[]` / `ChatSession` |
| `createChatSession` / `deleteChatSession` / `updateChatSession` | POST/DELETE/PATCH | `/api/chat/sessions[/:id]` | `ChatSession` / `void` |
| `listChatMessages` | GET | `/api/chat/sessions/:sessionId/messages` | `ChatMessage[]` |
| `sendChatMessage` | POST | `/api/chat/sessions/:sessionId/messages` | `SendChatMessageResponse` |
| `getPendingChatTask` | GET | `/api/chat/sessions/:sessionId/pending-task` | `ChatPendingTask` |
| `listPendingChatTasks` | GET | `/api/chat/pending-tasks` | `PendingChatTasksResponse` |
| `markChatSessionRead` | POST | `/api/chat/sessions/:sessionId/read` | `void` |

### Attachments — types: `types/attachment.ts`

| Method | Verb | Path | Request | Response |
|---|---|---|---|---|
| `uploadFile` | POST | `/api/upload-file` | `multipart/form-data` (`file` + `issue_id?`/`comment_id?`/`chat_session_id?`) | `Attachment` |
| `listAttachments` | GET | `/api/issues/:issueId/attachments` | — | `Attachment[]` |
| `getAttachment` | GET | `/api/attachments/:id` | — | `Attachment` |
| `getAttachmentTextContent` | GET | `/api/attachments/:id/content` | — | `{ text, originalContentType }` (throws dedicated errors when the server refuses to inline) |
| `deleteAttachment` | DELETE | `/api/attachments/:id` | — | `void` |

> Uploaded file URLs are same-origin `/uploads/*` today (rendered as `<img src="/uploads/…">`).
> Resolving them against the api origin is **deferred data-layer reconciliation**.

### Projects & resources — types: `types/project.ts`

| Method | Verb | Path | Response |
|---|---|---|---|
| `listProjects` / `getProject` | GET | `/api/projects[/:id]` | `ListProjectsResponse` / `Project` |
| `searchProjects` | GET | `/api/projects/search` | `SearchProjectsResponse` |
| `createProject` / `updateProject` / `deleteProject` | POST/PUT/DELETE | `/api/projects[/:id]` | `Project` / `void` |
| `listProjectResources` | GET | `/api/projects/:projectId/resources` | `ListProjectResourcesResponse` |
| `createProjectResource` / `deleteProjectResource` | POST/DELETE | `/api/projects/:projectId/resources[/:resourceId]` | `ProjectResource` / `void` |

### Labels — types: `types/label.ts`

| Method | Verb | Path | Response |
|---|---|---|---|
| `listLabels` / `getLabel` | GET | `/api/labels[/:id]` | `ListLabelsResponse` / `Label` |
| `createLabel` / `updateLabel` / `deleteLabel` | POST/PUT/DELETE | `/api/labels[/:id]` | `Label` / `void` |
| `listLabelsForIssue` | GET | `/api/issues/:issueId/labels` | `IssueLabelsResponse` |
| `attachLabel` / `detachLabel` | POST/DELETE | `/api/issues/:issueId/labels[/:labelId]` | `IssueLabelsResponse` |

### Pins — types: `types/pin.ts`

| Method | Verb | Path | Request | Response |
|---|---|---|---|---|
| `listPins` | GET | `/api/pins` | — | `PinnedItem[]` |
| `createPin` | POST | `/api/pins` | `CreatePinRequest` | `PinnedItem` |
| `deletePin` | DELETE | `/api/pins/:itemType/:itemId` | — | `void` |
| `reorderPins` | PUT | `/api/pins/reorder` | `ReorderPinsRequest` | `void` |

### Squads — types: `types/squad.ts`

| Method | Verb | Path | Response |
|---|---|---|---|
| `listSquads` / `getSquad` | GET | `/api/squads[/:id]` | `Squad[]` / `Squad` |
| `createSquad` / `updateSquad` / `deleteSquad` | POST/PUT/DELETE | `/api/squads[/:id]` | `Squad` / `void` |
| `listSquadMembers` | GET | `/api/squads/:squadId/members` | `SquadMember[]` |
| `addSquadMember` / `removeSquadMember` | POST/DELETE | `/api/squads/:squadId/members` | `SquadMember` / `void` |
| `updateSquadMemberRole` | PATCH | `/api/squads/:squadId/members/role` | `SquadMember` |

### Autopilots — types: `types/autopilot.ts`

| Method | Verb | Path | Response |
|---|---|---|---|
| `listAutopilots` / `getAutopilot` | GET | `/api/autopilots[/:id]` | `ListAutopilotsResponse` / `GetAutopilotResponse` |
| `createAutopilot` / `updateAutopilot` / `deleteAutopilot` | POST/PATCH/DELETE | `/api/autopilots[/:id]` | `Autopilot` / `void` |
| `triggerAutopilot` | POST | `/api/autopilots/:id/trigger` | `AutopilotRun` |
| `listAutopilotRuns` | GET | `/api/autopilots/:id/runs` | `ListAutopilotRunsResponse` |
| `createAutopilotTrigger` / `updateAutopilotTrigger` / `deleteAutopilotTrigger` | POST/PATCH/DELETE | `/api/autopilots/:autopilotId/triggers[/:triggerId]` | `AutopilotTrigger` / `void` |

### Dashboard — types: `types/agent.ts` (`Dashboard*`)

| Method | Verb | Path | Response |
|---|---|---|---|
| `getDashboardUsageDaily` | GET | `/api/dashboard/usage` (daily) | `DashboardUsageDaily[]` |
| `getDashboardUsageByAgent` | GET | `/api/dashboard/usage` (by-agent) | `DashboardUsageByAgent[]` |
| `getDashboardAgentRunTime` | GET | `/api/dashboard/agent-runtime` | `DashboardAgentRunTime[]` |

### GitHub — types: `types/github.ts`

| Method | Verb | Path | Response |
|---|---|---|---|
| `getGitHubConnectURL` | GET | `/api/workspaces/:workspaceId/github/connect` | `GitHubConnectResponse` |
| `listGitHubInstallations` | GET | `/api/workspaces/:workspaceId/github/installations` | `ListGitHubInstallationsResponse` |
| `deleteGitHubInstallation` | DELETE | `/api/workspaces/:workspaceId/github/installations/:installationId` | `void` |
| `listIssuePullRequests` | GET | `/api/issues/:issueId/pull-requests` | `{ pull_requests: GitHubPullRequest[] }` |

### Feedback

| Method | Verb | Path | Request | Response |
|---|---|---|---|---|
| `createFeedback` | POST | `/api/feedback` | `{ message, url?, workspace_id? }` | `{ id, created_at }` |

### Config, me & onboarding — types: `types/index.ts` (`User`), `onboarding/types.ts`

| Method | Verb | Path | Request | Response |
|---|---|---|---|---|
| `getConfig` | GET | `/api/config` | — | `{ cdn_domain, allow_signup, google_client_id?, posthog_key?, posthog_host?, analytics_environment? }` |
| `getMe` | GET | `/api/me` | — | `User` |
| `updateMe` | PATCH | `/api/me` | `UpdateMeRequest` | `User` |
| `patchOnboarding` | PATCH | `/api/me/onboarding` | `{ questionnaire }` | `User` |
| `markOnboardingComplete` | POST | `/api/me/onboarding/complete` | `{ completion_path?, workspace_id? }` | `User` |
| `joinCloudWaitlist` | POST | `/api/me/onboarding/cloud-waitlist` | `{ email, reason? }` | `User` (dormant — UI removed) |
| `importStarterContent` | POST | `/api/me/starter-content/import` | `ImportStarterContentPayload` | `ImportStarterContentResponse` |
| `dismissStarterContent` | POST | `/api/me/starter-content/dismiss` | `{ workspace_id? }` | `User` |

---

## 4. WebSocket events

**Envelope** (`WSMessage<T>`): `{ type: WSEventType, payload: T, actor_id?, actor_type? }`.
The client maps each `type` to cache invalidations / optimistic updates in
`use-realtime-sync.ts` and the per-domain `*/ws-updaters.ts`
(`packages/core/inbox/ws-updaters.ts`, `packages/core/issues/ws-updaters.ts`).
Events are **never** written to stores directly — they invalidate TanStack Query
keys (the cache is the single source of truth).

| Event `type` | Payload interface (`types/events.ts`) | Consumed by (invalidates) |
|---|---|---|
| `issue:created` / `:updated` | `IssueCreated/UpdatedPayload` `{ issue }` | issue lists + detail |
| `issue:deleted` | `IssueDeletedPayload` `{ issue_id }` | issue lists + detail |
| `issue_labels:changed` | `IssueLabelsChangedPayload` `{ issue_id, labels[] }` | issue detail + labels |
| `comment:created` / `:updated` / `:deleted` | `Comment*Payload` | issue timeline |
| `comment:resolved` / `:unresolved` | `CommentResolved/UnresolvedPayload` | issue timeline |
| `reaction:added` / `:removed` | `ReactionAdded/RemovedPayload` | comment reactions |
| `issue_reaction:added` / `:removed` | `IssueReactionAdded/RemovedPayload` | issue reactions |
| `subscriber:added` / `:removed` | `SubscriberAdded/RemovedPayload` | issue subscribers |
| `activity:created` | `ActivityCreatedPayload` | issue timeline |
| `agent:status` | `AgentStatusPayload` `{ agent }` | agents list / presence |
| `agent:created` / `:archived` / `:restored` | `AgentCreated/Archived/RestoredPayload` `{ agent }` | agents list |
| `task:queued` / `:dispatch` / `:progress` / `:completed` / `:failed` / `:cancelled` | `Task*Payload` | agent tasks, issue detail, presence |
| `task:message` | `TaskMessagePayload` | task message stream (chat/issue) |
| `inbox:new` | `InboxNewPayload` | inbox list + unread count |
| `inbox:read` / `:archived` | `InboxRead/ArchivedPayload` + batch (`InboxBatch*Payload`) | inbox list + unread count |
| `chat:message` / `:done` | `ChatMessageEventPayload` / `ChatDonePayload` | chat messages + pending tasks |
| `chat:session_read` / `:session_deleted` / `:session_updated` | `ChatSessionRead/DeletedPayload` (+updated) | chat session lists |
| `workspace:updated` / `:deleted` | `WorkspaceUpdated/DeletedPayload` | workspace list / route heal |
| `member:added` / `:updated` / `:removed` | `MemberAdded/Updated/RemovedPayload` | member list |
| `invitation:created` / `:accepted` / `:declined` / `:revoked` | `Invitation*Payload` | invitations (mine + workspace) |
| `skill:created` / `:updated` / `:deleted` | entity/id payload | skills list |
| `project:created` / `:updated` / `:deleted` | `Project*Payload` | projects list |
| `squad:created` / `:updated` / `:deleted` | entity/id payload | squads list |
| `label:created` / `:updated` / `:deleted` | entity/id payload | labels list |
| `pin:created` / `:deleted` / `:reordered` | id/order payload | pins (sidebar) |
| `github_installation:created` / `:deleted` | id payload | github installations |
| `pull_request:linked` / `:updated` / `:unlinked` | id/entity payload | issue pull requests |
| `daemon:heartbeat` / `:register` | runtime payload | **seam** — runtime list refresh (backend-contract string, pending gateway reconciliation) |

---

## 5. TS type source map

Request/response types are one file per domain under
[`packages/core/types/`](../packages/core/types/): `issue.ts`, `comment.ts`,
`subscriber.ts`, `agent.ts` (agents + tasks + runtimes + dashboard), `inbox.ts`,
`notification-preference.ts`, `workspace.ts`, `chat.ts`, `attachment.ts`,
`project.ts`, `label.ts`, `pin.ts`, `squad.ts`, `autopilot.ts`, `github.ts`,
`activity.ts`, `events.ts` (WS), `storage.ts`, plus `index.ts` re-exports
(`User`, `Skill`, `SkillSummary`, …). Onboarding types are in
`packages/core/onboarding/types.ts`.

---

## 6. Reconciliation checklist (input to the follow-on)

For each domain, the in-place reconciliation against the diverged `auto-tobe` api
should diff:

1. **Path + verb** drift (renamed / re-nested routes).
2. **Request shape** drift (renamed / added / removed fields).
3. **Response shape** drift — and add a `zod` schema + fallback per §2 (currently
   only ~12 endpoints are schema-guarded; the rest are bare `as` casts).
4. **WS event** drift (renamed events, changed payloads, `daemon:*` → cloud
   equivalents) — **out of scope here** (gateway protocol reconciliation is its
   own effort) but flagged for the map.
5. **Auth handshake** drift (header names, token vs cookie, WS auth message).
6. **Upload URL** resolution (same-origin `/uploads/*` → api-origin/CDN).
