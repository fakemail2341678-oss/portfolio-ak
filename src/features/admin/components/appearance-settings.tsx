import type { LucideIcon } from "lucide-react";
import { PaletteIcon, UserIcon } from "lucide-react";
import type { ReactNode } from "react";
import { StatusBadge } from "@/components/data-display/status-badge";
import { THEME_ICONS, THEME_LABELS } from "@/components/layout/theme";
import { SettingsLayout, SettingsNavLink } from "@/components/page/layouts";
import { Page, PageHeader } from "@/components/page/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatNumber } from "@/lib/i18n/intl";
import { useAppearance } from "@/lib/stores/hooks";
import {
	ACCENTS,
	type AccentPreference,
	DENSITIES,
	type DensityPreference,
	RADII,
	type RadiusPreference,
	THEMES,
} from "@/lib/stores/preferences";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";

const ACCENT_LABELS: Record<AccentPreference, () => string> = {
	indigo: m.appearance_accent_indigo,
	violet: m.appearance_accent_violet,
	emerald: m.appearance_accent_emerald,
	amber: m.appearance_accent_amber,
	rose: m.appearance_accent_rose,
};
const RADIUS_LABELS: Record<RadiusPreference, () => string> = {
	sharp: m.appearance_radius_sharp,
	default: m.appearance_radius_default,
	round: m.appearance_radius_round,
};
/** The corner each radius preset draws in its tile (the presets' --radius in app.css). */
const RADIUS_PREVIEW: Record<RadiusPreference, string> = {
	sharp: "rounded-ss-[0.25rem]",
	default: "rounded-ss-[0.5rem]",
	round: "rounded-ss-[0.875rem]",
};
const DENSITY_LABELS: Record<DensityPreference, () => string> = {
	comfortable: m.appearance_density_comfortable,
	compact: m.appearance_density_compact,
};

/**
 * /admin/settings/appearance: the theme and the Graphite presets (accent, radius,
 * density). Each choice applies at once (the store re-renders <html>'s attributes)
 * and is kept in a cookie, so the next page is rendered with it on the server.
 * Per browser, like the theme. Plain radio groups: arrow keys move between options.
 */
export function AppearanceSettings() {
	const appearance = useAppearance();
	return (
		<Page width="admin">
			<PageHeader title={m.admin_nav_appearance()} description={m.appearance_description()} />
			<SettingsLayout label={m.settings_nav()} nav={<SettingsNav />}>
				<div className="grid items-start gap-8 2xl:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
					<div className="flex flex-col gap-8">
						<Choice
							legend={m.theme_label()}
							name="theme"
							options={THEMES}
							value={appearance.theme}
							onChange={appearance.setTheme}
							label={(theme) => THEME_LABELS[theme]()}
							preview={(theme) => <OptionIcon icon={THEME_ICONS[theme]} />}
						/>
						<Choice
							legend={m.appearance_accent()}
							name="accent"
							options={ACCENTS}
							value={appearance.accent}
							onChange={appearance.setAccent}
							label={(accent) => ACCENT_LABELS[accent]()}
							preview={(accent) => <span data-accent={accent} className="size-5 rounded-full bg-primary shadow-xs" />}
						/>
						<Choice
							legend={m.appearance_radius()}
							name="radius"
							options={RADII}
							value={appearance.radius}
							onChange={appearance.setRadius}
							label={(radius) => RADIUS_LABELS[radius]()}
							preview={(radius) => (
								<span className={cn("size-6 border-s-2 border-t-2 border-foreground/60", RADIUS_PREVIEW[radius])} />
							)}
						/>
						<Choice
							legend={m.appearance_density()}
							name="density"
							options={DENSITIES}
							value={appearance.density}
							onChange={appearance.setDensity}
							label={(density) => DENSITY_LABELS[density]()}
							preview={(density) => (
								<span className={cn("flex w-8 flex-col", density === "compact" ? "gap-0.5" : "gap-1.5")}>
									{[0, 1, 2].map((line) => (
										<span key={line} className="h-1 rounded-full bg-foreground/50" />
									))}
								</span>
							)}
						/>
					</div>
					<Preview />
				</div>
			</SettingsLayout>
		</Page>
	);
}

