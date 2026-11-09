import { getRouteApi } from "@tanstack/react-router";
import { BanIcon } from "lucide-react";
import { lazy, Suspense, useState } from "react";
import { toast } from "sonner";
import { CrudListPage, CrudListPending } from "@/components/crud/crud-list-page";
import { useCrudMutation } from "@/components/crud/use-crud-mutation";
import { StatusOf } from "@/components/data-display/status-badge";
import type { DataTableColumn, RowAction } from "@/components/data-table";
import { useConfirm } from "@/components/dialogs/confirm";
import { SearchFilter, SelectFilter } from "@/components/filters/filters";
import { PageTab, PageTabs } from "@/components/page/page-tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Can } from "@/features/rbac/can";
import { useListPage } from "@/hooks/use-list-page";
import { choiceChip, defineFilters, textChip } from "@/lib/crud/filters";
import { formatDateTime, formatNumber } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import { chaalKeys } from "../../keys";
import { CONNECTION_STATE, CONNECTION_STATE_FILTER_LABELS, CONNECTION_WHO_LABELS } from "../labels";
import { chaalAdminMutations, chaalConnectionsQueryOptions } from "../queries";
import type { ChaalAdminConnection } from "../schema";
import {
	CHAAL_CONNECTIONS_TABLE_ID,
	type ChaalConnectionSearch,
	CONNECTION_STATE_FILTERS,
	CONNECTION_WHO_FILTERS,
	type ConnectionStateFilter,
	type ConnectionWhoFilter,
} from "../search";

const route = getRouteApi("/_admin/admin/chaal/connections");

/** Connections | Blocks, over both lists. */
export function ConnectionTabs() {
	return (
		<PageTabs label={m.ch_admin_connections_tabs()}>
			<PageTab to="/admin/chaal/connections">{m.ch_admin_connections_title()}</PageTab>
			<PageTab to="/admin/chaal/blocks" data-testid="chaal-tab-blocks">
				{m.ch_admin_blocks_title()}
			</PageTab>
		</PageTabs>
	);
}

const BlockDialog = lazy(() => import("../blocks/block-form").then((module) => ({ default: module.BlockDialog })));

/** Which block dialog is open: none, or one for an account (empty for a new one). */
export type BlockOpen = { lichess?: string } | null;

/** "Block": opens the block dialog, for `chaal:moderate`. */
export function BlockButton({ onOpen }: { onOpen: () => void }) {
	return (
		<Can permission="chaal:moderate">
			<Button onClick={onOpen} data-testid="chaal-block-open">
				<BanIcon aria-hidden />
				{m.ch_admin_block_new()}
			</Button>
		</Can>
	);
}

/** The block dialog when it's open (loaded on click). */
export function BlockDialogSlot({ open, onClose }: { open: BlockOpen; onClose: () => void }) {
	if (!open) return null;
	return (
		<Suspense fallback={null}>
			<BlockDialog lichess={open.lichess} onClose={onClose} />
		</Suspense>
	);
}

const dash = <span className="text-muted-foreground">—</span>;

const columns: ReadonlyArray<DataTableColumn<ChaalAdminConnection>> = [
	{
		id: "user",
		header: m.ch_admin_col_user,
		cellClassName: "max-w-64",
		cell: (row) => (
			<div className="flex min-w-0 flex-col">
				<span className="truncate font-medium">{row.userName}</span>
				<span className="truncate text-muted-foreground text-xs">{row.userEmail ?? m.ch_admin_guest()}</span>
			</div>
		),
		csv: (row) => row.userEmail ?? m.ch_admin_guest(),
	},
	{
		id: "lichess",
		header: m.ch_admin_col_lichess,
		sort: "username",
		cellClassName: "max-w-56",
		cell: (row) => (
			<a
				href={`https://lichess.org/@/${encodeURIComponent(row.username)}`}
				target="_blank"
				rel="nofollow ugc noopener"
				className="truncate font-medium underline-offset-4 hover:underline"
				data-testid="chaal-connection-lichess"
			>
				{row.title ? <span className="me-1 text-warning">{row.title}</span> : null}
				{row.username}
			</a>
		),
		csv: (row) => row.username,
	},
	{
		id: "state",
		header: m.ch_admin_col_state,
		cell: (row) => (
			<span className="flex flex-wrap items-center gap-1">
				<StatusOf status={row.state} map={CONNECTION_STATE} />
				{row.blocked ? <Badge variant="destructive">{m.ch_admin_blocked()}</Badge> : null}
				{row.cooldownUntil ? <Badge variant="outline">{m.ch_admin_cooling()}</Badge> : null}
			</span>
		),
		csv: (row) => CONNECTION_STATE[row.state].label(),
	},
	{
		id: "scopes",
		header: m.ch_admin_col_scopes,
		hideable: true,
		cellClassName: "max-w-72 whitespace-normal text-xs text-muted-foreground",
		cell: (row) => (row.scopes.length > 0 ? row.scopes.join(" ") : dash),
		csv: (row) => row.scopes.join(" "),
	},
	{
		id: "connected",
		header: m.ch_admin_col_connected,
		sort: "connected",
		hideable: true,
		cellClassName: "whitespace-nowrap text-muted-foreground text-sm",
		cell: (row) => formatDateTime(row.connectedAt),
		csv: (row) => row.connectedAt,
	},
	{
		id: "used",
		header: m.ch_admin_col_used,
		sort: "used",
		hideable: true,
		cellClassName: "whitespace-nowrap text-muted-foreground text-sm",
		cell: (row) => (row.lastUsedAt ? formatDateTime(row.lastUsedAt) : dash),
		csv: (row) => row.lastUsedAt ?? "",
	},
	{
		id: "expires",
		header: m.ch_admin_col_expires,
		hideable: true,
		cellClassName: "whitespace-nowrap text-muted-foreground text-sm",
		cell: (row) => (row.expiresAt ? formatDateTime(row.expiresAt) : dash),
		csv: (row) => row.expiresAt ?? "",
	},
];

