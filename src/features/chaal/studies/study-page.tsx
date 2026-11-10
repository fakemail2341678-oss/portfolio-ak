import { useQuery } from "@tanstack/react-query";
import { getRouteApi, Link } from "@tanstack/react-router";
import { ChartSplineIcon, ExternalLinkIcon } from "lucide-react";
import { useState } from "react";
import { CopyButton } from "@/components/data-display/copy-button";
import { MAIN_CONTENT } from "@/components/layout/skip-link";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { m } from "@/paraglide/messages";
import { Board } from "../board/board";
import { GameControls, type Step, useBoardKeys } from "../board/game-controls";
import { MoveList } from "../board/move-list";
import { readPgn } from "../chess/pgn";
import { START_FEN } from "../chess/rules";
import { type GameTree, pathTo, stepFrom } from "../chess/tree";
import { CommunityOff, ListWaiting, useAreaOn } from "../community/header";
import { chaalLinks } from "../links";
import { useChaalPreferences } from "../settings/use-preferences";
import { chapterShown, studyChapterQueryOptions, studyQueryOptions } from "./queries";
import type { ChaalStudy, StudyChapterSummary } from "./schema";

const route = getRouteApi("/_chaal/app/chaal/studies/$id");

/**
 * /app/chaal/studies/$id (Task 83, decision 0273; noindex: people's work): a study's chapters
 * and the one shown (`?chapter=`, else the first) in the analysis viewer: its board with
 * the author's arrows and circles, its moves with their variations and comments (as text),
 * stepping with the keys as on every board, and "Analyse" to take the line to the
 * analysis board.
 */
export function ChaalStudyPage() {
	const { id } = route.useParams();
	const search = route.useSearch();
	const on = useAreaOn("studies");
	const read = useQuery(studyQueryOptions(id));
	return (
		<main {...MAIN_CONTENT} className="flex flex-1 flex-col outline-none" data-testid="chaal-study">
			<div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pt-8 pb-16 sm:px-6 lg:px-8 lg:pt-12">
				<Link {...chaalLinks.studies()} className="text-ch-muted text-sm hover:text-ch-ink">
					{m.ch_study_back()}
				</Link>
				{!on ? (
					<CommunityOff area="studies" />
				) : read.data ? (
					<StudyView study={read.data} chapter={chapterShown(read.data, search)} />
				) : (
					<ListWaiting
						error={read.isError ? read.error : null}
						retry={() => void read.refetch()}
						testId="chaal-study-error"
					/>
				)}
			</div>
		</main>
	);
}

function StudyView({ study, chapter }: { study: ChaalStudy; chapter: string | null }) {
	const shown = study.chapters.find((each) => each.id === chapter) ?? null;
	return (
		<div className="flex flex-col gap-6">
			<header className="flex flex-col gap-2">
				<h1 className="ch-display text-ch-title" data-testid="chaal-study-name">
					{study.name}
				</h1>
				<p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-ch-muted text-sm">
					<span>{m.ch_study_chapters_count({ count: String(study.chapters.length) })}</span>
					<a
						href={shown ? `${study.url}/${shown.id}` : study.url}
						rel="noopener"
						target="_blank"
						className="inline-flex items-center gap-1 hover:text-ch-ink"
					>
						<ExternalLinkIcon aria-hidden className="size-3.5" />
						{m.ch_community_on_lichess()}
					</a>
				</p>
			</header>
			<div className="grid gap-x-10 gap-y-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
				<nav aria-label={m.ch_study_chapters()} className="lg:order-first">
					<h2 className="ch-rule pt-3 pb-1 font-semibold text-sm">{m.ch_study_chapters()}</h2>
					<ol
						className="flex max-h-[24rem] flex-col overflow-y-auto lg:max-h-[70dvh]"
						data-testid="chaal-study-chapters"
					>
						{study.chapters.map((each, index) => (
							<li key={each.id}>
								<Link
									{...chaalLinks.study(study.id, index === 0 ? {} : { chapter: each.id })}
									replace
									aria-current={each.id === chapter ? "page" : undefined}
									className="flex gap-2 border-ch-hair border-t px-1 py-2 text-sm hover:bg-ch-plate aria-[current=page]:font-semibold aria-[current=page]:shadow-[inset_2px_0_0_var(--ch-ink)]"
									data-testid="chaal-study-chapter"
								>
									<span className="ch-figures w-6 shrink-0 text-ch-muted">{index + 1}</span>
									<span className="min-w-0 break-words">{each.name}</span>
								</Link>
							</li>
						))}
					</ol>
				</nav>
				{shown ? <ChapterPlace study={study.id} chapter={shown} /> : null}
			</div>
		</div>
	);
}

