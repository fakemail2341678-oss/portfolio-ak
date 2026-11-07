import { createFileRoute } from "@tanstack/react-router";
import { db } from "@/server/db/client";
import { textResponse } from "@/server/seo/response";
import { sitemapEntries, sitemapXml } from "@/server/seo/sitemap";

/** /sitemap.xml: every indexable page in both languages (src/server/seo/sitemap.ts). */
export const Route = createFileRoute("/sitemap.xml")({
	server: {
		handlers: {
			GET: async ({ request }) =>
				textResponse(request, "/sitemap.xml", "application/xml", () => sitemapEntries({ db }).then(sitemapXml)),
		},
	},
});
