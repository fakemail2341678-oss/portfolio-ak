import { Link, useNavigate } from "@tanstack/react-router";
import { CrudForm, useCrudForm } from "@/components/crud/use-crud-form";
import { useAppForm, withForm } from "@/components/forms";
import { SortableListField } from "@/components/forms/fields/list-fields";
import { LocalizedField } from "@/components/forms/fields/localized-fields";
import { SlugField, slugValidators } from "@/components/forms/fields/slug-field";
import { FormSection, StickyFormBar } from "@/components/page/form-layout";
import { Button } from "@/components/ui/button";
import { MediaField } from "@/features/media/components/media-field";
import { useCan } from "@/features/rbac/can";
import { isProjectSlugFree } from "@/functions/portfolio";
import { formatNumber } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import { COVER_MOTIFS, DISCIPLINES, PORTFOLIO_STATUSES } from "../../constants";
import { DISCIPLINE_LABELS } from "../../lib/labels";
import { PROJECT_MAX_GALLERY, type ProjectDetail, toProjectInput } from "../../schema";
import { projectKeys } from "../keys";
import { MOTIF_LABELS, STATUS_LABELS } from "../labels";
import { projectMutations } from "../queries";
import { CaseStudyBlocks } from "./case-study-blocks";
import { LinkFields, MetricFields } from "./field-groups";
import { projectFormOptions } from "./project-form-options";

const EMPTY = { en: "", ne: "" };

/** Who it was for, when, what, and whether it is live. */
const BasicsSection = withForm({
	...projectFormOptions(),
	props: { itemId: undefined as string | undefined },
	render: function BasicsSection({ form, itemId }) {
		const canPublish = useCan("portfolio:publish");
		return (
			<FormSection title={m.portfolio_admin_section_basics()}>
				<form.AppField name="title">
					{(field) => (
						<field.TextField
							label={m.portfolio_admin_field_project_title()}
							description={m.portfolio_admin_field_project_title_description()}
							maxLength={80}
						/>
					)}
				</form.AppField>
				<form.AppField
					name="slug"
					validators={slugValidators({
						from: "title",
						isAvailable: (slug) => isProjectSlugFree({ data: { slug, ...(itemId ? { id: itemId } : {}) } }),
					})}
				>
					{() => (
						<SlugField
							label={m.portfolio_admin_field_slug()}
							description={m.portfolio_admin_field_slug_description()}
							from="title"
							fromLabel={m.portfolio_admin_field_project_title()}
							linked={!itemId}
						/>
					)}
				</form.AppField>
				<LocalizedField form={form} fields="client" label={m.portfolio_admin_field_client()} maxLength={80} />
				<div className="grid gap-6 sm:grid-cols-2">
					<form.AppField name="year">
						{(field) => <field.NumberField label={m.portfolio_admin_field_year()} integer />}
					</form.AppField>
					<form.AppField name="featured">
						{(field) => (
							<field.SwitchField
								label={m.portfolio_admin_field_featured()}
								description={m.portfolio_admin_field_featured_description()}
							/>
						)}
					</form.AppField>
				</div>
				<form.AppField name="disciplines">
					{(field) => (
						<field.CheckboxGroupField
							label={m.portfolio_admin_field_disciplines()}
							options={DISCIPLINES.map((value) => ({ value, label: DISCIPLINE_LABELS[value]() }))}
						/>
					)}
				</form.AppField>
				<LocalizedField form={form} fields="role" label={m.portfolio_admin_field_role()} maxLength={80} />
				<LocalizedField form={form} fields="duration" label={m.portfolio_admin_field_duration()} maxLength={80} />
				<LocalizedField
					form={form}
					fields="summary"
					label={m.portfolio_admin_field_summary()}
					multiline
					maxLength={400}
				/>
				<form.AppField name="stack">
					{(field) => <field.TagsInputField label={m.portfolio_admin_field_stack()} optional />}
				</form.AppField>
				{/* apps:start */}
				<form.AppField name="appSlug">
					{(field) => (
						<field.TextField
							label={m.portfolio_admin_field_app()}
							description={m.portfolio_admin_field_app_description()}
							optional
							maxLength={40}
						/>
					)}
				</form.AppField>
				{/* apps:end */}
				{/* Changing the status takes portfolio:publish (the server checks it too). */}
				{canPublish ? (
					<form.AppField name="status">
						{(field) => (
							<field.RadioGroupField
								label={m.portfolio_admin_field_status()}
								options={PORTFOLIO_STATUSES.map((status) => ({ value: status, label: STATUS_LABELS[status]() }))}
							/>
						)}
					</form.AppField>
				) : null}
			</FormSection>
		);
	},
});

