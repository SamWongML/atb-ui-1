// Re-export stub: the Issue domain's types live in its contract module.
// Kept so the `@atb/core/types` barrel and existing `./issue` imports stay
// stable while domains fold into per-domain contracts.
export type {
  Issue,
  IssueStatus,
  IssuePriority,
  IssueAssigneeType,
  IssueReaction,
} from "../issues/contract";
