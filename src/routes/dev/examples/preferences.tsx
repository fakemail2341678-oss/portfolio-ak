import { createFileRoute } from "@tanstack/react-router";
import { useId } from "react";
import { DescriptionList } from "@/components/data-display/description-list";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { Demo, ExamplePage } from "@/features/dev/examples/example-page";
import { staticCrumb } from "@/lib/breadcrumbs";
import { formatNumber } from "@/lib/i18n/intl";
import { privateHead } from "@/lib/seo";
import { useSidebar, useTablePreferences, useTheme } from "@/lib/stores/hooks";
import { PAGE_SIZES, THEMES, type ThemePreference } from "@/lib/stores/preferences";
import { m } from "@/paraglide/messages";

/**
 * Store preferences: one TanStack Store per router, seeded from cookies. The
 * server reads the cookies on every request, so the page renders with the
 * visitor's real choices (no flash after hydration). Components subscribe to a
 * slice with the hooks in src/lib/stores/hooks.ts; actions update the store and
 * the cookie together.
 */
export const Route = createFileRoute("/dev/examples/preferences")({
	staticData: { breadcrumb: staticCrumb(m.examples_preferences_title) },
	head: () => privateHead(m.examples_preferences_title()),
	component: PreferencesExample,
});

const THEME_LABELS: Record<ThemePreference, () => string> = {
	light: m.theme_light,
	dark: m.theme_dark,
	system: m.theme_system,
};

/** The DataTable example's table: its page size and hidden columns live here too. */
const TABLE_ID = "examples-tasks";

function PreferencesExample() {
	const { theme, setTheme } = useTheme();
	const sidebar = useSidebar();
	const table = useTablePreferences(TABLE_ID);
	const sidebarId = useId();
	const pageSizeId = useId();
	return (
		<ExamplePage slug="preferences">
			<Demo title={m.examples_preferences_controls()} note={m.examples_preferences_note()}>
				<fieldset className="flex flex-col gap-2">
					<legend className="mb-2 font-medium text-sm">{m.examples_preferences_theme()}</legend>
					<div className="flex flex-wrap gap-2">
						{THEMES.map((value) => (
							<Button
								key={value}
								size="sm"
								variant={theme === value ? "default" : "outline"}
								aria-pressed={theme === value}
								onClick={() => setTheme(value)}
							>
								{THEME_LABELS[value]()}
							</Button>
						))}
					</div>
				</fieldset>
				<div className="flex items-center gap-3">
					<Switch id={sidebarId} checked={sidebar.collapsed} onCheckedChange={sidebar.setCollapsed} />
					<Label htmlFor={sidebarId}>{m.examples_preferences_sidebar()}</Label>
				</div>
				<div className="flex flex-col gap-2">
					<Label htmlFor={pageSizeId}>{m.examples_preferences_page_size()}</Label>
					<NativeSelect
						id={pageSizeId}
						value={String(table.pageSize)}
						onChange={(event) => table.setPageSize(Number(event.target.value))}
						className="w-32"
					>
						{PAGE_SIZES.map((size) => (
							<option key={size} value={size}>
								{formatNumber(size)}
							</option>
						))}
					</NativeSelect>
				</div>
			</Demo>
			<Demo title={m.examples_preferences_state()}>
				<DescriptionList
					items={[
						{ label: m.examples_preferences_theme(), value: THEME_LABELS[theme](), testId: "pref-theme" },
						{
							label: m.examples_preferences_sidebar(),
							value: sidebar.collapsed ? m.examples_yes() : m.examples_no(),
						},
						{ label: m.examples_preferences_page_size(), value: formatNumber(table.pageSize) },
						{
							label: m.examples_preferences_hidden(),
							value: table.hiddenColumns.length > 0 ? table.hiddenColumns.join(", ") : m.examples_none(),
						},
					]}
				/>
			</Demo>
		</ExamplePage>
	);
}