const filters = defineFilters<ChaalConnectionSearch>([
	textChip("q", m.crud_search),
	choiceChip("state", m.ch_admin_col_state, (state: ConnectionStateFilter) => CONNECTION_STATE_FILTER_LABELS[state]()),
	choiceChip("who", m.ch_admin_filter_who, (who: ConnectionWhoFilter) => CONNECTION_WHO_LABELS[who]()),
]);

export function ChaalConnectionsPending() {
	return (
		<CrudListPending
			title={m.ch_admin_connections_title()}
			description={m.ch_admin_connections_description()}
			actions={<BlockButton onOpen={() => {}} />}
			columns={columns.length}
		/>
	);
}

/**
 * /admin/chaal/connections (PLAN Task 79, decision 0268): every connected Lichess account,
 * with its site user, scopes, dates and state; never a token. Revoking ends the token at
 * Lichess and leaves the player "Reconnect"; Block opens the block form for that account.
 */
export function ChaalConnectionsPage() {
	const search = route.useSearch();
	const [blocking, setBlocking] = useState<BlockOpen>(null);
	const confirm = useConfirm();
	const list = useListPage({ tableId: CHAAL_CONNECTIONS_TABLE_ID, search, query: chaalConnectionsQueryOptions });
	const revoke = useCrudMutation(chaalAdminMutations.revokeConnections(), {
		invalidate: [chaalKeys.adminConnections()],
	});

	const askRevoke = async (rows: ReadonlyArray<ChaalAdminConnection>, done?: () => void) => {
		const active = rows.filter((row) => row.state === "active");
		if (active.length === 0) return;
		const first = active[0];
		const confirmed = await confirm({
			destructive: true,
			title:
				active.length === 1 && first
					? m.ch_admin_revoke_title({ username: first.username })
					: m.ch_admin_revoke_many_title({ count: formatNumber(active.length) }),
			description: m.ch_admin_revoke_body(),
			confirmLabel: m.ch_admin_revoke(),
		});
		if (!confirmed) return;
		revoke.mutate(
			active.map((row) => row.id),
			{
				onSuccess: ({ revoked }) => {
					done?.();
					toast.success(m.ch_admin_revoked({ count: formatNumber(revoked) }));
				},
			},
		);
	};

	const rowActions = (row: ChaalAdminConnection): RowAction[] => [
		{
			id: "revoke",
			label: m.ch_admin_revoke(),
			permission: "chaal:moderate",
			destructive: true,
			hidden: row.state !== "active",
			onSelect: () => void askRevoke([row]),
		},
		{
			id: "block",
			label: m.ch_admin_block_account(),
			permission: "chaal:moderate",
			hidden: row.blocked,
			onSelect: () => setBlocking({ lichess: row.username }),
		},
	];

	const rows = list.page?.items ?? [];

	return (
		<CrudListPage
			title={m.ch_admin_connections_title()}
			description={m.ch_admin_connections_description()}
			actions={<BlockButton onOpen={() => setBlocking({})} />}
			tabs={<ConnectionTabs />}
			tableId={CHAAL_CONNECTIONS_TABLE_ID}
			list={list}
			columns={columns}
			getRowLabel={(row) => row.username}
			search={search}
			filters={{
				controls: (
					<>
						<SearchFilter label={m.crud_search()} value={search.q} placeholder={m.ch_admin_connections_search()} />
						<SelectFilter
							name="state"
							label={m.ch_admin_col_state()}
							value={search.state}
							options={CONNECTION_STATE_FILTERS.map((state) => ({
								value: state,
								label: CONNECTION_STATE_FILTER_LABELS[state](),
							}))}
						/>
						<SelectFilter
							name="who"
							label={m.ch_admin_filter_who()}
							value={search.who}
							options={CONNECTION_WHO_FILTERS.map((who) => ({ value: who, label: CONNECTION_WHO_LABELS[who]() }))}
						/>
					</>
				),
				...filters.applied(search),
			}}
			rowActions={rowActions}
			bulkActions={{
				permission: "chaal:moderate",
				render: ({ ids, clear }) => (
					<Button
						size="sm"
						variant="destructive"
						onClick={() =>
							void askRevoke(
								rows.filter((row) => ids.includes(row.id)),
								clear,
							)
						}
						data-testid="chaal-connections-revoke"
					>
						{m.ch_admin_revoke_selected()}
					</Button>
				),
			}}
			empty={{ description: m.ch_admin_connections_empty(), filtered: m.ch_admin_empty_filtered() }}
			exportName="chaal-connections"
			data-testid="chaal-connections-table"
		>
			<BlockDialogSlot open={blocking} onClose={() => setBlocking(null)} />
		</CrudListPage>
	);
}
