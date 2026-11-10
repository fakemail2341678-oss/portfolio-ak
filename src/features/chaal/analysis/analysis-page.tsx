import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import {
	BookOpenIcon,
	EllipsisIcon,
	FilePlusIcon,
	FolderOpenIcon,
	SaveIcon,
	ShareIcon,
	UploadIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { errorMessage } from "@/components/errors/error-page";
import { MAIN_CONTENT } from "@/components/layout/skip-link";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { sessionQueryOptions } from "@/features/auth/queries";
import { isAppError } from "@/lib/errors";
import { formatDate } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import { Board } from "../board/board";
import { EvalBar } from "../board/eval-bar";
import { EvalGraph } from "../board/eval-graph";
import { GameControls, useBoardKeys } from "../board/game-controls";
import { MoveInput } from "../board/move-input";
import { MoveList } from "../board/move-list";
import { OpeningName } from "../board/opening-name";
import type { Shape } from "../board/shapes";
import type { Score } from "../chess/eval";
import { writePgn } from "../chess/pgn";
import { mainline, pathTo } from "../chess/tree";
import { canConnect, useConnectLichess } from "../connect/use-connect";
import { useEnsureChaalSession } from "../connect/use-ensure-session";
import { DEFAULT_ENGINE_LIMITS } from "../engine/limits";
import { useEngine } from "../engine/use-engine";
import { chaalKeys } from "../keys";
import { useFairPlay } from "../live/fair-play";
import { chaalConnectionQueryOptions, chaalStatusQueryOptions } from "../queries";
import type { ChaalOpening } from "../schema";
import { useChaalPreferences } from "../settings/use-preferences";
import { SaveToStudyDialog } from "../studies/save-dialog";
import { ExportDialog, ImportDialog, SaveDialog } from "./analysis-dialogs";
import { EnginePanel, type ShownLine } from "./engine-panel";
import { ExplorerPanel } from "./explorer-panel";
import { MyAnalyses } from "./my-analyses";
import { NodeTools } from "./node-tools";
import {
	analysisQueryOptions,
	cloudEvalQueryOptions,
	type ExplorerQuery,
	explorerQueryOptions,
	importLichessGame,
	saveAnalysisMutationOptions,
	tablebaseQueryOptions,
} from "./queries";
import type { ChaalAnalysis } from "./schema";
import { TablebasePanel } from "./tablebase-panel";
import { searchFromTree, shareUrl } from "./url";
import { type AnalysisBoard, useAnalysisBoard } from "./use-analysis";

const route = getRouteApi("/_chaal/app/chaal/analysis");

/** Lichess's cloud evaluates the opening and early middlegame: positions deeper than this aren't asked about. */
const CLOUD_EVAL_MAX_PLY = 40;
/** The explorer is read for the opening's name this deep even when its tab is closed. */
const OPENING_MAX_PLY = 30;
const TABLEBASE_PIECES = 7;

const pieceCount = (fen: string) => (fen.split(" ")[0]?.match(/[prnbqk]/gi) ?? []).length;

type Tab = "moves" | "explorer" | "tablebase";

/**
 * /app/chaal/analysis (PLAN Task 75; the comps): the board first, with the evaluation beside
 * it (above it on a phone), Stockfish's lines (Lichess's cloud first when it has the
 * position), the moves as a tree to annotate, the opening explorer and the tablebase.
 * Import, export, saving and "My analyses" are in the board's menu.
 */
export function ChaalAnalysisPage() {
	const search = route.useSearch();
	const { data: session } = useQuery(sessionQueryOptions());
	const saved = useQuery({
		...analysisQueryOptions(search.id ?? ""),
		enabled: Boolean(search.id && session),
	});
	const missing = Boolean(search.id) && !saved.data && (!session || saved.isError);
	// The loader read a saved analysis the URL names; the board starts from it (later ones open with `load`).
	return <AnalysisBoardPage saved={saved.data ?? null} missing={missing} signedIn={Boolean(session)} />;
}

function AnalysisBoardPage({
	saved,
	missing,
	signedIn,
}: {
	saved: ChaalAnalysis | null;
	missing: boolean;
	signedIn: boolean;
}) {
	const queryClient = useQueryClient();
	const board = useAnalysisBoard(saved);
	const { node, tree } = board;
	const fen = node.fen;
	const { preferences } = useChaalPreferences();
	const notation = preferences.notation;
	const { data: status } = useQuery(chaalStatusQueryOptions());
	const { data: connection } = useQuery({ ...chaalConnectionQueryOptions(), enabled: signedIn });
	const fairPlay = useFairPlay();
	const locked = fairPlay.locked;
	const features = status?.features;
	const engineAllowed = features?.engine !== false;
	const explorerAllowed = features?.explorer !== false;
	const limits = status?.engine ?? DEFAULT_ENGINE_LIMITS;
	const [tab, setTab] = useState<Tab>("moves");
	const [dialog, setDialog] = useState<"import" | "export" | "save" | "analyses" | "study" | null>(null);
	const { connect } = useConnectLichess();
	const ensureSession = useEnsureChaalSession();
	const save = useMutation(saveAnalysisMutationOptions());

	// Lichess's cloud first, when it has the position (the engine waits for its answer).
	const [engineWanted, setEngineWanted] = useState(false);
	const cloudAsked = engineAllowed && engineWanted && !locked && node.ply <= CLOUD_EVAL_MAX_PLY;
	const cloud = useQuery({ ...cloudEvalQueryOptions(fen, limits.multiPv), enabled: cloudAsked });
	const cloudLines = cloudAsked && cloud.data ? cloud.data.lines : null;
	const engine = useEngine({
		fen,
		limits,
		// Held back while fair play locks it (it resumes after the game), or while the cloud answers.
		skip: locked || (cloudAsked && (cloud.isPending || cloudLines !== null)),
	});

	const lines: ShownLine[] = cloudLines ?? engine.lines.map((line) => ({ score: line.score, moves: line.pv }));
	const source = cloudLines ? "cloud" : engine.lines.length > 0 ? "local" : null;
	const depth = cloudLines ? (cloud.data?.depth ?? 0) : engine.depth;
	const engineScore: Score | null = engine.status !== "off" && lines[0] ? lines[0].score : null;
	// The cloud's lines show while the engine still downloads.
	const panelStatus = engine.status === "off" ? "off" : cloudLines ? "done" : engine.status;

	// Scores seen this visit, by position: the graph's line where the tree has none.
	const [seen, setSeen] = useState<Record<string, Score>>({});
	useEffect(() => {
		const settled = engine.settled;
		if (settled) setSeen((previous) => ({ ...previous, [settled.fen]: settled.score }));
	}, [engine.settled]);
	useEffect(() => {
		const best = cloud.data?.lines[0];
		if (best && cloudAsked) setSeen((previous) => ({ ...previous, [fen]: best.score }));
	}, [cloud.data, cloudAsked, fen]);

	// The explorer: masters by default, read for the opening's name in the opening even when its tab is closed.
	const [explorer, setExplorer] = useState<Omit<ExplorerQuery, "fen">>({ database: "masters", color: "white" });
	const explorerQuery: ExplorerQuery = { ...explorer, fen };
	const explorerAsked =
		explorerAllowed &&
		!locked &&
		(tab === "explorer" || node.ply <= OPENING_MAX_PLY) &&
		(explorer.database !== "player" || Boolean(explorer.player));
	const explored = useQuery({ ...explorerQueryOptions(explorerQuery), enabled: explorerAsked });
	const [openings, setOpenings] = useState<Record<string, ChaalOpening>>({});
	useEffect(() => {
		const opening = explored.data?.ok ? explored.data.data.opening : null;
		if (opening) setOpenings((previous) => ({ ...previous, [fen]: opening }));
	}, [explored.data, fen]);
	const opening =
		pathTo(tree, node.id)
			.reverse()
			.map((step) => openings[step.fen])
			.find(Boolean) ?? null;

	const pieces = pieceCount(fen);
	const tablebaseAsked = explorerAllowed && !locked && tab === "tablebase" && pieces <= TABLEBASE_PIECES;
	const tablebase = useQuery({ ...tablebaseQueryOptions(fen), enabled: tablebaseAsked });

	// The board's shapes: the position's own, and the engine's best move in vermilion.
	const best = lines[0]?.moves[0];
	const bestArrow: Shape | null =
		engine.status !== "off" && !locked && best
			? ({ from: best.slice(0, 2), to: best.slice(2, 4), brush: "mark" } as Shape)
			: null;
	const shapes: Shape[] = [...(node.shapes ?? []), ...(bestArrow ? [bestArrow] : [])];

	const line = mainline(tree);
	const mainIndex = line.findIndex((step) => step.id === node.id);
	const scores = line.map((step) => step.eval ?? seen[step.fen] ?? null);

	useBoardKeys({ onStep: board.step, onFlip: board.flip });

	const search = searchFromTree(tree, node.id, board.orientation);
	const link = typeof window === "undefined" ? "" : shareUrl(window.location.origin, window.location.pathname, search);
	const pgn = writePgn({ tags: { Event: "?", ...board.tags }, tree, result: resultOf(board.tags) });
	const title = defaultTitle(board, opening);

	const persist = async (name: string) => {
		if (!(await ensureSession())) return;
		try {
			const result = await save.mutateAsync({
				...(board.saved ? { id: board.saved.id } : {}),
				title: name,
				tree,
				tags: board.tags,
				orientation: board.orientation,
			});
			board.markSaved({ id: result.id, title: result.title });
			// The URL names it now: its read is this board, so nothing is fetched again.
			queryClient.setQueryData(analysisQueryOptions(result.id).queryKey, {
				id: result.id,
				title: result.title,
				tree,
				tags: board.tags,
				orientation: board.orientation,
				updatedAt: result.updatedAt,
			});
			await queryClient.invalidateQueries({ queryKey: chaalKeys.analyses(), exact: true });
			setDialog(null);
			toast.success(m.ch_save_done({ title: result.title }));
		} catch (failure) {
			toast.error(isAppError(failure) && failure.code === "CONFLICT" ? m.ch_save_full() : errorMessage(failure));
		}
	};
	const onSave = () => {
		if (board.saved) void persist(board.saved.title);
		else setDialog("save");
	};

	const deleteMove = (id: string) => {
		const before = { tree: board.tree, current: board.node.id };
		board.remove(id);
		toast(m.ch_tools_deleted(), {
			action: { label: m.ch_undo(), onClick: () => board.restore(before.tree, before.current) },
		});
	};

	const statusLine = board.saved
		? board.dirty
			? m.ch_analysis_unsaved_changes({ title: board.saved.title })
			: m.ch_analysis_saved_as({ title: board.saved.title })
		: null;

	return (
		<main {...MAIN_CONTENT} className="flex flex-1 flex-col outline-none" data-testid="chaal-analysis">
			<h1 className="sr-only">{m.ch_analysis_title()}</h1>
			{missing ? (
				<p className="ch-hairline mx-auto w-full max-w-7xl px-4 py-2 text-sm sm:px-6 lg:px-8">
					{m.ch_analysis_missing()}
				</p>
			) : null}
			<div className="mx-auto grid w-full max-w-7xl gap-x-8 gap-y-3 pb-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,26rem)] lg:px-8 lg:pt-6">
				<div className="flex min-w-0 flex-col gap-2 lg:items-end">
					{engineAllowed ? (
						<EvalBar
							score={engineScore ?? node.eval ?? null}
							orientation={board.orientation}
							direction="horizontal"
							className="lg:hidden"
						/>
					) : null}
					<div className="flex w-full items-stretch justify-end gap-3">
						{engineAllowed ? (
							<EvalBar
								score={engineScore ?? node.eval ?? null}
								orientation={board.orientation}
								className="max-lg:hidden"
							/>
						) : null}
						<div className="w-full lg:max-w-[calc(100dvh-10.5rem)]" data-testid="chaal-analysis-board">
							<Board
								fen={fen}
								orientation={board.orientation}
								movable="both"
								lastMove={node.uci ? { uci: node.uci, san: node.san ?? undefined } : null}
								onMove={board.play}
								shapes={shapes}
								onShapesChange={(next) =>
									board.setShapes(next.filter((shape) => !(bestArrow && sameShape(shape, bestArrow))))
								}
								autoQueen={preferences.autoQueen}
								coordinates={preferences.coordinates}
								theme={preferences.board}
								pieces={preferences.pieces}
								sound={preferences.sounds ? preferences.volume : false}
								label={m.ch_analysis_board_label()}
							/>
						</div>
					</div>
					<div className="flex w-full flex-col gap-2 px-4 sm:px-0 lg:max-w-[calc(100dvh-10.5rem+2rem)]">
						<GameControls
							onStep={board.step}
							canBack={Boolean(node.parent)}
							canForward={node.children.length > 0}
							onFlip={board.flip}
						>
							<BoardMenu
								onSave={onSave}
								saving={save.isPending}
								saved={Boolean(board.saved) && !board.dirty}
								onImport={() => setDialog("import")}
								onExport={() => setDialog("export")}
								onAnalyses={() => setDialog("analyses")}
								onStudy={
									status?.features.studies !== false && status?.community.saveToStudy !== false
										? () => setDialog("study")
										: undefined
								}
								onNew={() => board.reset()}
							/>
						</GameControls>
						{/* Typed moves for keyboards; a phone's board is its input, so the engine sits under the controls there. */}
						<div className="max-sm:hidden">
							<MoveInput fen={fen} onMove={board.play} notation={notation} />
						</div>
						{statusLine ? (
							<p className="text-ch-muted text-xs" data-testid="chaal-analysis-status">
								{statusLine}
							</p>
						) : null}
					</div>
				</div>

				<div className="flex min-w-0 flex-col gap-3 px-4 sm:px-0">
					<OpeningName opening={opening} pending={explorerAsked && explored.isPending && !opening} />
					{engineAllowed ? (
						<EnginePanel
							fen={fen}
							status={panelStatus}
							progress={engine.progress}
							lines={lines}
							depth={depth}
							source={source}
							locked={locked}
							notation={notation}
							onToggle={(on) => {
								setEngineWanted(on);
								if (on) engine.start();
								else engine.stop();
							}}
							onPlayLine={board.playLine}
						/>
					) : null}
					<Tabs value={tab} onValueChange={(value) => setTab(value as Tab)} className="gap-0">
						<TabsList variant="line" className="ch-rule w-full justify-start rounded-none pt-1">
							<TabsTrigger value="moves" data-testid="chaal-tab-moves">
								{m.ch_analysis_tab_moves()}
							</TabsTrigger>
							{explorerAllowed ? (
								<>
									<TabsTrigger value="explorer" data-testid="chaal-tab-explorer">
										{m.ch_analysis_tab_explorer()}
									</TabsTrigger>
									<TabsTrigger value="tablebase" data-testid="chaal-tab-tablebase">
										{m.ch_analysis_tab_tablebase()}
									</TabsTrigger>
								</>
							) : null}
						</TabsList>
						<TabsContent value="moves" className="flex flex-col gap-3 pt-2">
							<MoveList
								tree={tree}
								current={node.id}
								onSelect={board.select}
								layout="tree"
								notation={notation}
								className="max-h-[22rem]"
							/>
							<NodeTools
								key={node.id}
								tree={tree}
								node={node}
								notation={notation}
								onToggleNag={(nag) => board.toggleNag(node.id, nag)}
								onComment={(text) => board.setComment(node.id, text)}
								onPromote={() => board.promote(node.id)}
								onMakeMain={() => board.makeMain(node.id)}
								onDelete={() => deleteMove(node.id)}
							/>
							<EvalGraph
								scores={scores}
								current={mainIndex}
								onSelect={(index) => board.select(index < 0 ? tree.root : (line[index]?.id ?? tree.root))}
							/>
						</TabsContent>
						{explorerAllowed ? (
							<>
								<TabsContent value="explorer">
									<ExplorerPanel
										query={explorer}
										onQueryChange={setExplorer}
										result={explored.data}
										pending={explorerAsked && explored.isPending}
										error={explored.error}
										notation={notation}
										locked={locked}
										canConnect={canConnect(status)}
										onConnect={() => void connect()}
										onPlay={(uci) => board.playLine([uci])}
										defaultPlayer={connection?.username ?? null}
									/>
								</TabsContent>
								<TabsContent value="tablebase">
									<TablebasePanel
										result={tablebase.data}
										pending={tablebaseAsked && tablebase.isPending}
										error={tablebase.error}
										tooMany={pieces > TABLEBASE_PIECES}
										notation={notation}
										locked={locked}
										onPlay={(uci) => board.playLine([uci])}
									/>
								</TabsContent>
							</>
						) : null}
					</Tabs>
				</div>
			</div>

			<ImportDialog
				open={dialog === "import"}
				onOpenChange={(open) => setDialog(open ? "import" : null)}
				onLoad={board.load}
				onPosition={(position) => board.reset(position)}
				fetchLichessGame={importLichessGame}
			/>
			<ExportDialog
				open={dialog === "export"}
				onOpenChange={(open) => setDialog(open ? "export" : null)}
				pgn={pgn}
				fen={fen}
				link={link}
				fileName={`${fileNameOf(title)}.pgn`}
			/>
			<SaveDialog
				open={dialog === "save"}
				onOpenChange={(open) => setDialog(open ? "save" : null)}
				defaultTitle={title}
				onSave={(name) => void persist(name)}
				pending={save.isPending}
			/>
			<SaveToStudyDialog
				open={dialog === "study"}
				onOpenChange={(open) => setDialog(open ? "study" : null)}
				pgn={pgn}
				orientation={board.orientation}
				defaultName={title}
			/>
			<MyAnalyses
				open={dialog === "analyses"}
				onOpenChange={(open) => setDialog(open ? "analyses" : null)}
				signedIn={signedIn}
				currentId={board.saved?.id ?? null}
				onOpen={(id) => {
					setDialog(null);
					void openSaved(id);
				}}
				onDeleted={() => board.forget()}
			/>
		</main>
	);

	async function openSaved(id: string) {
		try {
			const analysis = await queryClient.fetchQuery(analysisQueryOptions(id));
			board.load({
				tree: analysis.tree,
				tags: analysis.tags,
				orientation: analysis.orientation,
				saved: { id: analysis.id, title: analysis.title },
			});
		} catch (failure) {
			toast.error(errorMessage(failure));
		}
	}
}

/** The board's menu: Save stays in reach; the rest behind "More". */
function BoardMenu({
	onSave,
	saving,
	saved,
	onImport,
	onExport,
	onAnalyses,
	onStudy,
	onNew,
}: {
	onSave: () => void;
	saving: boolean;
	saved: boolean;
	onImport: () => void;
	onExport: () => void;
	onAnalyses: () => void;
	/** "Save to study" (Task 83), when studies and saving are on. */
	onStudy?: () => void;
	onNew: () => void;
}) {
	return (
		<>
			<Button
				type="button"
				variant="ghost"
				size="sm"
				onClick={onSave}
				disabled={saving}
				className="ch-press"
				data-testid="chaal-save"
			>
				<SaveIcon aria-hidden />
				{saved ? m.ch_save_saved() : m.ch_save()}
			</Button>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button
						type="button"
						variant="ghost"
						size="icon"
						aria-label={m.ch_analysis_menu()}
						className="ch-press"
						data-testid="chaal-analysis-menu"
					>
						<EllipsisIcon aria-hidden />
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end">
					<DropdownMenuItem onSelect={onImport} data-testid="chaal-import">
						<UploadIcon aria-hidden />
						{m.ch_import_title()}
					</DropdownMenuItem>
					<DropdownMenuItem onSelect={onExport} data-testid="chaal-export-open">
						<ShareIcon aria-hidden />
						{m.ch_export_title()}
					</DropdownMenuItem>
					<DropdownMenuItem onSelect={onAnalyses} data-testid="chaal-analyses-open">
						<FolderOpenIcon aria-hidden />
						{m.ch_analyses_title()}
					</DropdownMenuItem>
					{onStudy ? (
						<DropdownMenuItem onSelect={onStudy} data-testid="chaal-save-study-open">
							<BookOpenIcon aria-hidden />
							{m.ch_study_save_title()}
						</DropdownMenuItem>
					) : null}
					<DropdownMenuSeparator />
					<DropdownMenuItem onSelect={onNew} data-testid="chaal-new-board">
						<FilePlusIcon aria-hidden />
						{m.ch_analysis_new()}
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
		</>
	);
}

const sameShape = (a: Shape, b: Shape) => a.from === b.from && a.to === b.to && a.brush === b.brush;

const resultOf = (tags: Record<string, string>) => {
	const result = tags.Result;
	return result === "1-0" || result === "0-1" || result === "1/2-1/2" ? result : "*";
};

/** A saved analysis's first name: its players, else its opening, else the date. */
function defaultTitle(board: AnalysisBoard, opening: ChaalOpening | null): string {
	if (board.saved) return board.saved.title;
	const { White: white, Black: black } = board.tags;
	if (white && black && white !== "?" && black !== "?") return `${white} – ${black}`;
	if (opening) return opening.name;
	return m.ch_analysis_default_title({ date: formatDate(new Date()) });
}

const fileNameOf = (title: string) =>
	title
		.normalize("NFKD")
		.replace(/[^\w\s-]/g, "")
		.trim()
		.replace(/\s+/g, "-")
		.slice(0, 60) || "chaal-analysis";
