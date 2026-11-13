import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArchiveIcon, CheckIcon, HandCoinsIcon } from "lucide-react";
import { toast } from "sonner";
import { errorMessage } from "@/components/errors/error-page";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { Money } from "../kit/money";
import { PersonAvatar } from "../kit/person-avatar";
import { kharchaLinks } from "../links";
import { kharchaMutations } from "../queries";
import { transferSentence } from "../settle/words";
import { useKharchaActions } from "../shell/actions";
import type { GroupView, KharchaPerson } from "../types";

/**
 * A group's Balances tab (Task 91): per currency, every member's net (in words as well as
 * colour), then how to settle it: the fewest payments when the group simplifies, else who
 * owes whom, pair by pair. Each has its Settle button for a current member.
 */
export function GroupBalances({ group }: { group: GroupView }) {
	const { settleUp } = useKharchaActions();
	const people = group.members.map((member) => member.person);
	const find = (id: string): KharchaPerson | undefined => people.find((person) => person.id === id);
	if (group.nets.length === 0) {
		return (
			<p
				className="flex items-center gap-2 rounded-lg border border-kh-hair bg-kh-page px-4 py-4 text-sm"
				data-testid="kharcha-group-settled"
			>
				<CheckIcon className="size-4 shrink-0 text-kh-owed" aria-hidden />
				{m.kharcha_balances_all_settled()}
			</p>
		);
	}
	return (
		<div className="flex flex-col gap-6" data-testid="kharcha-group-balances">
			{group.nets.map((net) => (
				<section
					key={net.currency}
					aria-labelledby={`kharcha-balances-${net.currency}`}
					className="flex flex-col gap-3"
				>
					<h2 id={`kharcha-balances-${net.currency}`} className="font-semibold text-sm">
						{net.currency}
					</h2>
					<ul className="divide-y divide-kh-rule overflow-hidden rounded-lg border border-kh-hair bg-kh-page">
						{net.people.map((entry) => {
							const person = find(entry.personId);
							if (!person) return null;
							const owed = entry.netMinor > 0;
							return (
								<li
									key={entry.personId}
									className="grid min-h-12 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-2 sm:px-5"
									data-testid="kharcha-balance-member"
								>
									<PersonAvatar name={person.name} color={person.color} size="sm" />
									<span className="min-w-0 truncate font-medium">
										{person.isMe ? m.kharcha_you_subject() : person.name}
									</span>
									<span
										className={cn("flex flex-col items-end text-end", owed ? "text-kh-owed" : "text-kh-owe")}
										data-direction={owed ? "owed" : "owe"}
									>
										<Money amountMinor={Math.abs(entry.netMinor)} currency={net.currency} />
										<span className="font-medium text-caption">
											{person.isMe
												? owed
													? m.kharcha_balances_you_get_back()
													: m.kharcha_balances_you_owe()
												: owed
													? m.kharcha_balances_gets_back()
													: m.kharcha_balances_owes()}
										</span>
									</span>
								</li>
							);
						})}
					</ul>

					<h3 className="font-medium text-kh-muted text-sm">
						{group.settings.simplify ? m.kharcha_balances_simplified() : m.kharcha_balances_pairwise()}
					</h3>
					<ul className="divide-y divide-kh-rule overflow-hidden rounded-lg border border-kh-hair bg-kh-page">
						{net.suggested.map((transfer) => {
							const choice = {
								groupId: group.id,
								group: group.name,
								fromId: transfer.from,
								toId: transfer.to,
								amountMinor: transfer.amount,
								currency: net.currency,
							};
							return (
								<li
									key={`${transfer.from}:${transfer.to}`}
									className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 sm:px-5"
									data-testid="kharcha-balance-transfer"
								>
									<HandCoinsIcon className="size-4 shrink-0 text-kh-muted" aria-hidden />
									<span className="min-w-0 flex-1">{transferSentence(choice, people)}</span>
									{group.can.edit ? (
										<Button
											size="sm"
											variant="outline"
											onClick={() => settleUp({ groupId: group.id, choice })}
											data-testid="kharcha-balance-settle"
										>
											{m.kharcha_settle_action()}
										</Button>
									) : null}
								</li>
							);
						})}
					</ul>
				</section>
			))}
			<p className="text-caption text-kh-muted">
				{group.settings.simplify ? m.kharcha_balances_simplified_help() : m.kharcha_balances_pairwise_help()}{" "}
				{group.can.edit ? (
					<Link {...kharchaLinks.group(group.id, "settings")} className="underline underline-offset-2">
						{m.kharcha_balances_change()}
					</Link>
				) : null}
			</p>
		</div>
	);
}

/**
 * Everyone in the group is settled (Task 91): its owner is offered to archive it. Only once
 * something has happened in it, so a new group isn't told it is finished.
 */
export function SettledNotice({ group, userId }: { group: GroupView; userId: string }) {
	const queryClient = useQueryClient();
	const archive = useMutation(kharchaMutations.archiveGroup(queryClient, userId));
	if (group.nets.length > 0 || group.archived || group.left || !group.can.manage) return null;
	return (
		<div
			className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border border-kh-hair bg-kh-page px-3 py-2 text-caption"
			data-testid="kharcha-group-archive-offer"
		>
			<CheckIcon className="size-4 shrink-0 text-kh-owed" aria-hidden />
			<span className="min-w-0 flex-1">{m.kharcha_balances_archive_offer()}</span>
			<Button
				size="sm"
				variant="outline"
				disabled={archive.isPending}
				onClick={() =>
					archive
						.mutateAsync({ groupId: group.id, archived: true })
						.then(() => toast.success(m.kharcha_balances_archived()))
						.catch((error: unknown) => toast.error(errorMessage(error)))
				}
				data-testid="kharcha-group-archive"
			>
				<ArchiveIcon aria-hidden />
				{m.kharcha_balances_archive()}
			</Button>
		</div>
	);
}
