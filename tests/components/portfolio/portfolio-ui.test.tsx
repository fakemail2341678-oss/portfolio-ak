// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
	createMemoryHistory,
	createRootRouteWithContext,
	createRoute,
	createRouter,
	RouterProvider,
} from "@tanstack/react-router";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { HomeTime } from "@/features/portfolio/components/chrome/home-time";
import { PortfolioMenu } from "@/features/portfolio/components/chrome/portfolio-menu";
import { CopyEmailButton } from "@/features/portfolio/components/contact/copy-email-button";
import { SelectedWorkSection } from "@/features/portfolio/components/sections/selected-work-section";
import type { ProjectSummary } from "@/features/portfolio/types";
import { formatDate } from "@/lib/i18n/intl";
import { createPreferencesStore, DEFAULT_PREFERENCES } from "@/lib/stores/preferences";
import { m } from "@/paraglide/messages";
import type { RouterContext } from "@/router";

/** Renders `ui` on every portfolio path of a memory router (the menu's links need routes to resolve). */
async function renderInRouter(ui: ReactNode) {
	const rootRoute = createRootRouteWithContext<Pick<RouterContext, "preferences">>()({ component: () => <>{ui}</> });
	const routeTree = rootRoute.addChildren(
		["/", "/work", "/work/$slug", "/about", "/journal", "/contact"].map((path) =>
			createRoute({ getParentRoute: () => rootRoute, path, component: () => null }),
		),
	);
	const router = createRouter({
		routeTree,
		history: createMemoryHistory({ initialEntries: ["/"] }),
		context: { preferences: createPreferencesStore(DEFAULT_PREFERENCES) },
	});
	await act(() => router.load());
	render(
		<QueryClientProvider client={new QueryClient()}>
			<RouterProvider router={router} />
		</QueryClientProvider>,
	);
	return { router, user: userEvent.setup() };
}

describe("PortfolioMenu", () => {
	it("is a native disclosure that closes on Escape and after choosing a link", async () => {
		const { router, user } = await renderInRouter(<PortfolioMenu />);
		const summary = await screen.findByText(m.portfolio_menu_open());
		const details = summary.closest("details");
		if (!details) throw new Error("no <details>");

		await user.click(summary);
		expect(details.open).toBe(true);
		await user.keyboard("{Escape}");
		expect(details.open).toBe(false);

		await user.click(summary);
		const nav = screen.getByRole("navigation", { name: m.portfolio_nav_label() });
		await user.click(within(nav).getByRole("link", { name: new RegExp(m.portfolio_nav_journal()) }));
		expect(details.open).toBe(false);
		expect(router.state.location.pathname).toBe("/journal");
	});
});

describe("CopyEmailButton", () => {
	it("copies the address and announces it", async () => {
		const user = userEvent.setup();
		const writeText = vi.fn().mockResolvedValue(undefined);
		vi.spyOn(navigator, "clipboard", "get").mockReturnValue({ writeText } as unknown as Clipboard);
		render(<CopyEmailButton email="hello@example.com" />);
		await user.click(screen.getByRole("button", { name: m.portfolio_contact_copy() }));
		expect(writeText).toHaveBeenCalledWith("hello@example.com");
		expect((await screen.findByRole("status")).textContent).toBe(m.portfolio_contact_copied());
	});
});

const project = (slug: string, title: string): ProjectSummary => ({
	slug,
	title,
	client: `${title} Ltd`,
	year: 2025,
	disciplines: ["product"],
	role: "Lead",
	duration: "3 months",
	summary: `What ${title} did.`,
	stack: ["TypeScript"],
	featured: true,
	cover: { motif: "orbit", glyph: title.slice(0, 1), seed: slug, image: null },
	metrics: [],
});

describe("SelectedWorkSection", () => {
	it("strikes forward the project under the focus or the pointer and shows its mountain and summary", async () => {
		const user = userEvent.setup();
		await renderInRouter(
			<SelectedWorkSection projects={[project("ledgerline", "Ledgerline"), project("sathi", "Sathi")]} total={7} />,
		);
		const name = (title: string) => screen.getByRole("heading", { level: 3, name: title });
		expect(name("Ledgerline").className).toContain("md:text-hm-ink");
		expect(name("Sathi").className).toContain("md:text-hm-muted");
		expect(screen.getByText("What Ledgerline did.")).toBeTruthy();

		await act(() => screen.getByRole("link", { name: /Sathi/ }).focus());
		expect(name("Sathi").className).toContain("md:text-hm-ink");
		expect(screen.getByText("What Sathi did.")).toBeTruthy();

		await user.hover(screen.getByRole("link", { name: /Ledgerline/ }));
		expect(name("Ledgerline").className).toContain("md:text-hm-ink");
	});
});

describe("HomeTime", () => {
	const generatedAt = "2026-10-23T00:27:00.000Z";

	it("renders Kathmandu's time for the moment the page was read, and no gap, on the server", () => {
		const html = renderToString(<HomeTime generatedAt={generatedAt} location="Kathmandu, Nepal" />);
		const time = formatDate(Date.parse(generatedAt), { timeStyle: "short" });
		expect(html).toContain(m.portfolio_time_now({ time, place: "Kathmandu" }));
		expect(html).not.toContain("ahead");
	});

	it("tells the visitor how far ahead Kathmandu's clock is, in the browser", () => {
		const offset = vi.spyOn(Date.prototype, "getTimezoneOffset").mockReturnValue(-60);
		render(<HomeTime generatedAt={generatedAt} location="Kathmandu, Nepal" />);
		const gap = m.portfolio_time_hours_minutes({ hours: "4", minutes: "45" });
		expect(screen.getByText(m.portfolio_time_ahead({ gap }))).toBeTruthy();
		offset.mockRestore();
	});
});
