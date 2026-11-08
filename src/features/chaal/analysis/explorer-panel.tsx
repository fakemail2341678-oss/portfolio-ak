import { ExternalLinkIcon, LinkIcon } from "lucide-react";
import { type FormEvent, useId, useState } from "react";
import { errorMessage } from "@/components/errors/error-page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { formatNumber } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import { showSan } from "../chess/notation";
import {
	type ChaalExplorer,
	type ChaalExplorerResult,
	EXPLORER_RATINGS,
	EXPLORER_SPEEDS,
	type ExplorerDatabase,
	type ExplorerRating,
	type ExplorerSpeed,
} from "../schema";
import type { ExplorerQuery } from "./queries";

const DATABASE_NAMES: Readonly<Record<ExplorerDatabase, () => string>> = {
	masters: m.ch_explorer_masters,
	// A name: never translated (the glossary).
	lichess: () => "Lichess",
	player: m.ch_explorer_player,
};

const SPEED_NAMES: Readonly<Record<ExplorerSpeed, () => string>> = {
	bullet: m.ch_speed_bullet,
	blitz: m.ch_speed_blitz,
	rapid: m.ch_speed_rapid,
	classical: m.ch_speed_classical,
	correspondence: m.ch_speed_correspondence,
};

const percent = (part: number, total: number) => (total > 0 ? Math.round((part / total) * 100) : 0);

/**
 * The opening explorer (PLAN Task 75; the comps): Lichess's masters, its own games (by
 * speed and rating) or one player's, from the position shown. Each move with how often
 * it was played and how those games ended, as a paper, grey and ink bar; a move plays it.
 * Below, the best games (or the player's latest), each a link to lichess.org.
 */
export function ExplorerPanel({
	query,
	onQueryChange,
	result,
	pending,
	error,
	notation,
	locked,
	canConnect,
	onConnect,
	onPlay,
	defaultPlayer,
}: {
	query: Omit<ExplorerQuery, "fen">;
	onQueryChange: (query: Omit<ExplorerQuery, "fen">) => void;
	result: ChaalExplorerResult | undefined;
	pending: boolean;
	error: unknown;
	notation: "figurine" | "letters";
	locked: boolean;
	/** A visitor without a token may connect Lichess to use it. */
	canConnect: boolean;
	onConnect: () => void;
	onPlay: (uci: string) => void;
	/** The connected account's name, the player tab's first guess. */
	defaultPlayer: string | null;
}) {
	if (locked) return <p className="py-3 text-ch-muted text-sm">{m.ch_explorer_locked()}</p>;
	return (
		<div className="flex flex-col gap-3 py-2" data-testid="chaal-explorer">
			<ToggleGroup
				type="single"
				variant="outline"
				size="sm"
				value={query.database}
				onValueChange={(value) => {
					if (value) onQueryChange({ ...query, database: value as ExplorerDatabase });
				}}
				aria-label={m.ch_explorer_database()}
				className="w-full"
			>
				{(["masters", "lichess", "player"] as const).map((database) => (
					<ToggleGroupItem
						key={database}
						value={database}
						className="flex-1"
						data-testid={`chaal-explorer-${database}`}
					>
						{DATABASE_NAMES[database]()}
					</ToggleGroupItem>
				))}
			</ToggleGroup>
			{query.database === "lichess" ? <LichessFilters query={query} onQueryChange={onQueryChange} /> : null}
			{query.database === "player" ? (
				<PlayerFilter query={query} onQueryChange={onQueryChange} defaultPlayer={defaultPlayer} />
			) : null}
			{query.database === "player" && !query.player ? (
				<p className="text-ch-muted text-sm">{m.ch_explorer_player_hint()}</p>
			) : pending ? (
				<ExplorerSkeleton />
			) : error ? (
				<p className="text-sm" role="alert">
					{errorMessage(error)}
				</p>
			) : result && !result.ok ? (
				<div className="flex flex-col items-start gap-2 text-sm">
					<p>{m.ch_explorer_needs_token()}</p>
					{canConnect ? (
						<Button size="sm" variant="outline" onClick={onConnect}>
							<LinkIcon aria-hidden />
							{m.ch_connect()}
						</Button>
					) : null}
				</div>
			) : result?.ok ? (
				<ExplorerTable data={result.data} notation={notation} onPlay={onPlay} />
			) : null}
		</div>
	);
}

