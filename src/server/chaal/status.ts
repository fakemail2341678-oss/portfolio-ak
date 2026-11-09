import "@tanstack/react-start/server-only";
import { readEngineLimits } from "@/features/chaal/engine/limits";
import { CHAAL_FEATURES, type ChaalFeature, featureOn } from "@/features/chaal/features";
import { readPlayLimits } from "@/features/chaal/play/controls";
import type { ChaalStatus } from "@/features/chaal/schema";
import type { Session } from "@/lib/session";
import type { ChaalPublic } from "./context";

/** What every Chaal page needs to know first: the switches, whether this visitor can connect, and the admin's notice. */
export function chaalStatus(chaal: ChaalPublic, session: Session | null): ChaalStatus {
	const guestRefused = session?.isAnonymous === true && !chaal.settings.guestsMayConnect;
	return {
		features: Object.fromEntries(
			CHAAL_FEATURES.map((feature) => [feature, featureOn(chaal.settings.features, feature)]),
		) as Record<ChaalFeature, boolean>,
		connect: chaal.connectConfigured && !guestRefused ? "on" : "off",
		explorerForVisitors: chaal.appToken !== null,
		banner: chaal.settings.banner?.en.trim() ? chaal.settings.banner : null,
		engine: readEngineLimits(chaal.settings.engine),
		play: readPlayLimits(chaal.settings.play),
	};
}
