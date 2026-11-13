import { useSuspenseQuery } from "@tanstack/react-query";
import { ScrollRegion } from "@/components/data-display/scroll-region";
import { m } from "@/paraglide/messages";
import { CategoryIcon } from "../kit/category-icon";
import { Money } from "../kit/money";
import { PersonAvatar } from "../kit/person-avatar";
import { kharchaGroupTotalsQueryOptions } from "../queries";

/**
 * A group's Totals tab (Task 91), per currency: what the group spent in all, each member's
 * share and what they paid, and the caller's own share by their own category (categories
 * are each person's own, decision 0285). Tables, so they read in order without a chart.
 * Lazy: loaded with the tab.
 */
export default function GroupTotals({ groupId, userId }: { groupId: string; userId: string }) {
	const { data } = useSuspenseQuery(kharchaGroupTotalsQueryOptions(userId, groupId));
	if (data.currencies.length === 0) {
		return (
			<p className="rounded-lg border border-kh-hair bg-kh-page px-4 py-4 text-kh-muted text-sm">
				{m.kharcha_totals_empty()}
			</p>
		);
	}
	const find = (id: string) => data.people.find((person) => person.id === id);
	return (
		<div className="flex flex-col gap-8" data-testid="kharcha-group-totals">
			{data.currencies.map((total) => (
				<section
					key={total.currency}
					aria-labelledby={`kharcha-totals-${total.currency}`}
					className="flex flex-col gap-3"
				>
					<div className="flex flex-wrap items-baseline justify-between gap-2">
						<h2 id={`kharcha-totals-${total.currency}`} className="font-semibold text-sm">
							{total.currency}
						</h2>
						<p className="flex items-baseline gap-2 text-sm">
							<span className="text-kh-muted">{m.kharcha_totals_spent()}</span>
							<Money amountMinor={total.spentMinor} currency={total.currency} size="lg" className="kh-double" />
						</p>
					</div>
					<ScrollRegion
						className="rounded-lg border border-kh-hair bg-kh-page"
						label={m.kharcha_totals_members({ currency: total.currency })}
					>
						<table className="w-full text-sm">
							<caption className="sr-only">{m.kharcha_totals_members({ currency: total.currency })}</caption>
							<thead className="text-caption text-kh-muted">
								<tr className="border-kh-hair border-b">
									<th scope="col" className="px-4 py-2 text-start font-medium sm:px-5">
										{m.kharcha_totals_member()}
									</th>
									<th scope="col" className="px-4 py-2 text-end font-medium">
										{m.kharcha_totals_share()}
									</th>
									<th scope="col" className="px-4 py-2 text-end font-medium sm:pe-5">
										{m.kharcha_totals_paid()}
									</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-kh-rule">
								{total.members.map((member) => {
									const person = find(member.personId);
									return (
										<tr key={member.personId} data-testid="kharcha-totals-member">
											<th scope="row" className="px-4 py-2 text-start font-medium sm:px-5">
												<span className="flex min-w-0 items-center gap-2">
													{person ? <PersonAvatar name={person.name} color={person.color} size="sm" /> : null}
													<span className="truncate">
														{person?.isMe ? m.kharcha_you_subject() : (person?.name ?? m.kharcha_someone())}
													</span>
												</span>
											</th>
											<td className="px-4 py-2 text-end">
												<Money amountMinor={member.shareMinor} currency={total.currency} />
											</td>
											<td className="px-4 py-2 text-end sm:pe-5">
												<Money amountMinor={member.paidMinor} currency={total.currency} />
											</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					</ScrollRegion>
					{total.mine.length > 0 ? (
						<ScrollRegion
							className="rounded-lg border border-kh-hair bg-kh-page"
							label={`${m.kharcha_totals_mine()}, ${total.currency}`}
						>
							<table className="w-full text-sm">
								<caption className="px-4 pt-3 text-start font-medium text-kh-muted sm:px-5">
									{m.kharcha_totals_mine()}
								</caption>
								<thead className="sr-only">
									<tr>
										<th scope="col">{m.kharcha_field_category()}</th>
										<th scope="col">{m.kharcha_totals_share()}</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-kh-rule">
									{total.mine.map((row) => (
										<tr key={row.category?.id ?? "none"} data-testid="kharcha-totals-category">
											<th scope="row" className="px-4 py-2 text-start font-normal sm:px-5">
												<span className="flex min-w-0 items-center gap-2">
													<CategoryIcon
														icon={row.category?.icon ?? null}
														{...(row.category ? { color: row.category.color } : {})}
													/>
													<span className="truncate">{row.category?.name ?? m.kharcha_category_none()}</span>
												</span>
											</th>
											<td className="px-4 py-2 text-end sm:pe-5">
												<Money amountMinor={row.shareMinor} currency={total.currency} />
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</ScrollRegion>
					) : null}
				</section>
			))}
		</div>
	);
}
