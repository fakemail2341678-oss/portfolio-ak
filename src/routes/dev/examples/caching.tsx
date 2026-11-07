import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { DescriptionList } from "@/components/data-display/description-list";
import { Button } from "@/components/ui/button";
import { Demo, ExamplePage } from "@/features/dev/examples/example-page";
import { staticCrumb } from "@/lib/breadcrumbs";
import { publicCache } from "@/lib/http/cache-control";
import { privateHead } from "@/lib/seo";
import { m } from "@/paraglide/messages";

/**
 * Recipe: caching a public page at the CDN (docs/guides/recipes.md). The route's
 * `headers` sets Cache-Control on its HTML response; on Vercel the edge then
 * serves it without running the function until `s-maxage` passes. This page
 * reads its own response headers back with a HEAD request.
 */
const CACHE_CONTROL = publicCache({ sMaxAge: 300, staleWhileRevalidate: 86_400 });

export const Route = createFileRoute("/dev/examples/caching")({
	headers: () => ({ "cache-control": CACHE_CONTROL }),
	staticData: { breadcrumb: staticCrumb(m.examples_caching_title) },
	head: () => privateHead(m.examples_caching_title()),
	component: CachingExample,
});

function CachingExample() {
	const [received, setReceived] = useState<string | null>(null);
	const check = async () => {
		const response = await fetch(window.location.href, { method: "HEAD", cache: "no-store" });
		setReceived(response.headers.get("cache-control") ?? "—");
	};
	return (
		<ExamplePage slug="caching">
			<Demo title={m.examples_caching_title()} note={m.examples_caching_note()}>
				<DescriptionList
					items={[
						{ label: m.examples_caching_set(), value: <code className="text-xs">{CACHE_CONTROL}</code> },
						{
							label: m.examples_caching_received(),
							value: received ? <code className="text-xs">{received}</code> : "—",
							testId: "cache-control",
						},
					]}
				/>
				<Button variant="outline" className="self-start" onClick={() => void check()}>
					{m.examples_caching_check()}
				</Button>
			</Demo>
		</ExamplePage>
	);
}
