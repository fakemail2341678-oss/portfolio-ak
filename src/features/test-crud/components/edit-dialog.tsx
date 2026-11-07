import { Link } from "@tanstack/react-router";
import { ExternalLinkIcon } from "lucide-react";
import { crudFormKey } from "@/components/crud/use-crud-form";
import { QueryDialog } from "@/components/dialogs/query-dialog";
import { useCloseOverlay } from "@/components/navigation/use-close-overlay";
import { m } from "@/paraglide/messages";
import { testCrudDetailQueryOptions } from "../queries";
import { TestCrudForm } from "./test-crud-form";

const CLOSE = { edit: undefined };

/** The dialog for `?edit=<id>` (opened by EditItemLink, a masked route; see masked-links.tsx). */
export function TestCrudEditDialog({ id }: { id: string }) {
	const close = useCloseOverlay(CLOSE);
	return (
		<QueryDialog
			query={testCrudDetailQueryOptions(id)}
			onClose={close}
			title={m.test_crud_edit_title()}
			description={(item) => (
				<span className="flex flex-wrap items-center gap-x-3 gap-y-1">
					<span>{item?.title ?? m.test_crud_loading_item()}</span>
					<Link
						to="/admin/test-crud/$id"
						params={{ id }}
						className="inline-flex items-center gap-1 underline underline-offset-4"
					>
						{m.test_crud_open_full_page()}
						<ExternalLinkIcon className="size-3.5" aria-hidden />
					</Link>
				</span>
			)}
			loading={m.test_crud_loading_item()}
			className="sm:max-w-3xl"
			data-testid="edit-dialog"
		>
			{/* Another item, or a reloaded newer version, gets fresh form defaults. */}
			{(item) => (
				<TestCrudForm key={crudFormKey(item)} item={item} onSaved={close} onCancel={close} className="max-w-none" />
			)}
		</QueryDialog>
	);
}
