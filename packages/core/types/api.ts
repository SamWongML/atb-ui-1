import type { MemberRole } from "./workspace";
import type { Project } from "./project";

// Issue request/response/cache types live in the Issue domain's contract
// module; re-exported here so the `@atb/core/types` barrel stays stable.
export type {
  CreateIssueRequest,
  UpdateIssueRequest,
  ListIssuesParams,
  ListIssuesResponse,
  IssueStatusBucket,
  ListIssuesCache,
  SearchIssueResult,
  SearchIssuesResponse,
} from "../issues/contract";

export interface SearchProjectResult extends Project {
  match_source: "title" | "description";
  matched_snippet?: string;
}

export interface SearchProjectsResponse {
  projects: SearchProjectResult[];
  total: number;
}

export interface UpdateMeRequest {
  name?: string;
  avatar_url?: string;
  language?: string;
}

export interface CreateMemberRequest {
  email: string;
  role?: MemberRole;
}

export interface UpdateMemberRequest {
  role: MemberRole;
}

// Personal Access Tokens
export interface PersonalAccessToken {
  id: string;
  name: string;
  token_prefix: string;
  expires_at: string | null;
  last_used_at: string | null;
  created_at: string;
}

export interface CreatePersonalAccessTokenRequest {
  name: string;
  expires_in_days?: number;
}

export interface CreatePersonalAccessTokenResponse extends PersonalAccessToken {
  token: string;
}

// Pagination
export interface PaginationParams {
  limit?: number;
  offset?: number;
}
