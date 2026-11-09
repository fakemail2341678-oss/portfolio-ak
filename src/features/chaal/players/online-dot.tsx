import { m } from "@/paraglide/messages";

/** Whether a player is on Lichess now: an ink dot, hollow when away. */
export function OnlineDot({ online }: { online: boolean }) {
	return (
		<span className="inline-flex shrink-0 items-center" data-online={online}>
			<span
				aria-hidden
				className={`size-2 rounded-full border border-ch-ink ${online ? "bg-ch-ink" : "bg-transparent opacity-50"}`}
			/>
			<span className="sr-only">{online ? m.ch_players_online() : m.ch_players_offline()}</span>
		</span>
	);
}
