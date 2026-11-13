import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { CheckCheckIcon } from "lucide-react";
import { toast } from "sonner";
import { errorMessage } from "@/components/errors/error-page";
import { Button } from "@/components/ui/button";
import { todayInZone } from "@/lib/i18n/date-only";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { LedgerLine, LedgerPage } from "../kit/ledger";
import { kharchaLinks } from "../links";
import { notificationSentence, parseThread, type ThreadKey } from "../notifications";
import { kharchaMutations } from "../queries";
import type { NotificationView } from "../types";

/** Where a notification goes: its group's thread, the friend's, or the expense. */
const linkTo = (thread: ThreadKey) => {
	const { kind, id } = parseThread(thread);
	return kind === "g" ? kharchaLinks.group(id) : kind === "f" ? kharchaLinks.friend(id) : kharchaLinks.expense(id);
};

/**
 * Home's Updates (Task 92): the caller's newest notifications on a page of the book, each
 * a line that opens where it happened (and is read then); the unread ones marked, with
 * "Mark all read". The bell in the rail and the phone's bar comes here.
 */
export function Updates({
	updates,
	unread,
	timeZone,
	userId,
}: {
	updates: ReadonlyArray<NotificationView>;
	unread: number;
	timeZone: string;
	userId: string;
}) {
	const queryClient = useQueryClient();
	const read = useMutation({
		...kharchaMutations.readNotifications(queryClient, userId),
		onError: (error) => toast.error(errorMessage(error)),
	});
	return (
		<>
			{unread > 0 ? (
				<div className="flex justify-end border-kh-hair border-b px-4 py-2 sm:px-5">
					<Button
						variant="ghost"
						size="sm"
						onClick={() => read.mutate(undefined)}
						disabled={read.isPending}
						data-testid="kharcha-updates-read-all"
					>
						<CheckCheckIcon aria-hidden />
						{m.kharcha_updates_read_all()}
					</Button>
				</div>
			) : null}
			{updates.length === 0 ? (
				<p className="px-4 py-6 text-center text-kh-muted text-sm sm:px-5">{m.kharcha_updates_empty()}</p>
			) : (
				<LedgerPage aria-label={m.kharcha_home_updates()} data-testid="kharcha-updates">
					{updates.map((update, index) => {
						const day = todayInZone(timeZone, new Date(update.at));
						const previous = updates[index - 1];
						const sameDay = previous && todayInZone(timeZone, new Date(previous.at)) === day;
						return (
							<LedgerLine key={update.id} {...(sameDay ? {} : { day })}>
								<Link
									{...linkTo(update.thread)}
									onClick={() => {
										if (!update.read) read.mutate([update.id]);
									}}
									className="kh-ease -mx-1 flex items-start gap-2 rounded-sm px-1 py-0.5 text-sm outline-none hover:bg-kh-sel focus-visible:ring-[3px] focus-visible:ring-ring/50"
									data-testid="kharcha-update"
									data-unread={update.read ? undefined : "true"}
								>
									<span
										aria-hidden
										className={cn("mt-1.5 size-2 shrink-0 rounded-full", update.read ? "bg-transparent" : "bg-kh-act")}
									/>
									<span className="min-w-0 flex-1">
										<span className={cn("block", update.read ? "text-kh-muted" : "font-medium text-kh-ink")}>
											{notificationSentence(update.kind, update.data)}
											{update.read ? null : <span className="sr-only">{` (${m.kharcha_updates_unread()})`}</span>}
										</span>
										{update.data.excerpt ? (
											<span className="block truncate text-caption text-kh-muted">“{update.data.excerpt}”</span>
										) : update.data.group && update.kind !== "group.added" ? (
											<span className="block truncate text-caption text-kh-muted">{update.data.group}</span>
										) : null}
									</span>
								</Link>
							</LedgerLine>
						);
					})}
				</LedgerPage>
			)}
		</>
	);
}
