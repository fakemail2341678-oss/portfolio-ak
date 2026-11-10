import { formOptions } from "@tanstack/react-form";
import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, linkOptions } from "@tanstack/react-router";
import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { type ReactNode, useState } from "react";
import { toast } from "sonner";
import { useCrudMutation } from "@/components/crud/use-crud-mutation";
import { StatusOf } from "@/components/data-display/status-badge";
import { useConfirm } from "@/components/dialogs/confirm";
import { formValidators, handleSaveError, useAppForm } from "@/components/forms";
import { LocalizedField } from "@/components/forms/fields/localized-fields";
import { moveItem, SortableList } from "@/components/forms/fields/sortable-list";
import { SegmentNav } from "@/components/navigation/segment-nav";
import { Page, PageHeader } from "@/components/page/page";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useCan } from "@/features/rbac/can";
import { isoDateInstant } from "@/lib/i18n/date-only";
import { formatDate } from "@/lib/i18n/intl";
import { localizedValue } from "@/lib/i18n/localized";
import { m } from "@/paraglide/messages";
import { type ChaalFeaturedSection, type ChaalHomeSectionKey, SECTION_KINDS } from "../../home/curation";
import { chaalKeys } from "../../keys";
import { CURATION_TAB_LABELS, FEATURED_KIND_LABELS, FEATURED_STATES, HOME_SECTION_LABELS } from "../labels";
import { chaalAdminMutations, chaalCurationQueryOptions } from "../queries";
import { type ChaalAdminCuration, type ChaalAdminFeatured, chaalAnnouncementInput } from "../schema";
import { CHAAL_CURATION_TABS, type ChaalCurationTab } from "../search";
import { FeaturedDialog } from "./featured-dialog";

const route = getRouteApi("/_admin/admin/chaal/curation");

const day = (value: string) => formatDate(isoDateInstant(value), { dateStyle: "medium" });

/** When an item shows: its dates, or always. */
function dates(item: ChaalAdminFeatured) {
	if (item.startsOn && item.endsOn)
		return m.ch_admin_featured_between({ from: day(item.startsOn), to: day(item.endsOn) });
	if (item.startsOn) return m.ch_admin_featured_from({ from: day(item.startsOn) });
	if (item.endsOn) return m.ch_admin_featured_until({ to: day(item.endsOn) });
	return m.ch_admin_featured_always();
}

function FeaturedRow({
	item,
	number,
	handle,
	actions,
}: {
	item: ChaalAdminFeatured;
	number: number;
	handle?: ReactNode;
	actions?: ReactNode;
}) {
	return (
		<div className="flex flex-wrap items-center gap-3 rounded-md border bg-card p-2" data-testid="chaal-featured-row">
			{handle}
			<span className="w-6 text-end text-muted-foreground text-sm tabular-nums">{number}</span>
			<span className="flex min-w-0 flex-1 flex-col">
				<span className="truncate font-medium">{localizedValue(item.title)}</span>
				<span className="truncate text-muted-foreground text-sm">
					{FEATURED_KIND_LABELS[item.kind]()} ·{" "}
					<span lang="en" dir="ltr" className="font-mono">
						{item.ref}
					</span>{" "}
					· {dates(item)}
				</span>
			</span>
			<StatusOf status={item.state} map={FEATURED_STATES} />
			{actions}
		</div>
	);
}

