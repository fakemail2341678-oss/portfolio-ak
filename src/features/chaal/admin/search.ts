import { z } from "zod";
import { CONNECT_RESULTS } from "../links";

/** /admin/chaal/lab: `?lichess=` says how connecting ended (the OAuth routes add it). */
export const chaalLabSearch = z.object({ lichess: z.enum(CONNECT_RESULTS).optional().catch(undefined) });
