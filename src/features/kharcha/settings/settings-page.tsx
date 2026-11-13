import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { ArchiveIcon, ArrowDownIcon, ArrowUpIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { lazy, type ReactNode, Suspense, useState } from "react";
import { toast } from "sonner";
import { useConfirm } from "@/components/dialogs/confirm";
import { errorMessage } from "@/components/errors/error-page";
import { MAIN_CONTENT } from "@/components/layout/skip-link";
import { SegmentNav } from "@/components/navigation/segment-nav";
import { Button } from "@/components/ui/button";
import {
	deleteKharchaCategory,
	deleteKharchaMethod,
	deleteKharchaRule,
	deleteKharchaTag,
	reorderKharchaCategories,
	reorderKharchaMethods,
	reorderKharchaRules,
} from "@/functions/kharcha/lists";
import { formatNumber } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import { CategoryIcon } from "../kit/category-icon";
import { kharchaLinks } from "../links";
import { kharchaKeys, kharchaListsQueryOptions, refreshKharcha } from "../queries";
import { SETTINGS_TABS, type SettingsTab } from "../search";
import { useKharchaUserId } from "../shell/actions";
import type { CategoryView, KharchaLists, MethodView, RuleView, TagView } from "../types";
import type { ListDialog } from "./list-dialogs";
import { ProfileForm } from "./profile-form";

const ListDialogs = lazy(() => import("./list-dialogs"));
const route = getRouteApi("/_kharcha/app/kharcha/_shell/settings/$tab");

export const SETTINGS_TAB_LABELS: Record<SettingsTab, () => string> = {
	profile: () => m.kharcha_settings_profile(),
	categories: () => m.kharcha_settings_categories(),
	tags: () => m.kharcha_settings_tags(),
	methods: () => m.kharcha_settings_methods(),
	rules: () => m.kharcha_settings_rules(),
};

/** Moves one item of a list up or down: the whole new order. */
const moved = (ids: ReadonlyArray<string>, index: number, by: number) => {
	const next = [...ids];
	const [item] = next.splice(index, 1);
	if (item !== undefined) next.splice(index + by, 0, item);
	return next;
};

/**
 * Settings (PLAN Task 89): the caller's own lists, a tab each. Categories (the built-ins
 * and their own: colours, icons, order, archive; deleting one leaves its expenses
 * uncategorized), tags, payment methods, and merchant rules (tried in order, the first
 * match wins). Everything is the caller's alone. Profile (Task 91): the home currency,
 * the time zone and the pay note. Notifications and recurring expenses arrive as tabs with their tasks.
 */
export function SettingsPage() {
	return <SettingsView tab={route.useParams().tab} />;
}

/** Settings at a tab (the route's, or a story's). */
export function SettingsView({ tab }: { tab: SettingsTab }) {
	const userId = useKharchaUserId();
	const { data: lists } = useSuspenseQuery(kharchaListsQueryOptions(userId));
	const queryClient = useQueryClient();
	const confirm = useConfirm();
	const [dialog, setDialog] = useState<ListDialog | null>(null);
	const change = useMutation({
		mutationFn: (run: () => Promise<KharchaLists>) => run(),
		onSuccess: (next) => {
			queryClient.setQueryData(kharchaKeys.lists(userId), next);
			void refreshKharcha(queryClient, userId);
		},
		onError: (error) => toast.error(errorMessage(error)),
	});
	const run = (work: () => Promise<KharchaLists>) => change.mutate(work);
	const ask = async (title: string, description: string, work: () => Promise<KharchaLists>) => {
		if (await confirm({ title, description, confirmLabel: m.kharcha_settings_delete(), destructive: true })) run(work);
	};

	return (
		<main {...MAIN_CONTENT} className="flex flex-1 flex-col" data-testid="kharcha-settings">
			<header className="flex flex-col gap-3 border-kh-hair border-b bg-kh-page px-4 py-4 sm:px-8 md:py-5">
				<h1 className="kh-display text-kh-title">{m.kharcha_nav_settings()}</h1>
				<SegmentNav
					label={m.kharcha_settings_tabs()}
					items={SETTINGS_TABS.map((value) => ({ value, label: SETTINGS_TAB_LABELS[value]() }))}
					current={tab}
					link={(value) => kharchaLinks.settings(value)}
					testId="kharcha-settings-tabs"
				/>
			</header>
			<div className="flex w-full max-w-3xl flex-col gap-4 px-4 py-4 sm:px-8 sm:py-6">
				{tab === "profile" ? <ProfileForm /> : null}
				{tab === "categories" ? (
					<Section
						description={m.kharcha_settings_categories_help()}
						add={m.kharcha_settings_add_category()}
						onAdd={() => setDialog({ kind: "category" })}
					>
						{lists.categories.map((category, index) => (
							<Item
								key={category.id}
								leading={<CategoryIcon icon={category.icon} color={category.color} />}
								title={category.name}
								meta={usedLabel(category)}
								archived={category.archived}
								position={{ index, count: lists.categories.length }}
								onMove={(by) =>
									run(() =>
										reorderKharchaCategories({
											data: {
												ids: moved(
													lists.categories.map((each) => each.id),
													index,
													by,
												),
											},
										}),
									)
								}
								onEdit={() => setDialog({ kind: "category", category })}
								onDelete={() =>
									void ask(
										m.kharcha_settings_delete_category({ name: category.name }),
										m.kharcha_settings_delete_category_body({ count: formatNumber(category.used) }),
										() => deleteKharchaCategory({ data: { id: category.id } }),
									)
								}
							/>
						))}
					</Section>
				) : null}
				{tab === "tags" ? (
					<Section
						description={m.kharcha_settings_tags_help()}
						add={m.kharcha_settings_add_tag()}
						onAdd={() => setDialog({ kind: "tag" })}
					>
						{lists.tags.map((tag) => (
							<Item
								key={tag.id}
								title={tag.name}
								meta={usedLabel(tag)}
								onEdit={() => setDialog({ kind: "tag", tag })}
								onDelete={() =>
									void ask(
										m.kharcha_settings_delete_tag({ name: tag.name }),
										m.kharcha_settings_delete_tag_body(),
										() => deleteKharchaTag({ data: { id: tag.id } }),
									)
								}
							/>
						))}
					</Section>
				) : null}
				{tab === "methods" ? (
					<Section
						description={m.kharcha_settings_methods_help()}
						add={m.kharcha_settings_add_method()}
						onAdd={() => setDialog({ kind: "method" })}
					>
						{lists.methods.map((method, index) => (
							<Item
								key={method.id}
								title={method.name}
								meta={usedLabel(method)}
								archived={method.archived}
								position={{ index, count: lists.methods.length }}
								onMove={(by) =>
									run(() =>
										reorderKharchaMethods({
											data: {
												ids: moved(
													lists.methods.map((each) => each.id),
													index,
													by,
												),
											},
										}),
									)
								}
								onEdit={() => setDialog({ kind: "method", method })}
								onDelete={() =>
									void ask(
										m.kharcha_settings_delete_method({ name: method.name }),
										m.kharcha_settings_delete_method_body(),
										() => deleteKharchaMethod({ data: { id: method.id } }),
									)
								}
							/>
						))}
					</Section>
				) : null}
				{tab === "rules" ? (
					<Section
						description={m.kharcha_settings_rules_help()}
						add={m.kharcha_settings_add_rule()}
						onAdd={() => setDialog({ kind: "rule" })}
					>
						{lists.rules.map((rule, index) => (
							<Item
								key={rule.id}
								title={ruleTitle(rule)}
								meta={ruleEffect(rule, lists)}
								position={{ index, count: lists.rules.length }}
								onMove={(by) =>
									run(() =>
										reorderKharchaRules({
											data: {
												ids: moved(
													lists.rules.map((each) => each.id),
													index,
													by,
												),
											},
										}),
									)
								}
								onEdit={() => setDialog({ kind: "rule", rule })}
								onDelete={() =>
									void ask(m.kharcha_settings_delete_rule(), m.kharcha_settings_delete_rule_body(), () =>
										deleteKharchaRule({ data: { id: rule.id } }),
									)
								}
							/>
						))}
					</Section>
				) : null}
			</div>
			{dialog ? (
				<Suspense fallback={null}>
					<ListDialogs
						dialog={dialog}
						lists={lists}
						onSaved={(next) => {
							queryClient.setQueryData(kharchaKeys.lists(userId), next);
							void refreshKharcha(queryClient, userId);
						}}
						onClose={() => setDialog(null)}
					/>
				</Suspense>
			) : null}
		</main>
	);
}

const usedLabel = (item: CategoryView | TagView | MethodView) =>
	item.used === 0 ? m.kharcha_settings_unused() : m.kharcha_settings_used({ count: formatNumber(item.used) });

const ruleTitle = (rule: RuleView) =>
	rule.match === "equals"
		? m.kharcha_rule_equals({ pattern: rule.pattern })
		: m.kharcha_rule_contains({ pattern: rule.pattern });

/** What a rule sets, in words: "Groceries · home, weekly · eSewa". */
function ruleEffect(rule: RuleView, lists: KharchaLists): string {
	const parts = [
		lists.categories.find((category) => category.id === rule.categoryId)?.name,
		rule.tagIds.flatMap((id) => lists.tags.filter((tag) => tag.id === id).map((tag) => tag.name)).join(", ") ||
			undefined,
		lists.methods.find((method) => method.id === rule.methodId)?.name,
	].filter((part): part is string => Boolean(part));
	return m.kharcha_rule_sets({ what: parts.join(" · ") });
}

function Section({
	description,
	add,
	onAdd,
	children,
}: {
	description: string;
	add: string;
	onAdd: () => void;
	children: ReactNode[];
}) {
	return (
		<section className="flex flex-col gap-3">
			<div className="flex flex-wrap items-start justify-between gap-3">
				<p className="max-w-prose text-kh-muted text-sm">{description}</p>
				<Button onClick={onAdd} data-testid="kharcha-settings-add">
					<PlusIcon aria-hidden />
					{add}
				</Button>
			</div>
			{children.length === 0 ? (
				<p className="rounded-lg border border-kh-hair border-dashed bg-kh-page px-4 py-6 text-center text-kh-muted text-sm">
					{m.kharcha_settings_empty()}
				</p>
			) : (
				<ul className="divide-y divide-kh-rule overflow-hidden rounded-lg border border-kh-hair bg-kh-page">
					{children}
				</ul>
			)}
		</section>
	);
}

function Item({
	leading,
	title,
	meta,
	archived = false,
	position,
	onMove,
	onEdit,
	onDelete,
}: {
	leading?: ReactNode;
	title: string;
	meta: string;
	archived?: boolean;
	position?: { index: number; count: number };
	onMove?: (by: number) => void;
	onEdit: () => void;
	onDelete: () => void;
}) {
	return (
		<li className="flex flex-wrap items-center gap-3 px-3 py-2.5 sm:px-4" data-testid="kharcha-settings-item">
			{leading}
			<div className="flex min-w-0 flex-1 flex-col">
				<span className="flex flex-wrap items-center gap-2 font-medium">
					<span className="wrap-anywhere">{title}</span>
					{archived ? (
						<span className="inline-flex items-center gap-1 rounded-sm border border-kh-hair px-1.5 font-normal text-[0.75rem] text-kh-muted">
							<ArchiveIcon className="size-3" aria-hidden />
							{m.kharcha_settings_archived()}
						</span>
					) : null}
				</span>
				<span className="text-caption text-kh-muted">{meta}</span>
			</div>
			<div className="flex items-center gap-0.5">
				{position && onMove ? (
					<>
						<Button variant="ghost" size="icon" onClick={() => onMove(-1)} disabled={position.index === 0}>
							<ArrowUpIcon aria-hidden />
							<span className="sr-only">{m.kharcha_settings_move_up({ name: title })}</span>
						</Button>
						<Button
							variant="ghost"
							size="icon"
							onClick={() => onMove(1)}
							disabled={position.index === position.count - 1}
						>
							<ArrowDownIcon aria-hidden />
							<span className="sr-only">{m.kharcha_settings_move_down({ name: title })}</span>
						</Button>
					</>
				) : null}
				<Button variant="ghost" size="icon" onClick={onEdit}>
					<PencilIcon aria-hidden />
					<span className="sr-only">{m.kharcha_settings_edit({ name: title })}</span>
				</Button>
				<Button variant="ghost" size="icon" onClick={onDelete}>
					<Trash2Icon aria-hidden />
					<span className="sr-only">{m.kharcha_settings_delete_named({ name: title })}</span>
				</Button>
			</div>
		</li>
	);
}
