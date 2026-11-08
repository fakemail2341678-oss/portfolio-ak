import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FolderOpenIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useConfirm } from "@/components/dialogs/confirm";
import { errorMessage } from "@/components/errors/error-page";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate, formatNumber } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import { chaalKeys } from "../keys";
import { analysesQueryOptions, deleteAnalysisMutationOptions } from "./queries";

/**
 * "My analyses" (PLAN Task 75, `ch_analysis`): the saved boards, newest first, to open or
 * delete. A visitor sees how to start (save one); nothing is asked of the server without
 * a session.
 */
export function MyAnalyses({
	open,
	onOpenChange,
	signedIn,
	currentId,
	onOpen,
	onDeleted,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	signedIn: boolean;
	currentId: string | null;
	onOpen: (id: string) => void;
	/** The analysis shown was deleted: the board stays, unsaved. */
	onDeleted: (id: string) => void;
}) {
	const queryClient = useQueryClient();
	const confirm = useConfirm();
	const { data, isPending, error } = useQuery({ ...analysesQueryOptions(), enabled: open && signedIn });
	const remove = useMutation(deleteAnalysisMutationOptions());
	const [deleting, setDeleting] = useState<string | null>(null);

	const onDelete = async (id: string, title: string) => {
		const sure = await confirm({
			title: m.ch_analyses_delete_title(),
			description: m.ch_analyses_delete_description({ title }),
			confirmLabel: m.ch_analyses_delete(),
			destructive: true,
		});
		if (!sure) return;
		setDeleting(id);
		try {
			await remove.mutateAsync(id);
			await queryClient.invalidateQueries({ queryKey: chaalKeys.analyses() });
			if (id === currentId) onDeleted(id);
			toast.success(m.ch_analyses_deleted());
		} catch (failure) {
			toast.error(errorMessage(failure));
		} finally {
			setDeleting(null);
		}
	};

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent side="right" className="w-full gap-0 sm:max-w-md" data-testid="chaal-analyses">
				<SheetHeader>
					<SheetTitle className="ch-display text-ch-head">{m.ch_analyses_title()}</SheetTitle>
					<SheetDescription>{m.ch_analyses_description()}</SheetDescription>
				</SheetHeader>
				<div className="flex-1 overflow-y-auto px-4 pb-6">
					{!signedIn ? (
						<p className="py-4 text-ch-muted text-sm">{m.ch_analyses_none_yet()}</p>
					) : isPending ? (
						<div className="flex flex-col gap-2 py-2" aria-busy="true">
							{[0, 1, 2].map((row) => (
								<Skeleton key={row} className="h-14 w-full rounded-none" />
							))}
						</div>
					) : error ? (
						<p className="py-4 text-sm" role="alert">
							{errorMessage(error)}
						</p>
					) : data && data.length > 0 ? (
						<ul className="flex flex-col">
							{data.map((analysis) => (
								<li key={analysis.id} className="ch-hairline flex items-center gap-2 py-2">
									<button
										type="button"
										onClick={() => onOpen(analysis.id)}
										aria-current={analysis.id === currentId ? "true" : undefined}
										className="flex min-w-0 flex-1 flex-col items-start gap-0.5 px-1 py-1 text-start outline-none hover:bg-ch-hair focus-visible:ring-2 focus-visible:ring-ch-ink aria-[current=true]:font-semibold"
										data-testid="chaal-analysis-open"
									>
										<span className="flex w-full items-center gap-2 truncate">
											<FolderOpenIcon aria-hidden className="size-4 shrink-0 text-ch-muted" />
											<span className="truncate">{analysis.title}</span>
										</span>
										<span className="truncate text-ch-muted text-xs">
											{[
												analysis.white && analysis.black ? `${analysis.white} – ${analysis.black}` : null,
												m.ch_analyses_moves({ count: formatNumber(analysis.moves) }),
												formatDate(analysis.updatedAt),
											]
												.filter(Boolean)
												.join(" · ")}
										</span>
									</button>
									<Button
										type="button"
										variant="ghost"
										size="icon-sm"
										onClick={() => void onDelete(analysis.id, analysis.title)}
										disabled={deleting === analysis.id}
										aria-label={m.ch_analyses_delete_named({ title: analysis.title })}
										title={m.ch_analyses_delete()}
									>
										<Trash2Icon aria-hidden />
									</Button>
								</li>
							))}
						</ul>
					) : (
						<p className="py-4 text-ch-muted text-sm">{m.ch_analyses_none_yet()}</p>
					)}
				</div>
			</SheetContent>
		</Sheet>
	);
}
