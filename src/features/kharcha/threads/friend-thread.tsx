import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, Link, useNavigate } from "@tanstack/react-router";
import {
	BellRingIcon,
	EyeIcon,
	EyeOffIcon,
	HandCoinsIcon,
	MailIcon,
	MoreHorizontalIcon,
	PencilIcon,
	PlusIcon,
	SendIcon,
} from "lucide-react";
import { lazy, Suspense, useState } from "react";
import { toast } from "sonner";
import { errorMessage } from "@/components/errors/error-page";
import { MAIN_CONTENT } from "@/components/layout/skip-link";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDayMonth } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import { KharchaEmpty } from "../kit/empty";
import { GroupPlate } from "../kit/group-plate";
import { BalancePill } from "../kit/money";
import { PersonAvatar } from "../kit/person-avatar";
import { kharchaLinks } from "../links";
import { kharchaFriendThreadQueryOptions, kharchaMutations } from "../queries";
import type { ThreadSearch } from "../search";
import { REMIND_WINDOW_MS } from "../settle/remind";
import { useKharchaActions, useKharchaUserId } from "../shell/actions";
import type { FriendThread, FriendView } from "../types";
import { Composer } from "./composer";
import type { FriendDialogKind } from "./friend-dialogs";
import { ThreadLines } from "./thread-lines";
import { useMarkRead } from "./use-read";

const ExpenseSheet = lazy(() => import("../expenses/expense-sheet"));
const FriendDialog = lazy(() => import("./friend-dialogs"));
const route = getRouteApi("/_kharcha/app/kharcha/_shell/f/$personId");

/**
 * The thread with a friend (Tasks 90 and 91): their plate and name, what is open between the
 * two, one primary action by the state (Settle up while the caller owes them, Remind while
 * they owe the caller, else Add expense), and a More menu with the rest (rename, an address,
 * an invite, hide). Then how they asked to be paid, the groups both are in with the balance
 * in each, and the page of what is between them outside groups.
 */
export function FriendThreadPage() {
	const { personId } = route.useParams();
	return <FriendThreadView personId={personId} search={route.useSearch()} />;
}

