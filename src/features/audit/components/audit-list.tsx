import { getRouteApi } from "@tanstack/react-router";
import { CrudListPage } from "@/components/crud/crud-list-page";
import { useListPage } from "@/hooks/use-list-page";
import { m } from "@/paraglide/messages";
import { auditColumns } from "../columns";
import { AuditFilterControls, auditFilters } from "../filters";
import { auditListQueryOptions } from "../queries";
import { AUDIT_TABLE_ID } from "../search";

const route = getRouteApi("/_admin/admin/audit/");

/** /admin/audit: the log, read only, newest first, filtered from the URL (decisions.md 0132). */
export function AuditList() {
	const search = route.useSearch();
	const list = useListPage({ tableId: AUDIT_TABLE_ID, search, query: auditListQueryOptions });
	return (
		<CrudListPage
			title={m.audit_title()}
			description={m.audit_description()}
			tableId={AUDIT_TABLE_ID}
			list={list}
			columns={auditColumns}
			getRowLabel={(row) => row.target.label || row.target.id}
			search={search}
			filters={{ controls: <AuditFilterControls search={search} />, ...auditFilters.applied(search) }}
			empty={{ description: m.audit_empty() }}
			exportName="audit"
			savedViews
			data-testid="audit-table"
		/>
	);
}
