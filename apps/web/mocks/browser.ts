import { setupWorker } from "msw/browser";
import { handlers } from "./handlers";

// Browser-side MSW worker. This module is dynamic-imported by MockProvider and
// only when the mock gate is on, so `msw/browser` never reaches a production
// bundle. Keep it side-effect-light: constructing the worker does not start it.
export const worker = setupWorker(...handlers);
