import { createFileRoute } from "@tanstack/react-router";
import { Demo, ExamplePage } from "@/features/dev/examples/example-page";
import { staticCrumb } from "@/lib/breadcrumbs";
import { seo } from "@/lib/seo";
import { m } from "@/paraglide/messages";

/**
 * SEO head + JSON-LD: the same seo() call as a public page (title, description,
 * canonical, hreflang, Open Graph, Twitter, JSON-LD), with `noindex` because dev
 * pages are private. The page lists what seo() returned, i.e. what's in <head>.
 */
const exampleSeo = () =>
	seo({
		title: m.examples_seo_title(),
		description: m.examples_seo_description(),
		path: "/dev/examples/seo",
		noindex: true,
		jsonLd: { "@type": "WebPage", name: m.examples_seo_title(), description: m.examples_seo_description() },
	});

export const Route = createFileRoute("/dev/examples/seo")({
	staticData: { breadcrumb: staticCrumb(m.examples_seo_title) },
	head: exampleSeo,
	component: SeoExample,
});

function SeoExample() {
	const head = exampleSeo();
	const tags = head.meta.flatMap((entry) => {
		if (typeof entry.title === "string") return [{ key: "title", value: entry.title }];
		const key = entry.name ?? entry.property;
		return key && typeof entry.content === "string" ? [{ key, value: entry.content }] : [];
	});
	const jsonLd = head.meta.flatMap((entry) =>
		"script:ld+json" in entry ? [(entry as Record<string, unknown>)["script:ld+json"]] : [],
	);
	return (
		<ExamplePage slug="seo">
			<Demo title={m.examples_seo_meta()} note={m.examples_seo_meta_note()}>
				<div className="overflow-x-auto rounded-md border">
					<table className="w-full text-sm">
						<tbody>
							{tags.map((tag) => (
								<tr key={tag.key} className="border-b last:border-0">
									<th scope="row" className="whitespace-nowrap px-3 py-2 text-start font-mono font-normal text-xs">
										{tag.key}
									</th>
									<td className="break-all px-3 py-2">{tag.value}</td>
								</tr>
							))}
							{head.links.map((link) => (
								<tr key={`${link.rel}:${link.hrefLang ?? ""}`} className="border-b last:border-0">
									<th scope="row" className="whitespace-nowrap px-3 py-2 text-start font-mono font-normal text-xs">
										{link.hrefLang ? `${link.rel} ${link.hrefLang}` : link.rel}
									</th>
									<td className="break-all px-3 py-2">{link.href}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</Demo>
			<Demo title={m.examples_seo_json_ld()}>
				<pre className="whitespace-pre-wrap break-all rounded-md bg-muted p-3 text-xs" data-testid="seo-json-ld">
					{JSON.stringify(jsonLd, null, 2)}
				</pre>
			</Demo>
		</ExamplePage>
	);
}
