import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, Link } from "@tanstack/react-router";
import { ArrowLeftIcon, MoreHorizontalIcon, PencilIcon, PlusIcon, TagsIcon, Trash2Icon } from "lucide-react";
import { lazy, Suspense, useState } from "react";
import { toast } from "sonner";
import { useConfirm } from "@/components/dialogs/confirm";
import { errorMessage } from "@/components/errors/error-page";
import { EmptyState } from "@/components/page/empty-state";
import { Page, PageHeader } from "@/components/page/page";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatNumber } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import { expenseCategoriesQueryOptions, expenseMutations } from "../queries";
import { type CategoryWithUsage, EXPENSES_QUOTAS } from "../types";
import { CategoryIconMark } from "./category-label";

const CategoryDialog = lazy(() => import("./category-dialog"));

const route = getRouteApi("/_apps/apps/expenses/categories");

type Editing = { category?: CategoryWithUsage } | null;

/**
 * /apps/expenses/categories (decision 0192): the user's categories, each with how many
 * expenses it holds. Deleting one leaves its expenses uncategorized and drops its budgets.
 */
export function ExpenseCategoriesPage() {
	const { session } = route.useRouteContext();
	const userId = session.user.id;
	const queryClient = useQueryClient();
	const confirm = useConfirm();
	const { data: categories } = useSuspenseQuery(expenseCategoriesQueryOptions(userId));
	const create = useMutation(expenseMutations.createCategory(queryClient, userId));
	const update = useMutation(expenseMutations.updateCategory(queryClient, userId));
	const remove = useMutation(expenseMutations.deleteCategory(queryClient, userId));
	const [editing, setEditing] = useState<Editing>(null);
	const full = categories.length >= EXPENSES_QUOTAS.categories;

	const removeCategory = async (category: CategoryWithUsage) => {
		const confirmed = await confirm({
			title: m.crud_delete_title({ label: category.name }),
			description: m.expenses_category_delete_body({ count: formatNumber(category.expenses) }),
			confirmLabel: m.crud_delete(),
			destructive: true,
		});
		if (!confirmed) return;
		remove.mutate(category.id, {
			onSuccess: () => toast.success(m.crud_toast_deleted({ label: category.name })),
			onError: (error) => toast.error(m.common_toast_failed(), { description: errorMessage(error) }),
		});
	};

	const newButton = (
		<Button onClick={() => setEditing({})} disabled={full} data-testid="categories-new">
			<PlusIcon aria-hidden />
			{m.expenses_category_new()}
		</Button>
	);

	return (
		<Page width="default" data-testid="expense-categories">
			<Button asChild variant="ghost" size="sm" className="-ms-2 w-fit">
				<Link to="/apps/expenses">
					<ArrowLeftIcon aria-hidden className="rtl:rotate-180" />
					{m.expenses_back()}
				</Link>
			</Button>
			<PageHeader
				title={m.expenses_categories_title()}
				description={m.expenses_categories_count({
					count: formatNumber(categories.length),
					max: formatNumber(EXPENSES_QUOTAS.categories),
				})}
				actions={newButton}
			/>
			{categories.length === 0 ? (
				<EmptyState
					icon={TagsIcon}
					title={m.expenses_categories_empty_title()}
					description={m.expenses_categories_empty_body()}
					primaryAction={newButton}
				/>
			) : (
				<ul className="flex flex-col divide-y rounded-lg border bg-surface-1">
					{categories.map((category) => (
						<li key={category.id} className="flex items-center gap-3 p-3" data-testid="categories-row">
							<CategoryIconMark category={category} />
							<span className="min-w-0 flex-1 truncate font-medium text-sm">{category.name}</span>
							<span className="text-muted-foreground text-sm tabular-nums">
								{m.expenses_category_expenses({ count: formatNumber(category.expenses) })}
							</span>
							<DropdownMenu modal={false}>
								<DropdownMenuTrigger asChild>
									<Button variant="ghost" size="icon" aria-label={m.expenses_category_actions({ name: category.name })}>
										<MoreHorizontalIcon aria-hidden />
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent align="end">
									<DropdownMenuItem onSelect={() => setEditing({ category })}>
										<PencilIcon aria-hidden />
										{m.expenses_category_edit()}
									</DropdownMenuItem>
									<DropdownMenuSeparator />
									<DropdownMenuItem variant="destructive" onSelect={() => void removeCategory(category)}>
										<Trash2Icon aria-hidden />
										{m.crud_delete()}
									</DropdownMenuItem>
								</DropdownMenuContent>
							</DropdownMenu>
						</li>
					))}
				</ul>
			)}
			<Suspense fallback={null}>
				{editing ? (
					<CategoryDialog
						category={editing.category}
						onSubmit={async (values) => {
							if (editing.category) {
								await update.mutateAsync({ id: editing.category.id, ...values });
								toast.success(m.crud_toast_saved());
							} else {
								await create.mutateAsync({ id: crypto.randomUUID(), ...values });
								toast.success(m.expenses_toast_category_created({ name: values.name }));
							}
						}}
						onClose={() => setEditing(null)}
					/>
				) : null}
			</Suspense>
		</Page>
	);
}