/** The chapter's place: as tall as the viewer while its PGN arrives, so nothing moves. */
function ChapterPlace({ study, chapter }: { study: string; chapter: StudyChapterSummary }) {
	const read = useQuery(studyChapterQueryOptions(study, chapter.id));
	if (!read.data)
		return read.isError ? (
			<ListWaiting error={read.error} retry={() => void read.refetch()} testId="chaal-study-chapter-error" />
		) : (
			<Skeleton className="aspect-square w-full max-w-[36rem] rounded-none" />
		);
	return <ChapterViewer key={chapter.id} chapter={chapter} pgn={read.data.pgn} />;
}

/** The PGN read into a tree, or null when it isn't one Chaal can read (a variant's). */
function treeOf(pgn: string): GameTree | null {
	const read = readPgn(pgn);
	return read.ok ? read.game.tree : null;
}

export function ChapterViewer({ chapter, pgn }: { chapter: StudyChapterSummary; pgn: string }) {
	const { preferences } = useChaalPreferences();
	const [tree] = useState(() => treeOf(pgn));
	const [current, setCurrent] = useState(() => tree?.root ?? "");
	const [flipped, setFlipped] = useState(false);
	const step = (to: Step) => {
		if (tree) setCurrent((id) => stepFrom(tree, id, to));
	};
	useBoardKeys({ onStep: step, onFlip: () => setFlipped((value) => !value), enabled: Boolean(tree) });
	if (!tree)
		return (
			<p className="text-ch-muted text-sm" data-testid="chaal-study-unreadable">
				{m.ch_study_unreadable()}
			</p>
		);
	const node = tree.nodes[current] ?? tree.nodes[tree.root];
	if (!node) return null;
	const orientation = flipped ? (chapter.orientation === "white" ? "black" : "white") : chapter.orientation;
	const root = tree.nodes[tree.root];
	const line = pathTo(tree, node.id).slice(1);
	const startFen = root?.fen ?? START_FEN;
	return (
		<div className="grid gap-x-8 gap-y-4 xl:grid-cols-[minmax(0,36rem)_minmax(0,1fr)]" data-testid="chaal-study-viewer">
			<div className="flex flex-col gap-2">
				<p className="font-semibold" data-testid="chaal-study-chapter-name">
					{chapter.name}
				</p>
				{chapter.white || chapter.black ? (
					<p className="text-ch-muted text-sm">
						{chapter.white ?? "?"} – {chapter.black ?? "?"}
						{chapter.result ? ` · ${chapter.result}` : ""}
					</p>
				) : null}
				<div className="w-full" data-testid="chaal-study-board">
					<Board
						fen={node.fen}
						orientation={orientation}
						movable="none"
						lastMove={node.uci ? { uci: node.uci, san: node.san ?? undefined } : null}
						shapes={node.shapes ?? []}
						coordinates={preferences.coordinates}
						theme={preferences.board}
						pieces={preferences.pieces}
						sound={preferences.sounds ? preferences.volume : false}
						label={m.ch_study_board_label({ name: chapter.name })}
					/>
				</div>
				<GameControls
					onStep={step}
					canBack={Boolean(node.parent)}
					canForward={node.children.length > 0}
					onFlip={() => setFlipped((value) => !value)}
				/>
			</div>
			<div className="flex min-w-0 flex-col gap-3">
				{chapter.gamebook ? <p className="text-ch-muted text-xs">{m.ch_study_gamebook()}</p> : null}
				<div aria-live="polite" className="min-h-[3rem] text-sm" data-testid="chaal-study-comment">
					{node.comments.map((comment) => (
						<p key={comment} className="whitespace-pre-line break-words">
							{comment}
						</p>
					))}
				</div>
				<MoveList
					tree={tree}
					current={node.id}
					onSelect={setCurrent}
					layout="tree"
					notation={preferences.notation}
					className="max-h-[28rem]"
				/>
				<div className="flex flex-wrap gap-2">
					<Button asChild size="sm">
						<Link
							{...chaalLinks.analysis({
								...(startFen === START_FEN ? {} : { fen: startFen }),
								...(line.length > 0 ? { moves: line.map((step) => step.uci).join("_") } : {}),
							})}
							data-testid="chaal-study-analyse"
						>
							<ChartSplineIcon aria-hidden />
							{m.ch_study_analyse()}
						</Link>
					</Button>
					<CopyButton value={pgn} label={m.ch_export_copy_pgn()} showLabel />
				</div>
			</div>
		</div>
	);
}
