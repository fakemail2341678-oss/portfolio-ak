import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, Link } from "@tanstack/react-router";
import { UserPlusIcon, UsersIcon } from "lucide-react";
import type { ReactNode } from "react";
import { FilterBar } from "@/components/filters/filter-bar";
import { SearchFilter } from "@/components/filters/filters";
import { MAIN_CONTENT } from "@/components/layout/skip-link";
import { Button } from "@/components/ui/button";
import { formatNumber } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import { KharchaEmpty } from "../kit/empty";
import { GroupPlate } from "../kit/group-plate";
import { BalancePill } from "../kit/money";
import { PersonAvatar } from "../kit/person-avatar";
import { kharchaLinks } from "../links";
import { kharchaPeopleQueryOptions } from "../queries";
import type { PeopleSearch } from "../search";
import { useKharchaActions, useKharchaUserId } from "../shell/actions";
import type { FriendView, GroupSummary } from "../types";

const route = getRouteApi("/_kharcha/app/kharcha/_shell/people");

/**
 * People (Task 90): the caller's groups, then their friends, each with what is open with
 * it ("NPR 1,200.00 ↙ owed to you", or settled). Every row opens its thread. The search is
 * in the address (`?q=`), so it works without JavaScript; hidden friends are listed on asking.
 */
export function PeoplePage() {
	return <PeopleView search={route.useSearch()} />;
}

/** People for a given URL (the route's, or a story's). */
export function PeopleView({ search }: { search: PeopleSearch }) {
	const userId = useKharchaUserId();
	const hidden = search.hidden === true;
	const { data } = useSuspenseQuery(kharchaPeopleQueryOptions(userId, { q: search.q, hidden }));
	const { create } = useKharchaActions();
	const nothing = data.friends.length === 0 && data.groups.length === 0;
	return (
		<main {...MAIN_CONTENT} className="flex flex-1 flex-col" data-testid="kharcha-people">
			<header className="flex flex-wrap items-center gap-x-4 gap-y-3 border-kh-hair border-b bg-kh-page px-4 py-4 sm:px-8 md:py-5">
				<div className="flex min-w-0 flex-col gap-1">
					<h1 className="kh-display text-kh-title">{m.kharcha_nav_people()}</h1>
					<p className="text-caption text-kh-muted">{m.kharcha_people_lede()}</p>
				</div>
				<div className="ms-auto hidden items-center gap-2 md:flex">
					<Button variant="outline" onClick={() => create("group")} data-testid="kharcha-people-new-group">
						<UsersIcon aria-hidden />
						{m.kharcha_create_group()}
					</Button>
					<Button onClick={() => create("friend")} data-testid="kharcha-people-add-friend">
						<UserPlusIcon aria-hidden />
						{m.kharcha_create_friend()}
					</Button>
				</div>
			</header>

			<div className="flex flex-1 flex-col gap-6 px-4 py-4 sm:px-8 sm:py-6">
				<FilterBar values={search} preserve={["hidden"]} label={m.kharcha_people_filters()}>
					<SearchFilter
						label={m.kharcha_people_search()}
						placeholder={m.kharcha_people_search()}
						value={search.q}
						hideLabel
						className="min-w-48 flex-1"
					/>
				</FilterBar>

				{nothing ? (
					<KharchaEmpty
						kind={search.q ? "search" : "people"}
						className="rounded-lg border border-kh-hair bg-kh-page"
						action={
							search.q ? (
								<Button asChild variant="outline">
									<Link from="/app/kharcha/people" to="." search={(prev) => ({ ...prev, q: "" })}>
										{m.filters_clear()}
									</Link>
								</Button>
							) : (
								<Button onClick={() => create("friend")}>
									<UserPlusIcon aria-hidden />
									{m.kharcha_create_friend()}
								</Button>
							)
						}
					/>
				) : (
					<>
						{data.groups.length > 0 ? (
							<PeopleSection
								title={m.kharcha_people_groups()}
								count={data.groups.length}
								testId="kharcha-people-groups"
							>
								{data.groups.map((group) => (
									<GroupRow key={group.id} group={group} />
								))}
							</PeopleSection>
						) : null}
						{data.friends.length > 0 ? (
							<PeopleSection
								title={m.kharcha_people_friends()}
								count={data.friends.length}
								testId="kharcha-people-friends"
							>
								{data.friends.map((friend) => (
									<FriendRow key={friend.person.id} friend={friend} />
								))}
							</PeopleSection>
						) : null}
					</>
				)}

				{data.hiddenCount > 0 || hidden ? (
					<p className="text-caption">
						<Link
							from="/app/kharcha/people"
							to="."
							search={(prev) => ({ ...prev, hidden: hidden ? undefined : true })}
							className="text-kh-mark underline underline-offset-4 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
							data-testid="kharcha-people-hidden"
						>
							{hidden
								? m.kharcha_people_hide_hidden()
								: m.kharcha_people_show_hidden({ count: formatNumber(data.hiddenCount) })}
						</Link>
					</p>
				) : null}
			</div>
		</main>
	);
}

function PeopleSection({
	title,
	count,
	testId,
	children,
}: {
	title: string;
	count: number;
	testId: string;
	children: ReactNode;
}) {
	return (
		<section aria-labelledby={`${testId}-title`} className="flex flex-col gap-2" data-testid={testId}>
			<h2 id={`${testId}-title`} className="flex items-baseline gap-2 font-semibold text-kh-ink text-sm">
				{title}
				<span className="kh-figures font-normal text-kh-muted">{formatNumber(count)}</span>
			</h2>
			<ul className="divide-y divide-kh-rule overflow-hidden rounded-lg border border-kh-hair bg-kh-page">
				{children}
			</ul>
		</section>
	);
}

const ROW =
	"kh-ease grid min-h-14 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5 outline-none hover:bg-kh-sel focus-visible:bg-kh-sel focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:ring-inset sm:px-5";

function GroupRow({ group }: { group: GroupSummary }) {
	const notes = [
		group.left ? m.kharcha_group_you_left() : m.kharcha_group_members({ count: formatNumber(group.members) }),
		group.archived ? m.kharcha_group_archived() : "",
	].filter(Boolean);
	return (
		<li>
			<Link {...kharchaLinks.group(group.id)} className={ROW} data-testid="kharcha-people-group">
				<GroupPlate icon={group.icon} color={group.color} />
				<span className="min-w-0">
					<span className="block truncate font-semibold">{group.name}</span>
					<span className="block truncate text-caption text-kh-muted">{notes.join(" · ")}</span>
				</span>
				<BalancePill balances={group.balances} />
			</Link>
		</li>
	);
}

function FriendRow({ friend }: { friend: FriendView }) {
	const note = friend.person.hasAccount
		? ""
		: friend.invite
			? m.kharcha_friend_invited()
			: m.kharcha_friend_not_joined();
	return (
		<li>
			<Link {...kharchaLinks.friend(friend.person.id)} className={ROW} data-testid="kharcha-people-friend">
				<PersonAvatar name={friend.person.name} color={friend.person.color} />
				<span className="min-w-0">
					<span className="block truncate font-semibold">{friend.person.name}</span>
					{note || friend.hidden ? (
						<span className="block truncate text-caption text-kh-muted">
							{[note, friend.hidden ? m.kharcha_friend_hidden() : ""].filter(Boolean).join(" · ")}
						</span>
					) : null}
				</span>
				<BalancePill balances={friend.balances} />
			</Link>
		</li>
	);
}
