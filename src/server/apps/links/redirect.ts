import "@tanstack/react-start/server-only";
import { waitUntil } from "@vercel/functions";
import { LINK_SLUG_PATTERN } from "@/features/apps/links/schema";
import type { Db } from "@/server/db/types";
import { errorFields, log } from "@/server/log";
import { clickFacts } from "./clicks";
import { recordClick, resolveShortLink } from "./service";

/**
 * The short link's answer (decision 0191): a 302 to the target when the link may
 * redirect now, else null (the route falls through to the localized 404). A GET
 * records the click in the background (`waitUntil`), so the redirect never waits
 * for the insert, and a failed insert never fails the redirect. HEAD (link checkers)
 * redirects without counting.
 */
export async function shortLinkResponse(db: Db, slug: string, request: Request): Promise<Response | null> {
	if (!LINK_SLUG_PATTERN.test(slug)) return null;
	const link = await resolveShortLink(db, slug);
	if (!link) return null;
	if (request.method === "GET") {
		waitUntil(
			recordClick(db, { linkId: link.id, ownerId: link.ownerId }, clickFacts(request.headers)).catch(
				(error: unknown) => {
					log("error", "short link click not recorded", { slug, ...errorFields(error) });
				},
			),
		);
	}
	return new Response(null, {
		status: 302,
		// Never cached: pausing, blocking or expiring a link must take effect at once.
		headers: { location: link.target, "cache-control": "private, no-store" },
	});
}