/** One section's featured items: added and changed in a dialog, reordered by dragging, deleted after a confirm. */
function FeaturedList({ section, items }: { section: ChaalFeaturedSection; items: ReadonlyArray<ChaalAdminFeatured> }) {
	const canCurate = useCan("chaal:curate");
	const confirm = useConfirm();
	const [order, setOrder] = useState<ReadonlyArray<ChaalAdminFeatured> | null>(null);
	const [editing, setEditing] = useState<ChaalAdminFeatured | "new" | null>(null);
	const shown = order ?? items;
	const reorder = useCrudMutation(chaalAdminMutations.reorderFeatured(), { invalidate: [chaalKeys.adminCuration()] });
	const remove = useCrudMutation(chaalAdminMutations.deleteFeatured(), { invalidate: [chaalKeys.adminCuration()] });
	const saveOrder = () =>
		reorder.mutate(
			{ section, ids: shown.map((item) => item.id) },
			{
				onSuccess: () => {
					toast.success(m.ch_admin_featured_order_saved());
					setOrder(null);
				},
			},
		);
	const askDelete = async (item: ChaalAdminFeatured) => {
		const yes = await confirm({
			title: m.ch_admin_featured_delete_title(),
			description: m.ch_admin_featured_delete_description({ title: localizedValue(item.title) }),
			confirmLabel: m.crud_delete(),
			destructive: true,
		});
		if (yes) remove.mutate([item.id], { onSuccess: () => toast.success(m.ch_admin_featured_deleted()) });
	};
	const actions = (item: ChaalAdminFeatured) =>
		canCurate ? (
			<span className="flex gap-1">
				<Button
					variant="ghost"
					size="icon"
					aria-label={m.ch_admin_featured_edit({ title: localizedValue(item.title) })}
					onClick={() => setEditing(item)}
				>
					<PencilIcon aria-hidden />
				</Button>
				<Button
					variant="ghost"
					size="icon"
					aria-label={m.ch_admin_featured_delete({ title: localizedValue(item.title) })}
					onClick={() => void askDelete(item)}
				>
					<Trash2Icon aria-hidden />
				</Button>
			</span>
		) : null;
	return (
		<section className="flex flex-col gap-4" data-testid={`chaal-featured-${section}`}>
			<div className="flex flex-wrap items-center justify-between gap-3">
				<p className="max-w-prose text-muted-foreground text-sm">{m.ch_admin_featured_hint()}</p>
				{canCurate ? (
					<Button onClick={() => setEditing("new")} data-testid="chaal-featured-add">
						<PlusIcon aria-hidden />
						{m.ch_admin_featured_add()}
					</Button>
				) : null}
			</div>
			{shown.length === 0 ? (
				<p className="rounded-md border border-dashed p-6 text-center text-muted-foreground">
					{m.ch_admin_featured_empty()}
				</p>
			) : canCurate ? (
				<>
					<SortableList
						items={shown}
						getId={(item) => item.id}
						getLabel={(item) => localizedValue(item.title)}
						onMove={(from, to) => setOrder(moveItem(shown, from, to))}
						renderItem={(item, index, handle) => (
							<FeaturedRow item={item} number={index + 1} handle={handle} actions={actions(item)} />
						)}
					/>
					<div className="flex items-center justify-end gap-2">
						<Button variant="ghost" disabled={!order || reorder.isPending} onClick={() => setOrder(null)}>
							{m.common_cancel()}
						</Button>
						<Button disabled={!order || reorder.isPending} onClick={saveOrder} data-testid="chaal-featured-save-order">
							{reorder.isPending ? m.crud_saving() : m.ch_admin_featured_save_order()}
						</Button>
					</div>
				</>
			) : (
				<ol className="flex flex-col gap-2">
					{shown.map((item, index) => (
						<li key={item.id}>
							<FeaturedRow item={item} number={index + 1} />
						</li>
					))}
				</ol>
			)}
			{editing ? (
				<FeaturedDialog
					section={section}
					item={editing === "new" ? undefined : editing}
					onClose={() => setEditing(null)}
				/>
			) : null}
		</section>
	);
}

/** The home's sections: dragged into order, each with a switch; saved together. */
function SectionsEditor({ sections }: { sections: ChaalAdminCuration["sections"] }) {
	const canCurate = useCan("chaal:curate");
	const [edited, setEdited] = useState<ChaalAdminCuration["sections"] | null>(null);
	const items = edited ?? sections;
	const save = useCrudMutation(chaalAdminMutations.saveSections(), { invalidate: [chaalKeys.adminCuration()] });
	const toggle = (key: ChaalHomeSectionKey, visible: boolean) =>
		setEdited(items.map((section) => (section.key === key ? { ...section, visible } : section)));
	const row = (section: ChaalAdminCuration["sections"][number], index: number, handle?: ReactNode) => (
		<div className="flex items-center gap-3 rounded-md border bg-card p-2" data-testid="chaal-home-section">
			{handle}
			<span className="w-6 text-end text-muted-foreground text-sm tabular-nums">{index + 1}</span>
			<span className="min-w-0 flex-1 truncate font-medium">{HOME_SECTION_LABELS[section.key]()}</span>
			<Switch
				checked={section.visible}
				disabled={!canCurate}
				aria-label={m.ch_admin_home_show({ section: HOME_SECTION_LABELS[section.key]() })}
				onCheckedChange={(visible) => toggle(section.key, visible)}
			/>
		</div>
	);
	return (
		<section aria-labelledby="ch-curation-sections" className="flex flex-col gap-3 rounded-lg border p-4">
			<h2 id="ch-curation-sections" className="text-heading">
				{m.ch_admin_home_sections_title()}
			</h2>
			<p className="text-muted-foreground text-sm">{m.ch_admin_home_sections_hint()}</p>
			{canCurate ? (
				<>
					<SortableList
						items={items}
						getId={(section) => section.key}
						getLabel={(section) => HOME_SECTION_LABELS[section.key]()}
						onMove={(from, to) => setEdited(moveItem(items, from, to))}
						renderItem={(section, index, handle) => row(section, index, handle)}
					/>
					<div className="flex items-center justify-end gap-2">
						<Button variant="ghost" disabled={!edited || save.isPending} onClick={() => setEdited(null)}>
							{m.common_cancel()}
						</Button>
						<Button
							disabled={!edited || save.isPending}
							onClick={() =>
								save.mutate([...items], {
									onSuccess: () => {
										toast.success(m.ch_admin_home_saved());
										setEdited(null);
									},
								})
							}
							data-testid="chaal-home-sections-save"
						>
							{save.isPending ? m.crud_saving() : m.crud_save()}
						</Button>
					</div>
				</>
			) : (
				<ol className="flex flex-col gap-2">
					{items.map((section, index) => (
						<li key={section.key}>{row(section, index)}</li>
					))}
				</ol>
			)}
		</section>
	);
}