/** The friend's page for given params (the route's, or a story's). */
export function FriendThreadView({ personId, search }: { personId: string; search: ThreadSearch }) {
	const userId = useKharchaUserId();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const { data } = useSuspenseQuery(kharchaFriendThreadQueryOptions(userId, personId));
	const { addExpense, settleUp } = useKharchaActions();
	const [dialog, setDialog] = useState<FriendDialogKind | null>(null);
	const update = useMutation(kharchaMutations.updateFriend(queryClient, userId));
	const remind = useMutation(kharchaMutations.remind(queryClient, userId));
	const { friend } = data;
	useMarkRead(userId, data.talk);
	const primary = primaryAction(data);
	const reminded = remindedRecently(data.remind.lastAt);
	const sendReminder = async () => {
		try {
			await remind.mutateAsync(friend.person.id);
			toast.success(m.kharcha_remind_sent({ name: friend.person.name }));
		} catch (error) {
			toast.error(errorMessage(error));
		}
	};
	const settle = () => settleUp({ personId: friend.person.id });
	const add = () => addExpense({ with: [friend.person.id] });
	const close = () =>
		navigate({
			from: "/app/kharcha/f/$personId",
			to: ".",
			search: (prev) => ({ ...prev, expense: undefined }),
			replace: true,
		});
	const toggleHidden = async () => {
		try {
			await update.mutateAsync({ personId, hidden: !friend.hidden });
			toast.success(friend.hidden ? m.kharcha_friend_shown() : m.kharcha_friend_hidden_done());
		} catch {
			toast.error(m.kharcha_friend_update_failed());
		}
	};
	return (
		<main {...MAIN_CONTENT} className="flex flex-1 flex-col" data-testid="kharcha-friend">
			<header className="flex flex-wrap items-center gap-x-4 gap-y-3 border-kh-hair border-b bg-kh-page px-4 py-4 sm:px-8 md:py-5">
				<PersonAvatar name={friend.person.name} color={friend.person.color} size="lg" />
				<div className="flex min-w-0 flex-1 flex-col gap-0.5">
					<h1 className="kh-display truncate text-kh-title">{friend.person.name}</h1>
					<p className="truncate text-caption text-kh-muted" data-testid="kharcha-friend-status">
						{friendStatus(friend)}
					</p>
				</div>
				<div className="flex items-center gap-2">
					<BalancePill balances={friend.balances} />
					{primary === "settle" ? (
						<Button onClick={settle} data-testid="kharcha-friend-settle">
							<HandCoinsIcon aria-hidden />
							<span className="max-sm:sr-only">{m.kharcha_create_settle()}</span>
						</Button>
					) : primary === "remind" ? (
						<Button
							onClick={() => void sendReminder()}
							disabled={reminded || remind.isPending}
							data-testid="kharcha-friend-remind"
						>
							<BellRingIcon aria-hidden />
							<span className="max-sm:sr-only">{reminded ? m.kharcha_remind_done() : m.kharcha_remind()}</span>
						</Button>
					) : (
						<Button onClick={add} data-testid="kharcha-friend-add">
							<PlusIcon aria-hidden />
							<span className="max-sm:sr-only">{m.kharcha_create_expense()}</span>
						</Button>
					)}
					<DropdownMenu modal={false}>
						<DropdownMenuTrigger asChild>
							<Button variant="outline" size="icon" data-testid="kharcha-friend-more">
								<MoreHorizontalIcon aria-hidden />
								<span className="sr-only">{m.kharcha_more()}</span>
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" className="min-w-52">
							{primary === "add" ? null : (
								<DropdownMenuItem onSelect={add} data-testid="kharcha-friend-more-add">
									<PlusIcon aria-hidden />
									{m.kharcha_create_expense()}
								</DropdownMenuItem>
							)}
							{primary !== "settle" && friend.balances.length > 0 ? (
								<DropdownMenuItem onSelect={settle} data-testid="kharcha-friend-more-settle">
									<HandCoinsIcon aria-hidden />
									{m.kharcha_create_settle()}
								</DropdownMenuItem>
							) : null}
							{primary !== "remind" && data.remind.available ? (
								<DropdownMenuItem
									onSelect={() => void sendReminder()}
									disabled={reminded}
									data-testid="kharcha-friend-more-remind"
								>
									<BellRingIcon aria-hidden />
									{reminded ? m.kharcha_remind_done() : m.kharcha_remind()}
								</DropdownMenuItem>
							) : null}
							<DropdownMenuItem onSelect={() => setDialog("nickname")} data-testid="kharcha-friend-rename">
								<PencilIcon aria-hidden />
								{m.kharcha_friend_rename()}
							</DropdownMenuItem>
							{friend.canAddEmail ? (
								<DropdownMenuItem onSelect={() => setDialog("email")} data-testid="kharcha-friend-email">
									<MailIcon aria-hidden />
									{m.kharcha_friend_add_email()}
								</DropdownMenuItem>
							) : null}
							{friend.canInvite ? (
								<DropdownMenuItem onSelect={() => setDialog("invite")} data-testid="kharcha-friend-invite">
									<SendIcon aria-hidden />
									{friend.invite ? m.kharcha_invite_again() : m.kharcha_invite_action()}
								</DropdownMenuItem>
							) : null}
							<DropdownMenuItem onSelect={() => void toggleHidden()} data-testid="kharcha-friend-hide">
								{friend.hidden ? <EyeIcon aria-hidden /> : <EyeOffIcon aria-hidden />}
								{friend.hidden ? m.kharcha_friend_unhide() : m.kharcha_friend_hide()}
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</header>

			<div className="flex flex-1 flex-col gap-6 px-4 py-4 sm:px-8 sm:py-6">
				{data.payNote ? (
					<p
						className="rounded-md border border-kh-hair bg-kh-page px-3 py-2 text-sm"
						data-testid="kharcha-friend-pay-note"
					>
						<span className="font-medium">{m.kharcha_settle_pay_note({ name: friend.person.name })}</span>{" "}
						<span className="break-words">{data.payNote}</span>
					</p>
				) : null}
				{data.groups.length > 0 ? (
					<section aria-labelledby="kharcha-friend-groups" className="flex flex-col gap-2">
						<h2 id="kharcha-friend-groups" className="font-semibold text-sm">
							{m.kharcha_friend_groups({ name: friend.person.name })}
						</h2>
						<ul className="divide-y divide-kh-rule overflow-hidden rounded-lg border border-kh-hair bg-kh-page">
							{data.groups.map((group) => (
								<li key={group.id}>
									<Link
										{...kharchaLinks.group(group.id)}
										className="kh-ease grid min-h-12 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-2 outline-none hover:bg-kh-sel focus-visible:bg-kh-sel focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:ring-inset sm:px-5"
										data-testid="kharcha-friend-group"
									>
										<GroupPlate icon={group.icon} color={group.color} size="sm" />
										<span className="min-w-0 truncate font-medium">
											{group.name}
											{group.left ? (
												<span className="ms-2 text-caption text-kh-muted">{m.kharcha_group_you_left()}</span>
											) : null}
										</span>
										<BalancePill balances={group.balances} />
									</Link>
								</li>
							))}
						</ul>
					</section>
				) : null}

				{data.items.length === 0 ? (
					<KharchaEmpty
						kind="page"
						className="rounded-lg border border-kh-hair bg-kh-page"
						action={
							<Button onClick={() => addExpense({ with: [friend.person.id] })}>
								<PlusIcon aria-hidden />
								{m.kharcha_create_expense()}
							</Button>
						}
					/>
				) : (
					<ThreadLines
						items={data.items}
						more={data.more}
						label={m.kharcha_thread_label({ name: friend.person.name })}
						userId={userId}
						talk={data.talk}
						onPayment={(paymentId) => settleUp({ paymentId })}
						expenseLink={(expenseId) =>
							({ className, children }) => (
								<Link
									from="/app/kharcha/f/$personId"
									to="."
									search={(prev) => ({ ...prev, expense: expenseId })}
									mask={{ to: "/app/kharcha/e/$expenseId", params: { expenseId }, unmaskOnReload: true }}
									className={className}
								>
									{children}
								</Link>
							)}
					/>
				)}
				{data.talk.canComment ? (
					<Composer
						talk={data.talk}
						userId={userId}
						onAddExpense={add}
						label={m.kharcha_comment_to({ name: friend.person.name })}
					/>
				) : null}
			</div>

			{search.expense ? (
				<Suspense fallback={null}>
					<ExpenseSheet userId={userId} expenseId={search.expense} onClose={close} />
				</Suspense>
			) : null}
			{dialog ? (
				<Suspense fallback={null}>
					<FriendDialog kind={dialog} friend={friend} userId={userId} onClose={() => setDialog(null)} />
				</Suspense>
			) : null}
		</main>
	);
}

/** The header's one action (PLAN 14.5 "UX"): settle what the caller owes, remind them of what they owe, or add. */
function primaryAction(thread: FriendThread): "settle" | "remind" | "add" {
	if (thread.friend.balances.some((balance) => balance.amountMinor < 0)) return "settle";
	if (thread.remind.available) return "remind";
	return "add";
}

/** A reminder within the last day: the next one waits (one a day per friend). */
function remindedRecently(lastAt: string | null): boolean {
	return lastAt !== null && Date.now() - new Date(lastAt).getTime() < REMIND_WINDOW_MS;
}

/** Whether they are on Kharcha, in words: invited until the day it lapses, or not yet. */
function friendStatus(friend: FriendView): string {
	if (friend.person.hasAccount) return m.kharcha_friend_on_kharcha();
	if (friend.invite)
		return m.kharcha_friend_invited_until({ date: formatDayMonth(friend.invite.expiresAt.slice(0, 10)) });
	return friend.canInvite ? m.kharcha_friend_not_joined() : m.kharcha_friend_contact();
}
