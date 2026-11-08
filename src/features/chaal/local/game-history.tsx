import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { CpuIcon, Trash2Icon, UsersIcon } from "lucide-react";
import { toast } from "sonner";
import { useConfirm } from "@/components/dialogs/confirm";
import { errorMessage } from "@/components/errors/error-page";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate, formatNumber } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import { sideName } from "../chess/speech";
import { chaalKeys } from "../keys";
import { chaalLinks } from "../links";
import { deleteBrowserGames, movesInPgn } from "./browser";
import { clockLabel, opponentOf } from "./labels";
import { localGamesQueryOptions } from "./queries";
import { type LocalGameSummary, summaryOfRecord } from "./schema";
import { useBrowserGames, useHydrated } from "./use-local-games";

const SCORES = { "1-0": "1–0", "0-1": "0–1", "1/2-1/2": "½–½" } as const;

/**
 * The games played here (PLAN Task 76, "a history list"): the account's with a session
 * (the hub's loader read them), else this browser's (after hydration), the most recently
 * played first. A row opens the game (to go on with it, or to look back and analyse it);
 * its bin deletes it.
 */
export function GameHistory({ signedIn }: { signedIn: boolean }) {
	const queryClient = useQueryClient();
	const confirm = useConfirm();
	const account = useQuery({ ...localGamesQueryOptions(), enabled: signedIn });
	const browser = useBrowserGames();
	const hydrated = useHydrated();
	const games: LocalGameSummary[] | undefined = signedIn
		? account.data
		: browser.map((record) => summaryOfRecord(record, movesInPgn(record.pgn)));
	const pending = signedIn ? account.isPending : !hydrated;

	const onDelete = async (game: LocalGameSummary) => {
		const name = opponentOf(game);
		const sure = await confirm({
			title: m.ch_history_delete_title(),
			description: m.ch_history_delete_description({ name, date: formatDate(game.updatedAt) }),
			confirmLabel: m.ch_history_delete(),
			destructive: true,
		});
		if (!sure) return;
		try {
			if (signedIn) {
				const { deleteLocalGameOnAccount } = await import("./queries");
				await deleteLocalGameOnAccount(game.id);
				await queryClient.invalidateQueries({ queryKey: chaalKeys.localGames() });
			} else deleteBrowserGames([game.id]);
			toast.success(m.ch_history_deleted());
		} catch (failure) {
			toast.error(errorMessage(failure));
		}
	};

	return (
		<section
			className="ch-rule flex flex-col gap-2 pt-4"
			aria-labelledby="chaal-history-title"
			data-testid="chaal-history"
		>
			<div className="flex flex-wrap items-baseline justify-between gap-2">
				<h2 id="chaal-history-title" className="ch-display text-ch-head">
					{m.ch_history_title()}
				</h2>
				<p className="text-ch-muted text-xs">{signedIn ? m.ch_history_where_account() : m.ch_history_where_device()}</p>
			</div>
			{pending ? (
				<div className="flex flex-col" aria-busy="true">
					{[0, 1, 2].map((row) => (
						<Skeleton key={row} className="ch-hairline h-15 w-full rounded-none" />
					))}
				</div>
			) : account.error && signedIn ? (
				<p className="py-4 text-sm" role="alert">
					{errorMessage(account.error)}
				</p>
			) : games && games.length > 0 ? (
				<ul className="flex flex-col">
					{games.map((game) => (
						<HistoryRow key={game.id} game={game} onDelete={() => void onDelete(game)} />
					))}
				</ul>
			) : (
				<p className="py-4 text-ch-muted text-sm" data-testid="chaal-history-empty">
					{m.ch_history_empty()}
				</p>
			)}
		</section>
	);
}

function HistoryRow({ game, onDelete }: { game: LocalGameSummary; onDelete: () => void }) {
	const Icon = game.mode === "engine" ? CpuIcon : UsersIcon;
	const name = opponentOf(game);
	const details = [
		game.mode === "engine" && game.color ? m.ch_history_you_played({ side: sideName(game.color) }) : null,
		clockLabel(game.clock),
		m.ch_history_moves({ count: formatNumber(Math.ceil(game.moves / 2)) }),
		formatDate(game.updatedAt),
	].filter(Boolean);
	return (
		<li className="ch-hairline flex items-center gap-2" data-testid="chaal-history-row" data-status={game.status}>
			<Link
				{...chaalLinks.local(game.id)}
				className="flex min-w-0 flex-1 items-center gap-3 px-1 py-2.5 outline-none hover:bg-ch-hair focus-visible:ring-[3px] focus-visible:ring-ring/50"
			>
				<Icon aria-hidden className="size-5 shrink-0 text-ch-muted" />
				<span className="flex min-w-0 flex-1 flex-col gap-0.5">
					<span className="truncate font-semibold">{name}</span>
					<span className="truncate text-ch-muted text-xs">{details.join(" · ")}</span>
				</span>
				{game.result ? (
					<span className="ch-display ch-figures shrink-0 text-lg">
						<span aria-hidden="true">{SCORES[game.result]}</span>
						<span className="sr-only">{resultWords(game.result)}</span>
					</span>
				) : (
					<span className="shrink-0 border border-ch-ink px-2 py-0.5 font-medium text-xs">{m.ch_history_resume()}</span>
				)}
			</Link>
			<Button
				type="button"
				variant="ghost"
				size="icon-sm"
				onClick={onDelete}
				aria-label={m.ch_history_delete_named({ name, date: formatDate(game.updatedAt) })}
				title={m.ch_history_delete()}
			>
				<Trash2Icon aria-hidden />
			</Button>
		</li>
	);
}

const resultWords = (result: keyof typeof SCORES) =>
	result === "1-0" ? m.ch_result_white() : result === "0-1" ? m.ch_result_black() : m.ch_result_draw();
