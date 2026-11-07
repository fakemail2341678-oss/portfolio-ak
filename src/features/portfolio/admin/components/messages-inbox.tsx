import { getRouteApi } from "@tanstack/react-router";
import { ArchiveIcon, ReplyIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { CrudListPage, CrudListPending } from "@/components/crud/crud-list-page";
import { onRows, useCrudMutation, withoutRows } from "@/components/crud/use-crud-mutation";
import type { RowAction } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { useCan } from "@/features/rbac/can";
import { useListPage } from "@/hooks/use-list-page";
import { formatDateTime } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import { type ContactMessageItem, MESSAGES_TABLE_ID, type MessageStateInput } from "../../schema";
import { messageColumns } from "../columns";
import { MessageFilterControls, messageFilters } from "../filters";
import { messageKeys } from "../keys";
import { messageListQueryOptions, messageMutations } from "../queries";

const route = getRouteApi("/_admin/admin/portfolio/messages");

/** A reply in the visitor's own mail app, quoting their message. */
const replyHref = (message: ContactMessageItem) =>
	`mailto:${encodeURIComponent(message.email)}?subject=${encodeURIComponent(m.messages_reply_subject())}`;

const now = () => new Date().toISOString();

/** The change a state makes to a row, before the server answers. */
const applyState = (row: ContactMessageItem, set: MessageStateInput["set"]): ContactMessageItem => {
	switch (set) {
		case "read":
			return { ...row, readAt: row.readAt ?? now() };
		case "unread":
			return { ...row, readAt: null };
		case "archived":
			return { ...row, archivedAt: row.archivedAt ?? now() };
		case "inbox":
			return { ...row, archivedAt: null };
	}
};

export function MessagesPending() {
	return (
		<CrudListPending
			title={m.messages_title()}
			description={m.messages_description()}
			columns={messageColumns.length}
		/>
	);
}

/**
 * /admin/portfolio/messages: what the contact form received (decision 0176).
 * Opening a message marks it read; reply opens the mail app, archive moves it
 * out of the inbox. Changes show at once and roll back if the server refuses.
 */
export function MessagesInbox() {
	const search = route.useSearch();
	const list = useListPage({ tableId: MESSAGES_TABLE_ID, search, query: messageListQueryOptions });
	const canManage = useCan("messages:manage");
	const [open, setOpen] = useState<ContactMessageItem | null>(null);

	const setState = useCrudMutation(messageMutations.setState(), {
		invalidate: [messageKeys.all],
		optimistic: {
			queryKey: messageKeys.lists(),
			update: onRows((rows: ContactMessageItem[], input: MessageStateInput) =>
				rows.map((row) => (input.ids.includes(row.id) ? applyState(row, input.set) : row)),
			),
		},
	});
	const remove = useCrudMutation(messageMutations.delete(), {
		invalidate: [messageKeys.all],
		optimistic: { queryKey: messageKeys.lists(), update: withoutRows<ContactMessageItem> },
	});

	const change = (row: ContactMessageItem, set: MessageStateInput["set"], toastText?: string) =>
		setState.mutate({ ids: [row.id], set }, toastText ? { onSuccess: () => toast.success(toastText) } : undefined);

	const view = (row: ContactMessageItem) => {
		setOpen(row);
		if (canManage && !row.readAt) change(row, "read");
	};

	const rowActions = (row: ContactMessageItem): RowAction[] => [
		{ id: "open", label: m.messages_open(), onSelect: () => view(row) },
		{
			id: "reply",
			label: m.messages_reply(),
			render: (label) => <a href={replyHref(row)}>{label}</a>,
		},
		{
			id: "read",
			label: row.readAt ? m.messages_mark_unread() : m.messages_mark_read(),
			permission: "messages:manage",
			onSelect: () => change(row, row.readAt ? "unread" : "read"),
		},
		{
			id: "archive",
			label: row.archivedAt ? m.messages_unarchive() : m.messages_archive(),
			permission: "messages:manage",
			onSelect: () =>
				change(
					row,
					row.archivedAt ? "inbox" : "archived",
					row.archivedAt ? m.messages_toast_unarchived() : m.messages_toast_archived(),
				),
		},
	];

	return (
		<CrudListPage
			title={m.messages_title()}
			description={m.messages_description()}
			tableId={MESSAGES_TABLE_ID}
			list={list}
			columns={messageColumns}
			getRowLabel={(row) => row.name}
			search={search}
			filters={{ controls: <MessageFilterControls search={search} />, ...messageFilters.applied(search) }}
			rowActions={rowActions}
			remove={{ permission: "messages:manage", run: (ids) => remove.mutateAsync(ids) }}
			empty={{ description: m.messages_empty(), filtered: m.portfolio_admin_empty_filtered() }}
			exportName="messages"
			data-testid="messages-table"
		>
			{open ? (
				<Dialog open onOpenChange={(next) => !next && setOpen(null)}>
					<DialogContent className="sm:max-w-xl" data-testid="message-dialog">
						<DialogHeader>
							<DialogTitle>{m.messages_from({ name: open.name })}</DialogTitle>
							<DialogDescription>
								<a href={`mailto:${open.email}`} className="underline underline-offset-4">
									{open.email}
								</a>
								{` · ${formatDateTime(open.createdAt)}`}
							</DialogDescription>
						</DialogHeader>
						<p className="max-h-[50dvh] overflow-y-auto whitespace-pre-line text-body">{open.message}</p>
						<DialogFooter className="flex-wrap gap-2">
							{canManage && !open.archivedAt ? (
								<Button
									variant="outline"
									onClick={() => {
										change(open, "archived", m.messages_toast_archived());
										setOpen(null);
									}}
								>
									<ArchiveIcon aria-hidden />
									{m.messages_archive()}
								</Button>
							) : null}
							<Button asChild>
								<a href={replyHref(open)}>
									<ReplyIcon aria-hidden />
									{m.messages_reply()}
								</a>
							</Button>
						</DialogFooter>
					</DialogContent>
				</Dialog>
			) : null}
		</CrudListPage>
	);
}
