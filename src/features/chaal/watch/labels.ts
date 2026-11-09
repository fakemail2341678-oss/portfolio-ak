import { m } from "@/paraglide/messages";
import type { TvChannel } from "./limits";

/** Each TV channel's name (Task 82): the speeds' words from the glossary, and three of its own. */
export const CHANNEL_NAMES: Readonly<Record<TvChannel, () => string>> = {
	best: m.ch_tv_best,
	bullet: m.ch_speed_bullet,
	blitz: m.ch_speed_blitz,
	rapid: m.ch_speed_rapid,
	classical: m.ch_speed_classical,
	ultraBullet: m.ch_speed_ultra_bullet,
	bot: m.ch_tv_bot,
	computer: m.ch_tv_computer,
};
