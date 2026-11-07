import { describe, expect, it } from "vitest";
import { breadcrumbJsonLd, crumbsFromMatches, loaderTitleCrumb, serializeJsonLd, staticCrumb } from "@/lib/breadcrumbs";

const match = (
	pathname: string,
	breadcrumb?: Parameters<typeof crumbsFromMatches>[0][number]["staticData"]["breadcrumb"],
	loaderData?: unknown,
) => ({
	pathname,
	loaderData,
	staticData: { breadcrumb },
});

describe("crumbsFromMatches", () => {
	it("keeps only routes that declare a breadcrumb, outermost first", () => {
		const crumbs = crumbsFromMatches([
			match("/"),
			match(
				"/admin",
				staticCrumb(() => "Admin"),
			),
			match(
				"/admin/test-crud",
				staticCrumb(() => "Test CRUD"),
			),
			match(
				"/admin/test-crud/new",
				staticCrumb(() => "New item"),
			),
		]);
		expect(crumbs).toEqual([
			{ label: "Admin", path: "/admin" },
			{ label: "Test CRUD", path: "/admin/test-crud" },
			{ label: "New item", path: "/admin/test-crud/new" },
		]);
	});

	it("merges a layout and its index route (same path, the deeper label wins)", () => {
		const crumbs = crumbsFromMatches([
			match(
				"/admin",
				staticCrumb(() => "Admin"),
			),
			match(
				"/admin/",
				staticCrumb(() => "Dashboard"),
			),
		]);
		expect(crumbs).toEqual([{ label: "Dashboard", path: "/admin" }]);
	});

	it("names detail pages from their loader data, and skips them until it exists", () => {
		const route = (data: unknown) => [
			match(
				"/test-crud",
				staticCrumb(() => "Items"),
			),
			match("/test-crud/momo", loaderTitleCrumb, data),
		];
		expect(crumbsFromMatches(route({ title: "Momo" })).at(-1)).toEqual({ label: "Momo", path: "/test-crud/momo" });
		expect(crumbsFromMatches(route(undefined))).toHaveLength(1);
		expect(crumbsFromMatches(route({ title: 42 }))).toHaveLength(1);
		expect(crumbsFromMatches(route({ title: "" }))).toHaveLength(1);
	});

	it("passes the match's params, so a layout can label itself from the URL", () => {
		const crumbs = crumbsFromMatches([
			{
				pathname: "/app/taskline/sandbox",
				params: { ws: "sandbox" },
				staticData: { breadcrumb: ({ params }) => (params.ws === "sandbox" ? "Sandbox" : "Team") },
			},
		]);
		expect(crumbs).toEqual([{ label: "Sandbox", path: "/app/taskline/sandbox" }]);
	});
});

describe("breadcrumb JSON-LD", () => {
	it("is a schema.org BreadcrumbList with absolute URLs", () => {
		const data = breadcrumbJsonLd([
			{ label: "Home", path: "/" },
			{ label: "Items", path: "/test-crud" },
		]);
		expect(data).toMatchObject({
			"@context": "https://schema.org",
			"@type": "BreadcrumbList",
			itemListElement: [
				{ "@type": "ListItem", position: 1, name: "Home" },
				{ "@type": "ListItem", position: 2, name: "Items" },
			],
		});
		for (const item of data.itemListElement) expect(item.item).toMatch(/^https?:\/\//);
		expect(data.itemListElement[1]?.item).toMatch(/\/test-crud$/);
	});

	it("can't break out of its <script> element", () => {
		const json = serializeJsonLd({ name: "</script><script>alert(1)</script>" });
		expect(json).not.toContain("</script>");
		expect(JSON.parse(json)).toEqual({ name: "</script><script>alert(1)</script>" });
	});
});
