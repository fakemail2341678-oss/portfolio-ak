import type { ReactNode } from "react";
import { m } from "@/paraglide/messages";
import type { Color } from "../chess/rules";
import { sideName } from "../chess/speech";

/**
 * A player beside the board (PLAN 13.5, `PlayerStrip`; the comps): the name, a title and
 * the rating, a note ("Your move"), the material, and the clock at the right. The side to
 * move gets the heavy ink bar at its edge. Names are other people's text: shown as text,
 * and a link to their Lichess profile is `nofollow ugc` (PLAN 13.6).
 */
export function PlayerStrip({
	name,
	color,
	title,
	rating,
	provisional = false,
	href,
	active = false,
	note,
	material,
	children,
	className,
}: {
	name: string;
	color: Color;
	title?: string | null;
	rating?: number | null;
	provisional?: boolean;
	href?: string;
	active?: boolean;
	note?: string;
	material?: ReactNode;
	/** The clock. */
	children?: ReactNode;
	className?: string;
}) {
	const external = href?.startsWith("http");
	return (
		<div
			className={`flex items-center justify-between gap-3 border-l-4 py-1 pl-3 ${active ? "border-ch-ink" : "border-transparent"} ${className ?? ""}`}
			data-testid="chaal-player"
			data-color={color}
		>
			<div className="flex min-w-0 flex-col gap-0.5">
				<p className="flex min-w-0 items-baseline gap-1.5">
					<span className="sr-only">{sideName(color)}: </span>
					{title ? <span className="font-bold text-sm">{title}</span> : null}
					{href ? (
						<a
							href={href}
							className="truncate font-semibold underline-offset-4 hover:underline"
							{...(external ? { rel: "nofollow ugc noopener", target: "_blank" } : {})}
						>
							{name}
						</a>
					) : (
						<span className="truncate font-semibold">{name}</span>
					)}
					{rating ? (
						<span className="ch-figures shrink-0 text-ch-muted text-xs">
							{rating}
							{provisional ? "?" : ""}
						</span>
					) : null}
				</p>
				{note || material || active ? (
					<p className="flex min-h-4 items-center gap-2 text-ch-muted text-xs">
						{note ? <span>{note}</span> : active ? <span>{m.ch_player_to_move()}</span> : null}
						{material}
					</p>
				) : null}
			</div>
			{children}
		</div>
	);
}