/** The announcement at the top of the home's sections; empty English hides it. */
function AnnouncementForm({ announcement }: { announcement: ChaalAdminCuration["announcement"] }) {
	const canCurate = useCan("chaal:curate");
	const save = useCrudMutation(chaalAdminMutations.saveAnnouncement(), { invalidate: [chaalKeys.adminCuration()] });
	const form = useAppForm({
		...formOptions({ defaultValues: { announcement }, validators: formValidators(chaalAnnouncementInput) }),
		onSubmit: async ({ value, formApi }) => {
			try {
				const saved = await save.mutateAsync(chaalAnnouncementInput.parse(value).announcement);
				formApi.reset({ announcement: saved });
				toast.success(m.ch_admin_announcement_saved());
			} catch (error) {
				handleSaveError(formApi, error);
			}
		},
	});
	return (
		<section aria-labelledby="ch-curation-announcement" className="flex flex-col gap-3 rounded-lg border p-4">
			<h2 id="ch-curation-announcement" className="text-heading">
				{m.ch_home_section_announcement()}
			</h2>
			<form
				method="post"
				className="flex flex-col gap-4"
				onSubmit={(event) => {
					event.preventDefault();
					void form.handleSubmit();
				}}
				data-testid="chaal-announcement-form"
			>
				<LocalizedField
					form={form}
					fields="announcement"
					label={m.ch_admin_announcement_label()}
					description={m.ch_admin_announcement_hint()}
					maxLength={280}
					optional
					multiline
				/>
				{canCurate ? (
					<form.Subscribe selector={(state) => state.isSubmitting}>
						{(submitting) => (
							<Button type="submit" className="self-end" disabled={submitting}>
								{submitting ? m.crud_saving() : m.crud_save()}
							</Button>
						)}
					</form.Subscribe>
				) : null}
			</form>
		</section>
	);
}

/**
 * /admin/chaal/curation (PLAN Task 84, decision 0274): what Chaal's home features, a tab per
 * section, and the home's own tab with the sections' order and the announcement.
 */
export function ChaalCuration({ tab }: { tab: ChaalCurationTab }) {
	const { data } = useSuspenseQuery(chaalCurationQueryOptions());
	return (
		<Page width="admin" data-testid="chaal-curation">
			<PageHeader title={m.ch_admin_curation_title()} description={m.ch_admin_curation_description()} />
			<SegmentNav
				label={m.ch_admin_curation_nav()}
				items={CHAAL_CURATION_TABS.map((value) => ({ value, label: CURATION_TAB_LABELS[value]() }))}
				current={tab}
				link={(value) => linkOptions({ to: "/admin/chaal/curation", search: { tab: value } })}
				testId="chaal-curation-tabs"
			/>
			{tab === "home" ? (
				<div className="grid gap-4 lg:grid-cols-2">
					<SectionsEditor sections={data.sections} />
					<AnnouncementForm key={JSON.stringify(data.announcement)} announcement={data.announcement} />
				</div>
			) : (
				<FeaturedList
					key={tab}
					section={tab}
					items={data.featured.filter((item) => SECTION_KINDS[tab].includes(item.kind))}
				/>
			)}
		</Page>
	);
}

export function ChaalCurationPage() {
	const { tab } = route.useSearch();
	return <ChaalCuration tab={tab} />;
}
