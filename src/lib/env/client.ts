import { createClientEnv } from "./client.schema.ts";

/** Validated public environment. Safe to import anywhere, including the browser. */
export const clientEnv = createClientEnv(import.meta.env);
