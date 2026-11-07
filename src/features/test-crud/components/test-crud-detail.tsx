import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { crudFormKey } from "@/components/crud/use-crud-form";
import { Page, PageHeader } from "@/components/page/page";
import { m } from "@/paraglide/messages";
import { testCrudDetailQueryOptions } from "../queries";
import { TestCrudForm } from "./test-crud-form";

const editRoute = getRouteApi("/_admin/admin/test-crud/$id");

/** /admin/test-crud/new */
export function TestCrudNewPage() {
	return (
		<Page width="admin">
			<PageHeader title={m.test_crud_new_title()} />
			<TestCrudForm />
		</Page>
	);
}

/** /admin/test-crud/$id: the item from the loader's cache; a reloaded newer version remounts the form. */
export function TestCrudEditPage() {
	const { id } = editRoute.useParams();
	const { data: item } = useSuspenseQuery(testCrudDetailQueryOptions(id));
	return (
		<Page width="admin">
			<PageHeader title={m.test_crud_edit_title()} />
			<TestCrudForm key={crudFormKey(item)} item={item} />
		</Page>
	);
}
