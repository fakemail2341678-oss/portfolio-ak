import { useQuery } from "@tanstack/react-query";
import { Link, type LinkOptions } from "@tanstack/react-router";
import { InfoIcon, LinkIcon, type LucideIcon, PaletteIcon } from "lucide-react";
import { MAIN_CONTENT } from "@/components/layout/skip-link";
import { Button } from "@/components/ui/button";
import { sessionQueryOptions } from "@/features/auth/queries";
import { m } from "@/paraglide/messages";
import { MiniBoard } from "../board/mini-board";
import { canConnect, connectionState, useConnectLichess } from "../connect/use-connect";
import { chaalLinks } from "../links";
import { chaalConnectionQueryOptions, chaalStatusQueryOptions } from "../queries";
import { useChaalPreferences } from "../settings/use-preferences";

/** The hero's diagram: the Ruy Lopez after 3.Bb5, White's last move ringed. */
const HERO = {
	fen: "r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3",
	marks: ["f1", "b5"],
	/** Opening names stay as Lichess gives them (PLAN 13.6); the move is figurine notation. */
	caption: "Ruy Lopez · 3.♗b5",
} as const;

const focusRing = "outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

/** An entry into Chaal: a ruled tile with an icon, a title and a line. They grow with the pages (Play from Task 76). */
function Entry({
	link,
	icon: Icon,
	title,
	body,
	testId,
}: {
	link: LinkOptions;
	icon: LucideIcon;
	title: string;
	body: string;
	testId: string;
}) {
	return (
		<li className="flex">
			<Link
				{...link}
				className={`ch-press flex flex-1 items-start gap-4 border border-ch-hair bg-ch-plate p-5 transition-colors hover:border-ch-ink ${focusRing}`}
				data-testid={testId}
			>
				<Icon aria-hidden className="mt-0.5 size-6 shrink-0" strokeWidth={1.5} />
				<span className="flex flex-col gap-1">
					<span className="font-semibold">{title}</span>
					<span className="text-ch-muted text-sm">{body}</span>
				</span>
			</Link>
		</li>
	);
}

/**
 * /app/chaal, the first version (PLAN Task 73): a hero with the diagram drawn on the server
 * in the player's board theme, the one thing to do next (connect Lichess, else set up the
 * board), and the entries to what exists. Play, puzzles, analysis and TV take this page over
 * as they arrive (the approved comp, decision 0258).
 */
export function ChaalHome() {
	const { data: session } = useQuery(sessionQueryOptions());
	const { data: status } = useQuery(chaalStatusQueryOptions());
	const { data: connection } = useQuery({ ...chaalConnectionQueryOptions(), enabled: Boolean(session) });
	const { preferences } = useChaalPreferences();
	const { connect, pending } = useConnectLichess();
	const state = connectionState(connection);
	const offerConnect = canConnect(status) && state !== "ok";

	return (
		<main {...MAIN_CONTENT} className="flex flex-1 flex-col outline-none" data-testid="chaal-home">
			<section
				aria-labelledby="chaal-home-title"
				className="mx-auto grid w-full max-w-7xl gap-10 px-4 pt-8 pb-12 sm:px-6 md:grid-cols-[1fr_minmax(0,22rem)] md:items-center lg:grid-cols-[1fr_minmax(0,30rem)] lg:gap-16 lg:px-8 lg:pt-14 lg:pb-16"
			>
				<div className="flex flex-col items-start gap-5">
					<h1 id="chaal-home-title" className="ch-display text-balance text-ch-title">
						{m.ch_home_heading()}
					</h1>
					<p className="max-w-prose text-lg text-ch-muted">{m.ch_home_intro()}</p>
					<div className="flex flex-wrap items-center gap-x-5 gap-y-3 pt-1">
						{offerConnect ? (
							<Button size="lg" onClick={() => void connect()} disabled={pending} data-testid="chaal-home-connect">
								<LinkIcon aria-hidden />
								{state === "attention" ? m.ch_reconnect() : m.ch_connect()}
							</Button>
						) : (
							<Button asChild size="lg">
								<Link {...chaalLinks.settings("board")}>{m.ch_home_set_up_board()}</Link>
							</Button>
						)}
						<p className="text-ch-muted text-sm">{m.ch_home_soon()}</p>
					</div>
				</div>
				<figure className="flex w-full max-w-[30rem] flex-col gap-3 justify-self-center md:justify-self-end">
					<MiniBoard
						fen={HERO.fen}
						marks={HERO.marks}
						label={m.ch_home_board_label()}
						theme={preferences.board}
						pieces={preferences.pieces}
						coordinates={preferences.coordinates}
					/>
					<figcaption className="ch-hairline flex flex-wrap justify-between gap-x-4 gap-y-1 pb-2 text-ch-muted text-sm">
						<span lang="en" dir="ltr">
							{HERO.caption}
						</span>
						<span>{m.ch_home_board_caption()}</span>
					</figcaption>
				</figure>
			</section>
			<section aria-labelledby="chaal-start" className="mx-auto w-full max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
				<h2 id="chaal-start" className="ch-display ch-rule pt-4 text-ch-head">
					{m.ch_home_start()}
				</h2>
				<ul className="mt-6 grid gap-3 md:grid-cols-3">
					<Entry
						link={chaalLinks.settings("connection")}
						icon={LinkIcon}
						title={connection ? m.ch_home_entry_connected() : m.ch_home_entry_connect()}
						body={
							connection
								? m.ch_home_entry_connected_body({ username: connection.username })
								: m.ch_home_entry_connect_body()
						}
						testId="chaal-entry-connection"
					/>
					<Entry
						link={chaalLinks.settings("board")}
						icon={PaletteIcon}
						title={m.ch_home_entry_board()}
						body={m.ch_home_entry_board_body()}
						testId="chaal-entry-board"
					/>
					<Entry
						link={chaalLinks.about()}
						icon={InfoIcon}
						title={m.ch_home_entry_about()}
						body={m.ch_home_entry_about_body()}
						testId="chaal-entry-about"
					/>
				</ul>
			</section>
		</main>
	);
}
