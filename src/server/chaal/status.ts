import "@tanstack/react-start/server-only";
import { readEngineLimits } from "@/features/chaal/engine/limits";
import { CHAAL_FEATURES, type ChaalFeature, featureOn } from "@/features/chaal/features";
import { readPlayLimits } from "@/features/chaal/play/controls";
import { readPuzzleLimits } from "@/features/chaal/puzzles/limits";
import type { ChaalStatus } from "@/features/chaal/schema";
import { readDefaults } from "@/features/chaal/settings/preferences";
import { readWatchLimits } from "@/features/chaal/watch/limits";
import type { Session } from "@/lib/session";
import type { ChaalPublic } from "./context";

/** Features that are only a player's token at work: off while Chaal is in maintenance (decision 0268). */
const TOKEN_ONLY: ReadonlyArray<ChaalFeature> = ["play", "chat"];

/** What every Chaal page needs to know first: the switches, whether this visitor can connect, and the admin's notices. */
export function chaalStatus(chaal: ChaalPublic, session: Session | null): ChaalStatus {
	const { settings } = chaal;
	const guestRefused = session?.isAnonymous === true && !settings.guestsMayConnect;
	const maintenance = settings.maintenance;
	return {
		features: Object.fromEntries(
			CHAAL_FEATURES.map((feature) => [
				feature,
				featureOn(settings.features, feature) && !(maintenance && TOKEN_ONLY.includes(feature)),
			]),
		) as Record<ChaalFeature, boolean>,
		connect: chaal.connectConfigured && !guestRefused && !maintenance ? "on" : "off",
		explorerForVisitors: chaal.appToken !== null,
		banner: chaal.settings.banner?.en.trim() ? chaal.settings.banner : null,
		engine: readEngineLimits(chaal.settings.engine),
		play: readPlayLimits(chaal.settings.play),
		puzzles: readPuzzleLimits(chaal.settings.puzzles),
		watch: readWatchLimits(chaal.settings.watch),
		live: chaal.lichess.config.apiBase.replace(/\/$/, ""),
		defaults: readDefaults(settings.defaults),
		maintenance: maintenance
			? { message: settings.maintenanceMessage?.en.trim() ? settings.maintenanceMessage : null }
			: null,
	};
}
