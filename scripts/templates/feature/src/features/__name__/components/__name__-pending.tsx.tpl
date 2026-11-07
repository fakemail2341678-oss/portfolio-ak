import { CrudListPending } from "@/components/crud/crud-list-page";
import { NewButton } from "@/components/crud/new-button";
import { m } from "@/paraglide/messages";
import { __camel__Columns } from "../columns";

/** "New row", for users who may create (a component: messages are read at render time). */
export function New__Pascal__Button() {
	return (
		<NewButton to="/admin/__name__/new" permission="__name__:create">
			{m.__snake___new()}
		</NewButton>
	);
}

/** The list's pendingComponent: its header and a table skeleton (filter changes keep the page instead). */
export function __Pascal__Pending() {
	return (
		<CrudListPending
			title={m.__snake___title()}
			description={m.__snake___description()}
			actions={<New__Pascal__Button />}
			columns={__camel__Columns.length}
		/>
	);
}
