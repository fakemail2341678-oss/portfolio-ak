import { getRouteApi, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { CrudListPage } from "@/components/crud/crud-list-page";
import { patchRow, useCrudMutation, withoutRows } from "@/components/crud/use-crud-mutation";
import type { RowAction } from "@/components/data-table";
import { useCan } from "@/features/rbac/can";
import { useListPage } from "@/hooks/use-list-page";
import { useListQuery } from "@/hooks/use-list-query";
import { m } from "@/paraglide/messages";
import { testCrudColumns } from "../columns";
import { TestCrudFilterControls, testCrudFilters } from "../filters";
import { testCrudKeys } from "../keys";
import { testCrudListQueryOptions, testCrudMutations, testCrudTagsQueryOptions } from "../queries";
import { TEST_CRUD_TABLE_ID, type TestCrudListItem, type TestCrudStatus } from "../schema";
import { TestCrudEditDialog } from "./edit-dialog";
import { EditItemLink } from "./masked-links";
import { NewTestCrudButton } from "./test-crud-pending";

const route = getRouteApi("/_admin/admin/test-crud/");

/**
 * /admin/test-crud: the reference list (docs/guides/crud.md). Publishing and
 * deleting show at once on every cached page and roll back if the server
 * refuses (useCrudMutation); `?edit=` opens the masked edit dialog.
 */
export function TestCrudList() {
	// `edit` only opens the dialog; the rest is the list's input.
	const { edit, ...search } = route.useSearch();
	const list = useListPage({ tableId: TEST_CRUD_TABLE_ID, search, query: testCrudListQueryOptions });
	const { data: tags = [] } = useListQuery(testCrudTagsQueryOptions());
	const canEdit = useCan("test-crud:update");

	const remove = useCrudMutation(testCrudMutations.delete(), {
		invalidate: [testCrudKeys.all],
		optimistic: { queryKey: testCrudKeys.lists(), update: withoutRows<TestCrudListItem> },
	});
	const setStatus = useCrudMutation(testCrudMutations.setStatus(), {
		invalidate: [testCrudKeys.all],
		optimistic: {
			queryKey: testCrudKeys.lists(),
			update: patchRow((row: TestCrudListItem, { status }: { id: string; status: TestCrudStatus }) => ({
				...row,
				status,
			})),
		},
	});
	const publish = (row: TestCrudListItem) => {
		const status = row.status === "published" ? "draft" : "published";
		setStatus.mutate(
			{ id: row.id, status },
			{
				onSuccess: () =>
					toast.success(status === "published" ? m.test_crud_toast_published() : m.test_crud_toast_unpublished()),
			},
		);
	};

	// Each action names its permission: users without it never see it (the server checks again).
	const rowActions = (row: TestCrudListItem): RowAction[] => [
		{
			id: "edit-dialog",
			label: m.test_crud_edit_in_dialog(),
			permission: "test-crud:update",
			render: (label) => <EditItemLink id={row.id}>{label}</EditItemLink>,
		},
		{
			id: "edit",
			label: m.crud_edit(),
			permission: "test-crud:update",
			render: (label) => (
				<Link to="/admin/test-crud/$id" params={{ id: row.id }}>
					{label}
				</Link>
			),
		},
		{
			id: "publish",
			label: row.status === "published" ? m.test_crud_unpublish() : m.test_crud_publish(),
			permission: "test-crud:publish",
			onSelect: () => publish(row),
		},
	];

	return (
		<CrudListPage
			title={m.test_crud_title()}
			description={m.test_crud_admin_description()}
			actions={<NewTestCrudButton />}
			tableId={TEST_CRUD_TABLE_ID}
			list={list}
			columns={testCrudColumns}
			getRowLabel={(row) => row.title}
			search={search}
			filters={{ controls: <TestCrudFilterControls search={search} tags={tags} />, ...testCrudFilters.applied(search) }}
			rowActions={rowActions}
			remove={{ permission: "test-crud:delete", run: (ids) => remove.mutateAsync(ids) }}
			empty={{
				description: m.test_crud_empty(),
				filtered: m.test_crud_empty_filtered(),
				action: <NewTestCrudButton />,
			}}
			exportName="test-crud"
			savedViews
			data-testid="test-crud-table"
		>
			{edit && canEdit ? <TestCrudEditDialog id={edit} /> : null}
		</CrudListPage>
	);
}
