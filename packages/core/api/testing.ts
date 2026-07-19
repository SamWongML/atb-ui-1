import type { Transport } from "./transport";

export interface RecordedCall {
  path: string;
  init?: RequestInit;
}

/**
 * In-memory Transport adapter for contract-module tests — the second adapter
 * at the transport seam (HttpTransport is the first). `respond` maps a
 * request to the decoded JSON body `json()` resolves with; return a
 * `Response` to serve `raw()` callers verbatim. Throw (e.g. an ApiError)
 * to exercise a contract's error path.
 */
export function createFakeTransport(
  respond: (path: string, init?: RequestInit) => unknown = () => undefined,
): Transport & { calls: RecordedCall[] } {
  const calls: RecordedCall[] = [];
  return {
    calls,
    async json(path: string, init?: RequestInit): Promise<unknown> {
      calls.push({ path, init });
      const body = respond(path, init);
      return body instanceof Response ? body.json() : body;
    },
    async raw(path: string, init?: RequestInit): Promise<Response> {
      calls.push({ path, init });
      const body = respond(path, init);
      if (body instanceof Response) return body;
      return new Response(JSON.stringify(body ?? null), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    },
  };
}
