import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { DataTable } from "@/components/data-table";
import { m } from "@/paraglide/messages";
import { sampleAuditEvents } from "../../../../.storybook/mocks/data";
import { AuditChanges, auditColumns } from "../columns";
import { AUDIT_TABLE_ID } from "../search";

/** The audit log's real columns in the shared DataTable, as on /admin/audit. */
function AuditTable() {
	return (
		<DataTable
			tableId={AUDIT_TABLE_ID}
			rows={sampleAuditEvents}
			columns={auditColumns}
			getRowId={(row) => row.id}
			getRowLabel={(row) => row.target.label}
			sort="-time"
		/>
	);
}

const meta = {
	title: "Admin/Audit log",
	component: AuditTable,
	parameters: { app: { route: "/admin/audit" } },
} satisfies Meta<typeof AuditTable>;
export default meta;
type Story = StoryObj<typeof meta>;

/** An admin's change, an impersonated delete, and a row whose actor was deleted since. */
export const Table: Story = {
	play: async ({ canvas }) => {
		await expect(canvas.getByText(m.audit_action_role_permissions())).toBeVisible();
		await expect(canvas.getByText(m.audit_impersonated_by({ email: "admin@example.com" }))).toBeVisible();
		await expect(canvas.getByText(m.audit_deleted_account())).toBeVisible();
	},
};

/** Request id and IP hidden (saved preference). */
export const TableWithHiddenColumns: Story = {
	parameters: {
		app: { route: "/admin/audit", preferences: { tables: { [AUDIT_TABLE_ID]: { hiddenColumns: ["request", "ip"] } } } },
	},
};

/** Before → after per field; booleans and empty lists are words. */
export const Changes: Story = {
	render: () => (
		<AuditChanges
			before={{ name: "Editor", admin: false, roles: [] }}
			after={{ name: "Writer", admin: true, roles: ["Editor", "Reviewer"] }}
		/>
	),
	play: async ({ canvas }) => {
		await expect(canvas.getByText("Editor")).toBeVisible();
		await expect(canvas.getByText("Editor, Reviewer")).toBeVisible();
		await expect(canvas.getByText(m.audit_value_yes())).toBeVisible();
	},
};
