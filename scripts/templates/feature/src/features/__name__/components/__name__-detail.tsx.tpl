import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { crudFormKey } from "@/components/crud/use-crud-form";
import { Page, PageHeader } from "@/components/page/page";
import { m } from "@/paraglide/messages";
import { __camel__DetailQueryOptions } from "../queries";
import { __Pascal__Form } from "./__name__-form";

const editRoute = getRouteApi("/_admin/admin/__name__/$id");

/** /admin/__name__/new */
export function __Pascal__NewPage() {
	return (
		<Page width="admin">
			<PageHeader title={m.__snake___new()} />
			<__Pascal__Form />
		</Page>
	);
}

/** /admin/__name__/$id: the row from the loader's cache; a reloaded newer version remounts the form. */
export function __Pascal__EditPage() {
	const { id } = editRoute.useParams();
	const { data: row } = useSuspenseQuery(__camel__DetailQueryOptions(id));
	return (
		<Page width="admin">
			<PageHeader title={m.__snake___edit_title()} />
			<__Pascal__Form key={crudFormKey(row)} row={row} />
		</Page>
	);
}