/** The settings pages: this browser's appearance, and the account (its own page, outside the admin area). */
function SettingsNav() {
	return (
		<>
			<SettingsNavLink to="/admin/settings/appearance">
				<PaletteIcon aria-hidden />
				{m.admin_nav_appearance()}
			</SettingsNavLink>
			<SettingsNavLink to="/account">
				<UserIcon aria-hidden />
				{m.nav_account()}
			</SettingsNavLink>
		</>
	);
}

function OptionIcon({ icon: Icon }: { icon: LucideIcon }) {
	return <Icon className="size-5 text-muted-foreground" aria-hidden />;
}

/** One preference as a row of tiles: native radios, so keyboard and forms behave as usual. */
function Choice<T extends string>({
	legend,
	name,
	options,
	value,
	onChange,
	label,
	preview,
}: {
	legend: string;
	name: string;
	options: ReadonlyArray<T>;
	value: T;
	onChange: (value: T) => void;
	label: (option: T) => string;
	preview: (option: T) => ReactNode;
}) {
	return (
		<fieldset className="flex flex-col gap-3">
			<legend className="mb-3 text-heading">{legend}</legend>
			<div className="flex flex-wrap gap-2">
				{options.map((option) => (
					<label
						key={option}
						className="flex min-w-28 cursor-pointer flex-col items-start gap-3 rounded-lg border bg-card p-3 text-body shadow-xs transition-colors hover:bg-accent has-checked:border-primary has-checked:bg-accent-subtle has-focus-visible:ring-[3px] has-focus-visible:ring-ring/50"
						data-testid={`appearance-${name}-${option}`}
					>
						<span className="flex h-6 items-center">{preview(option)}</span>
						<span className="flex items-center gap-2">
							<input
								type="radio"
								name={name}
								value={option}
								checked={value === option}
								onChange={() => onChange(option)}
								className="size-3.5 accent-primary outline-none"
							/>
							{label(option)}
						</span>
					</label>
				))}
			</div>
		</fieldset>
	);
}

/** Sample rows for the preview table: a peak's name and height in metres. */
const PEAKS: ReadonlyArray<readonly [() => string, number]> = [
	[m.appearance_peak_annapurna, 8091],
	[m.appearance_peak_dhaulagiri, 8167],
	[m.appearance_peak_manaslu, 8163],
];

/** Real components under the current settings, so a change is visible next to the controls. */
function Preview() {
	return (
		<section
			aria-labelledby="appearance-preview"
			className="flex flex-col gap-4 rounded-lg border bg-card p-4 shadow-sm xl:sticky xl:top-16"
		>
			<h2 id="appearance-preview" className="text-heading">
				{m.appearance_preview()}
			</h2>
			<div className="flex flex-wrap gap-2">
				<Button size="sm">{m.appearance_preview_primary()}</Button>
				<Button size="sm" variant="outline">
					{m.appearance_preview_secondary()}
				</Button>
				<Button size="sm" variant="ghost">
					{m.appearance_preview_ghost()}
				</Button>
			</div>
			<Input aria-label={m.appearance_preview_input()} placeholder={m.appearance_preview_input()} />
			<div className="flex flex-wrap gap-2">
				<StatusBadge tone="success">{m.appearance_preview_success()}</StatusBadge>
				<StatusBadge tone="warning">{m.appearance_preview_warning()}</StatusBadge>
				<StatusBadge tone="info">{m.appearance_preview_info()}</StatusBadge>
				<StatusBadge tone="danger">{m.appearance_preview_danger()}</StatusBadge>
			</div>
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead>{m.appearance_preview_name()}</TableHead>
						<TableHead className="text-end">{m.appearance_preview_count()}</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{PEAKS.map(([peak, height]) => (
						<TableRow key={height}>
							<TableCell>{peak()}</TableCell>
							<TableCell className="text-end">{formatNumber(height)}</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>
		</section>
	);
}
