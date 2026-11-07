import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { zodInput } from "@/functions/_lib/validator";
import { devOnlyMiddleware } from "@/middleware/dev";
import { sanitizeRichText } from "@/server/rich-text/sanitize";

/**
 * Dev-only: runs the rich-text sanitizer for the /dev/forms showcase so the
 * stored/rendered form of editor output can be inspected. Refuses in production.
 */
export const previewRichText = createServerFn({ method: "POST" })
	.middleware([devOnlyMiddleware])
	.validator(zodInput(z.object({ html: z.string().max(100_000) })))
	.handler(({ data }) => ({ html: sanitizeRichText(data.html) }));