function LichessFilters({
	query,
	onQueryChange,
}: {
	query: Omit<ExplorerQuery, "fen">;
	onQueryChange: (query: Omit<ExplorerQuery, "fen">) => void;
}) {
	return (
		<div className="flex flex-col gap-2" data-testid="chaal-explorer-filters">
			<ToggleGroup
				type="multiple"
				variant="outline"
				size="sm"
				value={query.speeds ?? []}
				onValueChange={(value) => onQueryChange({ ...query, speeds: value as ExplorerSpeed[] })}
				aria-label={m.ch_explorer_speeds()}
				className="flex w-full flex-wrap"
			>
				{EXPLORER_SPEEDS.map((speed) => (
					<ToggleGroupItem key={speed} value={speed} className="flex-1 text-xs">
						{SPEED_NAMES[speed]()}
					</ToggleGroupItem>
				))}
			</ToggleGroup>
			<ToggleGroup
				type="multiple"
				variant="outline"
				size="sm"
				value={(query.ratings ?? []).map(String)}
				onValueChange={(value) =>
					onQueryChange({ ...query, ratings: value.map(Number).sort((a, b) => a - b) as ExplorerRating[] })
				}
				aria-label={m.ch_explorer_ratings()}
				className="flex w-full flex-wrap"
			>
				{EXPLORER_RATINGS.map((rating) => (
					<ToggleGroupItem key={rating} value={String(rating)} className="flex-1 text-xs tabular-nums">
						{formatNumber(rating, { useGrouping: false })}
					</ToggleGroupItem>
				))}
			</ToggleGroup>
			<p className="text-ch-muted text-xs">{m.ch_explorer_filters_hint()}</p>
		</div>
	);
}

function PlayerFilter({
	query,
	onQueryChange,
	defaultPlayer,
}: {
	query: Omit<ExplorerQuery, "fen">;
	onQueryChange: (query: Omit<ExplorerQuery, "fen">) => void;
	defaultPlayer: string | null;
}) {
	const [name, setName] = useState(query.player ?? defaultPlayer ?? "");
	const id = useId();
	const submit = (event: FormEvent) => {
		event.preventDefault();
		const player = name.trim();
		if (/^[A-Za-z0-9][A-Za-z0-9_-]{1,29}$/.test(player)) onQueryChange({ ...query, player });
	};
	return (
		<form
			method="post"
			onSubmit={submit}
			className="flex flex-wrap items-end gap-2"
			data-testid="chaal-explorer-player-form"
		>
			<div className="flex min-w-40 flex-1 flex-col gap-1">
				<label htmlFor={id} className="text-ch-muted text-xs">
					{m.ch_explorer_player_name()}
				</label>
				<Input
					id={id}
					value={name}
					onChange={(event) => setName(event.target.value)}
					autoComplete="off"
					spellCheck={false}
					maxLength={30}
					className="h-8"
				/>
			</div>
			<ToggleGroup
				type="single"
				variant="outline"
				size="sm"
				value={query.color ?? "white"}
				onValueChange={(value) => {
					if (value) onQueryChange({ ...query, color: value as "white" | "black" });
				}}
				aria-label={m.ch_explorer_player_side()}
			>
				<ToggleGroupItem value="white">{m.ch_white()}</ToggleGroupItem>
				<ToggleGroupItem value="black">{m.ch_black()}</ToggleGroupItem>
			</ToggleGroup>
			<Button type="submit" size="sm" variant="outline">
				{m.ch_explorer_player_show()}
			</Button>
		</form>
	);
}

function ExplorerSkeleton() {
	return (
		<div className="flex flex-col gap-2" aria-busy="true">
			{[0, 1, 2, 3, 4].map((row) => (
				<Skeleton key={row} className="h-6 w-full rounded-none" />
			))}
		</div>
	);
}

/** White · draws · Black as a bar: paper, grey and ink, each part's share written in it when it fits. */
function ResultBar({ white, draws, black }: { white: number; draws: number; black: number }) {
	const total = white + draws + black;
	const parts = [
		{ key: "white", share: percent(white, total), className: "bg-ch-paper text-ch-frame" },
		{ key: "draws", share: percent(draws, total), className: "bg-ch-hair text-ch-ink" },
		{ key: "black", share: percent(black, total), className: "bg-ch-frame text-ch-paper" },
	];
	return (
		<div
			className="flex h-5 w-full overflow-hidden border border-ch-frame text-[0.6875rem] tabular-nums"
			role="img"
			aria-label={m.ch_explorer_results({
				white: formatNumber(parts[0]?.share ?? 0),
				draws: formatNumber(parts[1]?.share ?? 0),
				black: formatNumber(parts[2]?.share ?? 0),
			})}
		>
			{parts.map((part) => (
				<span
					key={part.key}
					className={`flex items-center justify-center overflow-hidden ${part.className}`}
					style={{ width: `${part.share}%` }}
				>
					{part.share >= 12 ? `${formatNumber(part.share)}%` : null}
				</span>
			))}
		</div>
	);
}