/** The cover: an uploaded image, or the generated art (a motif and a glyph). */
const CoverSection = withForm({
	...projectFormOptions(),
	render: function CoverSection({ form }) {
		return (
			<FormSection
				title={m.portfolio_admin_section_cover()}
				description={m.portfolio_admin_section_cover_description()}
			>
				<form.AppField name="cover">
					{() => <MediaField label={m.portfolio_admin_field_cover()} max={1} />}
				</form.AppField>
				<div className="grid gap-6 sm:grid-cols-2">
					<form.AppField name="motif">
						{(field) => (
							<field.SelectField
								label={m.portfolio_admin_field_motif()}
								options={COVER_MOTIFS.map((motif) => ({ value: motif, label: MOTIF_LABELS[motif]() }))}
							/>
						)}
					</form.AppField>
					<form.AppField name="glyph">
						{(field) => (
							<field.TextField
								label={m.portfolio_admin_field_glyph()}
								description={m.portfolio_admin_field_glyph_description()}
								maxLength={3}
							/>
						)}
					</form.AppField>
				</div>
				<form.AppField name="artSeed">
					{(field) => (
						<field.TextField
							label={m.portfolio_admin_field_art_seed()}
							description={m.portfolio_admin_field_art_seed_description()}
							optional
							maxLength={40}
						/>
					)}
				</form.AppField>
				<form.AppField name="gallery">
					{() => (
						<MediaField
							label={m.portfolio_admin_field_gallery()}
							description={m.portfolio_admin_field_gallery_description({ max: formatNumber(PROJECT_MAX_GALLERY) })}
							max={PROJECT_MAX_GALLERY}
						/>
					)}
				</form.AppField>
			</FormSection>
		);
	},
});

/** Numbers that tell the outcome, and links to the live thing. */
const OutcomesSection = withForm({
	...projectFormOptions(),
	render: function OutcomesSection({ form }) {
		const n = (index: number) => formatNumber(index + 1);
		return (
			<FormSection title={m.portfolio_admin_section_outcomes()}>
				<form.AppField name="metrics" mode="array">
					{() => (
						<SortableListField
							label={m.portfolio_admin_field_metrics()}
							optional
							addLabel={m.portfolio_admin_add_metric()}
							newItem={() => ({ value: 0, format: "number" as const, label: EMPTY })}
							getItemLabel={(metric, index) => metric.label.en || m.portfolio_admin_metric_n({ n: n(index) })}
							max={4}
							renderItem={({ index }) => <MetricFields form={form} fields={`metrics[${index}]`} />}
						/>
					)}
				</form.AppField>
				<form.AppField name="links" mode="array">
					{() => (
						<SortableListField
							label={m.portfolio_admin_field_links()}
							optional
							addLabel={m.portfolio_admin_add_link()}
							newItem={() => ({ label: EMPTY, href: "" })}
							getItemLabel={(link, index) => link.label.en || m.portfolio_admin_link_n({ n: n(index) })}
							max={6}
							renderItem={({ index }) => <LinkFields form={form} fields={`links[${index}]`} />}
						/>
					)}
				</form.AppField>
			</FormSection>
		);
	},
});

/**
 * Create and edit a project (docs/guides/crud.md): the shared kit's fields and
 * useCrudForm. The same Zod schema validates here and on the server; a taken
 * slug and unknown media come back on their fields, a stale save offers a reload.
 * Render it with key={crudFormKey(item)}.
 */
export function ProjectForm({ item }: { item?: ProjectDetail }) {
	const navigate = useNavigate();
	const crud = useCrudForm({
		item,
		toInput: toProjectInput,
		create: projectMutations.create(),
		update: projectMutations.update(),
		invalidate: [projectKeys.all],
		reload: item && projectKeys.detail(item.id),
		onSaved: () => navigate({ to: "/admin/portfolio/projects" }),
	});
	const form = useAppForm({ ...projectFormOptions(item), ...crud.formProps });

	return (
		<CrudForm form={form} crud={crud} className="max-w-5xl" data-testid="project-form">
			<BasicsSection form={form} itemId={item?.id} />
			<CoverSection form={form} />
			<OutcomesSection form={form} />
			<FormSection title={m.portfolio_admin_section_case_study()}>
				<CaseStudyBlocks form={form} />
			</FormSection>
			<StickyFormBar
				submitLabel={item ? m.crud_save() : m.crud_create()}
				pendingLabel={m.crud_saving()}
				cancel={
					<Button variant="ghost" asChild>
						<Link to="/admin/portfolio/projects">{m.crud_back()}</Link>
					</Button>
				}
			/>
		</CrudForm>
	);
}
