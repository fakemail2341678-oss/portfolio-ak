import { CopyButton } from "@/components/data-display/copy-button";
import { UserCell } from "@/components/data-display/user-avatar";
import type { DataTableColumn } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import { AUDIT_ACTION_LABELS, AUDIT_FIELD_LABELS, AUDIT_TARGET_LABELS } from "./labels";
import type { AuditEventItem, AuditValue, AuditValues } from "./schema";

/** A summarized value as text: booleans and empty lists localized, lists comma-separated. */
const valueText = (value: AuditValue | undefined): string => {
	if (value === undefined || value === null || value === "") return m.audit_value_none();
	if (typeof value === "boolean") return value ? m.audit_value_yes() : m.audit_value_no();
	if (Array.isArray(value)) return value.length === 0 ? m.audit_value_none() : value.join(", ");
	return String(value);
};

/** One line per field the action touched: "Name: Editor → Writer", or just the new or old value. */
export function AuditChanges({ before, after }: { before: AuditValues | null; after: AuditValues | null }) {
	const fields = [...new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])];
	if (fields.length === 0) return null;
	return (
		<dl className="flex flex-col gap-0.5 text-sm">
			{fields.map((field) => {
				const label = AUDIT_FIELD_LABELS[field]?.() ?? field;
				const from = before && field in before ? valueText(before[field]) : null;
				const to = after && field in after ? valueText(after[field]) : null;
				return (
					<div key={field} className="flex min-w-0 flex-wrap gap-x-1">
						<dt className="text-muted-foreground">{label}:</dt>
						<dd className="min-w-0 break-words">
							{from !== null && to !== null ? (
								<>
									<del className="text-muted-foreground">{from}</del>
									<span aria-hidden> → </span>
									<ins className="no-underline">{to}</ins>
								</>
							) : (
								(to ?? from)
							)}
						</dd>
					</div>
				);
			})}
		</dl>
	);
}

/** Columns of /admin/audit. */
export const auditColumns: ReadonlyArray<DataTableColumn<AuditEventItem>> = [
	{
		id: "time",
		header: m.audit_col_time,
		sort: "time",
		cellClassName: "whitespace-nowrap text-muted-foreground text-sm",
		cell: (row) => formatDate(row.createdAt, { dateStyle: "medium", timeStyle: "medium" }),
		csv: (row) => row.createdAt,
	},
	{
		id: "actor",
		header: m.audit_col_actor,
		cellClassName: "max-w-60",
		csv: (row) => row.actor.email,
		cell: (row) => (
			<UserCell
				name={row.actor.name || row.actor.email}
				email={row.actor.email}
				detail={
					<>
						{row.actor.id === null ? m.audit_deleted_account() : row.actor.email}
						{row.impersonator ? (
							<span className="block truncate">{m.audit_impersonated_by({ email: row.impersonator })}</span>
						) : null}
					</>
				}
			/>
		),
	},
	{
		id: "action",
		header: m.audit_col_action,
		cell: (row) => <Badge variant="secondary">{AUDIT_ACTION_LABELS[row.action]?.() ?? row.action}</Badge>,
		csv: (row) => AUDIT_ACTION_LABELS[row.action]?.() ?? row.action,
	},
	{
		id: "target",
		header: m.audit_col_target,
		cellClassName: "max-w-60",
		csv: (row) => row.target.label || row.target.id,
		cell: (row) => (
			<div className="flex min-w-0 flex-col">
				<span className="truncate">{row.target.label || row.target.id}</span>
				<span className="truncate text-muted-foreground text-xs">
					{AUDIT_TARGET_LABELS[row.target.type]?.() ?? row.target.type}
				</span>
			</div>
		),
	},
	{
		id: "changes",
		header: m.audit_col_changes,
		cellClassName: "min-w-48 max-w-96",
		cell: (row) => <AuditChanges before={row.before} after={row.after} />,
	},
	{
		id: "request",
		header: m.audit_col_request,
		hideable: true,
		cellClassName: "font-mono text-muted-foreground text-xs",
		csv: (row) => row.requestId,
		cell: (row) =>
			row.requestId ? (
				<span className="inline-flex items-center gap-1">
					{row.requestId}
					<CopyButton value={row.requestId} label={m.audit_copy_request()} />
				</span>
			) : null,
	},
	{
		id: "ip",
		header: m.audit_col_ip,
		hideable: true,
		cellClassName: "font-mono text-muted-foreground text-xs",
		csv: (row) => row.ip,
		cell: (row) => row.ip,
	},
];
