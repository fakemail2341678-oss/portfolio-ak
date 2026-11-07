import { z } from "zod";

/** The link page's path: a link id (UUID) or no match at all. */
export const linkParamsSchema = z.object({ linkId: z.uuid() });
