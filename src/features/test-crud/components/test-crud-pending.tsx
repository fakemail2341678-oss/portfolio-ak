import { CrudListPending } from "@/components/crud/crud-list-page";
import { NewButton } from "@/components/crud/new-button";
import { m } from "@/paraglide/messages";
import { testCrudColumns } from "../columns";

/** "New item", for users who may create (a component: messages are read at render time). */
export function NewTestCrudButton() {
	return (
		<NewButton to="/admin/test-crud/new" permission="test-crud:create">
			{m.test_crud_new()}
		</NewButton>
	);
}

/** The list's pendingComponent: its header and a table skeleton (filter changes keep the page instead). */
export function TestCrudPending() {
	return (
		<CrudListPending
			title={m.test_crud_title()}
			description={m.test_crud_admin_description()}
			actions={<NewTestCrudButton />}
			columns={testCrudColumns.length}
		/>
	);
}
