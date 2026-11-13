import { useSuspenseQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { CrudListPage } from "@/components/crud/crud-list-page";
import { useCrudMutation } from "@/components/crud/use-crud-mutation";
import { StatusBadge } from "@/components/data-display/status-badge";
import type { DataTableColumn } from "@/components/data-table";
import { useConfirm } from "@/components/dialogs/confirm";
import { formatDateTime, formatNumber } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import { kharchaAdminKeys, kharchaAdminMutations, kharchaSendersQueryOptions } from "../queries";
import type { KharchaSender } from "../schema";

const count = (value: number) => <span className="tabular-nums">{formatNumber(value)}</span>;

const columns: ReadonlyArray<DataTableColumn<KharchaSender>> = [
	{
		id: "sender",
		header: m.kharcha_admin_col_sender,
		cellClassName: "max-w-64",
		cell: (row) => (
			<div className="flex min-w-0 flex-col">
				<span className="truncate font-medium">{row.name}</span>
				<span className="truncate text-muted-foreground text-xs">{row.email}</span>
			</div>
		),
		csv: (row) => row.email,
	},
	{ id: "day", header: m.kharcha_admin_col_day, cell: (row) => count(row.day), csv: (row) => String(row.day) },
	{ id: "month", header: m.kharcha_admin_col_month, cell: (row) => count(row.month), csv: (row) => String(row.month) },
	{
		id: "accepted",
		header: m.kharcha_admin_col_accepted,
		hideable: true,
		cell: (row) => count(row.accepted),
		csv: (row) => String(row.accepted),
	},
	{
		id: "state",
		header: m.kharcha_admin_col_state,
		cellClassName: "whitespace-nowrap",
		cell: (row) =>
			row.suspendedAt ? (
				<StatusBadge tone="warning">
					{m.kharcha_admin_suspended_since({ at: formatDateTime(row.suspendedAt) })}
				</StatusBadge>
			) : (
				<StatusBadge tone="neutral">{m.kharcha_admin_may_send()}</StatusBadge>
			),
		csv: (row) => row.suspendedAt ?? "",
	},
];

/**
 * /admin/kharcha/senders (PLAN Task 96, decision 0290): the accounts that sent the most
 * invites in the last 30 days, as counts (never whom they invited), and everyone suspended.
 * Suspending stops their invites and reminders; restoring lets them send again. Both are
 * audited.
 */
export function KharchaSenderList() {
	const { data: senders } = useSuspenseQuery(kharchaSendersQueryOptions());
	const confirm = useConfirm();
	const suspend = useCrudMutation(kharchaAdminMutations.suspend(), { invalidate: [kharchaAdminKeys.senders()] });
	return (
		<CrudListPage
			title={m.kharcha_admin_senders_title()}
			description={m.kharcha_admin_senders_description()}
			tableId="admin-kharcha-senders"
			list={{ rows: senders }}
			columns={columns}
			getRowLabel={(row) => row.email}
			rowActions={(row) => [
				row.suspendedAt
					? {
							id: "restore",
							label: m.kharcha_admin_restore(),
							permission: "kharcha:configure",
							onSelect: () =>
								suspend.mutate(
									{ userId: row.id, suspend: false },
									{ onSuccess: () => toast.success(m.kharcha_admin_toast_restored({ email: row.email })) },
								),
						}
					: {
							id: "suspend",
							label: m.kharcha_admin_suspend(),
							permission: "kharcha:configure",
							destructive: true,
							onSelect: async () => {
								const confirmed = await confirm({
									title: m.kharcha_admin_suspend_title({ email: row.email }),
									description: m.kharcha_admin_suspend_body(),
									confirmLabel: m.kharcha_admin_suspend(),
									destructive: true,
								});
								if (confirmed) {
									suspend.mutate(
										{ userId: row.id, suspend: true },
										{ onSuccess: () => toast.success(m.kharcha_admin_toast_suspended({ email: row.email })) },
									);
								}
							},
						},
			]}
			empty={{ description: m.kharcha_admin_senders_empty() }}
			exportName="kharcha-senders"
			data-testid="kharcha-admin-senders"
		/>
	);
}
