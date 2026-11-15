import { searchTasklineAccounts } from "@/functions/taskline-admin/members";
import { tasklineAdminKeys } from "../keys";

/** The "Add people" picker's search (AsyncComboboxField, RelationField). */
export const accountSearch = {
	queryKey: tasklineAdminKeys.accounts(),
	search: (q: string) => searchTasklineAccounts({ data: { q } }),
};
