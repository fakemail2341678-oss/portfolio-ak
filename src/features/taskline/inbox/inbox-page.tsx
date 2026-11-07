import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, Link } from "@tanstack/react-router";
import { BellIcon, CheckCheckIcon, CheckIcon, MailIcon, SettingsIcon } from "lucide-react";
import { toast } from "sonner";
import { RelativeTime } from "@/components/data-display/relative-time";
import { errorMessage } from "@/components/errors/error-page";
import { EmptyState } from "@/components/page/empty-state";
import { Page, PageHeader } from "@/components/page/page";
import { PageTab, PageTabs } from "@/components/page/page-tabs";
import { Button } from "@/components/ui/button";
import { formatNumber } from "@/lib/i18n/intl";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { tasklineLinks } from "../links";
import { notificationSentence } from "../notifications";
import { inboxQueryOptions, tasklineMutations } from "../queries";
import type { InboxItem } from "../types";

const route = getRouteApi("/_taskline/app/taskline/_shell/inbox");

/**
 * /app/taskline/inbox (Task 50): what the caller was told, newest first: unread or
 * everything. Opening one marks it read; each can be marked read or unread, or all at
 * once. The sidebar's count follows.
 */
export function InboxPage() {
	const { session } = route.useRouteContext();
	return <InboxView userId={session.user.id} search={route.useSearch()} />;
}

/** The page itself (stories render it without the route). */
export function InboxView({ userId, search }: { userId: string; search: { filter: "unread" | "all"; page: number } }) {
	const queryClient = useQueryClient();
	const { data } = useSuspenseQuery(inboxQueryOptions(userId, search));
	const mark = useMutation(tasklineMutations.markRead(queryClient, userId));
	const onError = (error: Error) => toast.error(errorMessage(error));
	const unread = formatNumber(data.unread);
	return (
		<Page width="narrow" data-testid="taskline-inbox">
			<PageHeader
				title={m.taskline_inbox()}
				description={m.taskline_inbox_description()}
				actions={
					<>
						<Button asChild variant="ghost">
							<Link {...tasklineLinks.mySettings()}>
								<SettingsIcon aria-hidden />
								{m.taskline_inbox_settings()}
							</Link>
						</Button>
						{data.unread > 0 ? (
							<Button
								variant="outline"
								disabled={mark.isPending}
								onClick={() => mark.mutate({ all: true }, { onError })}
								data-testid="inbox-read-all"
							>
								<CheckCheckIcon aria-hidden />
								{m.taskline_inbox_read_all()}
							</Button>
						) : null}
					</>
				}
				tabs={
					<PageTabs label={m.taskline_inbox()}>
						<PageTab {...tasklineLinks.inbox("unread")} data-testid="inbox-tab-unread">
							{m.taskline_inbox_unread()}
							{data.unread > 0 ? <span className="tabular-nums">{unread}</span> : null}
						</PageTab>
						<PageTab {...tasklineLinks.inbox("all")} data-testid="inbox-tab-all">
							{m.taskline_inbox_all()}
						</PageTab>
					</PageTabs>
				}
			/>
			{data.items.length === 0 ? (
				<EmptyState
					icon={search.filter === "unread" ? CheckIcon : BellIcon}
					title={search.filter === "unread" ? m.taskline_inbox_empty_unread() : m.taskline_inbox_empty()}
					description={m.taskline_inbox_empty_body()}
					data-testid="inbox-empty"
				/>
			) : (
				<ul className="flex flex-col divide-y rounded-lg border" data-testid="inbox-list">
					{data.items.map((item) => (
						<InboxRow
							key={item.id}
							item={item}
							readAt={data.readAt}
							onOpen={() => {
								if (!item.read) mark.mutate({ ids: [item.id], read: true }, { onError });
							}}
							onToggle={() => mark.mutate({ ids: [item.id], read: !item.read }, { onError })}
						/>
					))}
				</ul>
			)}
			{data.hasMore ? (
				<div className="flex justify-center">
					<Button asChild variant="outline">
						<Link {...tasklineLinks.inbox(search.filter, search.page + 1)} resetScroll={false}>
							{m.taskline_inbox_more()}
						</Link>
					</Button>
				</div>
			) : null}
		</Page>
	);
}

function InboxRow({
	item,
	readAt,
	onOpen,
	onToggle,
}: {
	item: InboxItem;
	readAt: string;
	onOpen: () => void;
	onToggle: () => void;
}) {
	const sentence = notificationSentence(item.kind, item.data);
	const target = item.ref ? tasklineLinks.task(item.ws, item.ref) : tasklineLinks.project(item.ws, item.projectKey);
	return (
		<li className={cn("flex items-start gap-3 px-4 py-3", !item.read && "bg-surface-2")} data-testid="inbox-item">
			<span
				aria-hidden
				className={cn("mt-2 size-2 shrink-0 rounded-full", item.read ? "bg-transparent" : "bg-primary")}
			/>
			<div className="flex min-w-0 flex-1 flex-col gap-0.5">
				<Link {...target} onClick={onOpen} className="font-medium text-body hover:underline">
					{sentence}
					{item.read ? null : <span className="sr-only">{` (${m.taskline_inbox_unread_one()})`}</span>}
				</Link>
				{item.data.title ? <span className="truncate text-body text-muted-foreground">{item.data.title}</span> : null}
				{item.data.excerpt ? (
					<span className="line-clamp-2 text-caption text-muted-foreground">{item.data.excerpt}</span>
				) : null}
				<span className="text-caption text-muted-foreground">
					{item.data.project ? `${item.data.project} · ` : null}
					<RelativeTime value={item.createdAt} now={readAt} />
				</span>
			</div>
			<Button variant="ghost" size="icon" onClick={onToggle} data-testid="inbox-toggle">
				{item.read ? <MailIcon aria-hidden /> : <CheckIcon aria-hidden />}
				<span className="sr-only">
					{item.read
						? m.taskline_inbox_mark_unread({ item: sentence })
						: m.taskline_inbox_mark_read({ item: sentence })}
				</span>
			</Button>
		</li>
	);
}