function ExplorerTable({
	data,
	notation,
	onPlay,
}: {
	data: ChaalExplorer;
	notation: "figurine" | "letters";
	onPlay: (uci: string) => void;
}) {
	const total = data.white + data.draws + data.black;
	if (total === 0 && data.moves.length === 0) {
		return <p className="py-2 text-ch-muted text-sm">{m.ch_explorer_empty()}</p>;
	}
	return (
		<div className="flex flex-col gap-3">
			{data.indexing ? <p className="text-ch-muted text-xs">{m.ch_explorer_indexing()}</p> : null}
			<table className="w-full text-sm" data-testid="chaal-explorer-moves">
				<thead>
					<tr className="border-ch-ink border-b-2 text-ch-muted text-xs">
						<th scope="col" className="py-1 text-start font-normal">
							{m.ch_explorer_move()}
						</th>
						<th scope="col" className="py-1 text-end font-normal">
							{m.ch_explorer_games()}
						</th>
						<th scope="col" className="w-[45%] py-1 ps-3 text-start font-normal">
							{m.ch_explorer_outcome()}
						</th>
					</tr>
				</thead>
				<tbody>
					{data.moves.map((move) => (
						<tr key={move.uci} className="ch-hairline">
							<td className="py-1">
								<button
									type="button"
									onClick={() => onPlay(move.uci)}
									className="px-1 font-medium outline-none hover:bg-ch-hair focus-visible:ring-2 focus-visible:ring-ch-ink"
									data-testid="chaal-explorer-move"
								>
									{showSan(move.san, notation)}
								</button>
							</td>
							<td className="py-1 text-end tabular-nums">{formatNumber(move.white + move.draws + move.black)}</td>
							<td className="py-1 ps-3">
								<ResultBar white={move.white} draws={move.draws} black={move.black} />
							</td>
						</tr>
					))}
					<tr className="text-ch-muted">
						<td className="py-1 ps-1">Σ</td>
						<td className="py-1 text-end tabular-nums">{formatNumber(total)}</td>
						<td className="py-1 ps-3">
							<ResultBar white={data.white} draws={data.draws} black={data.black} />
						</td>
					</tr>
				</tbody>
			</table>
			{data.games.length > 0 ? (
				<section aria-labelledby="chaal-explorer-games">
					<h3 id="chaal-explorer-games" className="ch-rule pt-1.5 font-semibold text-sm">
						{data.database === "player" ? m.ch_explorer_recent_games() : m.ch_explorer_top_games()}
					</h3>
					<ul className="mt-1 flex flex-col">
						{data.games.map((game) => (
							<li key={game.id} className="ch-hairline">
								<a
									href={`https://lichess.org/${game.id}`}
									target="_blank"
									rel="nofollow ugc noopener noreferrer"
									className="flex items-baseline gap-2 py-1.5 text-sm outline-none hover:bg-ch-hair focus-visible:ring-2 focus-visible:ring-ch-ink"
								>
									<span className="min-w-0 flex-1 truncate">
										{game.white.name}
										{game.white.rating ? <span className="text-ch-muted"> {game.white.rating}</span> : null}
										<span className="text-ch-muted"> – </span>
										{game.black.name}
										{game.black.rating ? <span className="text-ch-muted"> {game.black.rating}</span> : null}
									</span>
									<span className="shrink-0 font-semibold tabular-nums">
										{game.winner === "white" ? "1-0" : game.winner === "black" ? "0-1" : "½-½"}
									</span>
									{game.year ? <span className="shrink-0 text-ch-muted tabular-nums">{game.year}</span> : null}
									<ExternalLinkIcon aria-hidden className="size-3.5 shrink-0 text-ch-muted" />
									<span className="sr-only">{m.ch_opens_lichess()}</span>
								</a>
							</li>
						))}
					</ul>
				</section>
			) : null}
		</div>
	);
}
