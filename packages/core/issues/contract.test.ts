import { describe, expect, it } from "vitest";
import { createFakeTransport } from "../api/testing";
import { createIssuesContract } from "./contract";

// Malformed-response tests for the Issue domain's guarded operations — the
// failure modes that white-screened the desktop app in past incidents. The
// contract is: a malformed response degrades to an empty/safe shape, never
// throws into React. Ops still carrying a visible `as` cast in contract.ts
// gain their cases here as reconciliation replaces the casts.

function contractWith(body: unknown) {
  const transport = createFakeTransport(() => body);
  return { issues: createIssuesContract(transport), transport };
}

describe("issues contract schema fallback", () => {
  describe("listTimeline", () => {
    it("falls back to an empty array when the body is null", async () => {
      const { issues } = contractWith(null);
      const entries = await issues.listTimeline("issue-1");
      expect(entries).toEqual([]);
    });

    it("falls back when the body is not an array", async () => {
      const { issues } = contractWith({ wrong: "shape" });
      const entries = await issues.listTimeline("issue-1");
      expect(entries).toEqual([]);
    });

    it("accepts a new entry type rather than crashing on enum drift", async () => {
      const { issues } = contractWith([
        {
          type: "future_kind", // not in TS union
          id: "e-1",
          actor_type: "member",
          actor_id: "u-1",
          created_at: "2026-01-01T00:00:00Z",
        },
      ]);
      const entries = await issues.listTimeline("issue-1");
      expect(entries).toHaveLength(1);
      expect(entries[0]?.type).toBe("future_kind");
    });

    // Forward-compat: when the server adds a new field to an existing
    // shape, `.loose()` lets it pass through unchanged. Without `.loose()`
    // zod 4 strips it, which would silently break a future TS type that
    // adopts the field — see ../api/schemas.ts header comment.
    it("preserves unknown fields the schema didn't list", async () => {
      const { issues } = contractWith([
        {
          type: "comment",
          id: "e-1",
          actor_type: "member",
          actor_id: "u-1",
          created_at: "2026-01-01T00:00:00Z",
          // New server-side field not present in TimelineEntrySchema:
          future_field: { nested: "value" },
        },
      ]);
      const entries = await issues.listTimeline("issue-1");
      const entry = entries[0] as unknown as Record<string, unknown>;
      expect(entry.future_field).toEqual({ nested: "value" });
    });
  });

  describe("listIssues", () => {
    it("falls back to an empty list when the response is malformed", async () => {
      // `issues` having the wrong type triggers the fallback. An object
      // with only unexpected keys would *succeed* parsing now (every
      // declared field has a default) and just pass the extras through
      // via `.loose()`, so we use a wrong-type payload here instead.
      const { issues } = contractWith({ issues: "not-an-array", total: 0 });
      const res = await issues.listIssues();
      expect(res).toEqual({ issues: [], total: 0 });
    });
  });

  describe("listChildIssues", () => {
    it("returns { issues: [] } when the issues field is missing", async () => {
      const { issues } = contractWith({});
      const res = await issues.listChildIssues("issue-1");
      expect(res).toEqual({ issues: [] });
    });
  });
});

describe("issues contract request shape", () => {
  it("serialises list filters onto the query string", async () => {
    const { issues, transport } = contractWith({ issues: [], total: 0 });
    await issues.listIssues({
      status: "todo",
      assignee_ids: ["a", "b"],
      open_only: true,
    });
    expect(transport.calls).toHaveLength(1);
    expect(transport.calls[0]?.path).toBe(
      "/api/issues?status=todo&assignee_ids=a%2Cb&open_only=true",
    );
  });
});
