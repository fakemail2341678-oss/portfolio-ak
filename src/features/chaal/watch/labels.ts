import { m } from "@/paraglide/messages";
import type { TvChannel } from "./lib/limits";

/** Each TV channel's name (Task 82): the speeds' words from the glossary, and three of its own. */
export const CHANNEL_NAMES: Readonly<Record<TvChannel, () => string>> = {
	best: m.chaal_tv_best,
	bullet: m.chaal_speed_bullet,
	blitz: m.chaal_speed_blitz,
	rapid: m.chaal_speed_rapid,
	classical: m.chaal_speed_classical,
	ultraBullet: m.chaal_speed_ultra_bullet,
	bot: m.chaal_tv_bot,
	computer: m.chaal_tv_computer,
};
