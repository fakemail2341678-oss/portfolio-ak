import { m } from "@/paraglide/messages";
import { ConsentSettingsButton } from "./observability";

export function SiteFooter() {
	return (
		<footer className="border-t">
			<div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-6 text-muted-foreground text-sm">
				<span>{m.footer_built_with()}</span>
				<ConsentSettingsButton />
			</div>
		</footer>
	);
}
