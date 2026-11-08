import { ShieldIcon } from "lucide-react";
import { m } from "@/paraglide/messages";
import { useFairPlay } from "../live/fair-play";

/**
 * Fair play's banner (PLAN 13.5; decision 0264): while the player has a real-time game in
 * progress, the engine, cloud eval and the explorer are off everywhere in Chaal, and every
 * page says why, under the top bar. The live game (Task 77) sets the lock; on the server
 * nothing is locked, so the banner appears only in the browser.
 */
export function FairPlayBanner() {
	const { locked } = useFairPlay();
	if (!locked) return null;
	return (
		<aside
			aria-label={m.ch_fair_play_label()}
			className="ch-hairline bg-ch-plate text-sm"
			data-testid="chaal-fair-play"
		>
			<p className="mx-auto flex max-w-7xl items-start gap-2 px-4 py-2 sm:px-6 lg:px-8">
				<ShieldIcon aria-hidden className="mt-0.5 size-4 shrink-0 text-ch-muted" />
				<span>{m.ch_fair_play_banner()}</span>
			</p>
		</aside>
	);
}
