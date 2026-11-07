import { z } from "zod";
import { CONNECT_RESULTS } from "./links";

/**
 * Chaal's URL contracts (route files import this, never a form schema, 0194). Search
 * schemas aren't strict: links carry utm tags.
 */

/** A page connecting returns to (settings, the admin's lab): `?lichess=` says how it ended. */
export const connectResultSearch = z.object({ lichess: z.enum(CONNECT_RESULTS).optional().catch(undefined) });
