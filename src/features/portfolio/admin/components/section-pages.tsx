import { formOptions } from "@tanstack/react-form";
import { useCrudForm } from "@/components/crud/use-crud-form";
import { StatusBadge } from "@/components/data-display/status-badge";
import { FormSheet } from "@/components/dialogs/form-dialog";
import { formValidators, useAppForm } from "@/components/forms";
import { SortableListField } from "@/components/forms/fields/list-fields";
import { LocalizedField } from "@/components/forms/fields/localized-fields";
import { formatNumber } from "@/lib/i18n/intl";
import { localizedValue } from "@/lib/i18n/localized";
import { m } from "@/paraglide/messages";
import {
	type ExperienceInput,
	type ExperienceItem,
	experienceInputSchema,
	type ProcessStepInput,
	type ProcessStepItem,
	processStepInputSchema,
	type SkillInput,
	type SkillItem,
	skillInputSchema,
	type TestimonialInput,
	type TestimonialItem,
	testimonialInputSchema,
} from "../../schema";
import { experienceSection, processSection, skillSection, testimonialSection } from "../queries";
import { OrderedSection, type SectionSheetProps } from "./ordered-section";

/**
 * The four ordered sections' pages (/admin/portfolio/experience, skills,
 * process and testimonials): OrderedSection plus each one's sheet. The sheets
 * save through useCrudForm (the same schema as the server, a stale edit offers
 * a reload).
 */

const EMPTY = { en: "", ne: "" };

// Experience ------------------------------------------------------------------

const experienceOptions = (item?: ExperienceItem) =>
	formOptions({
		defaultValues: {
			company: item?.company ?? "",
			role: item?.role ?? EMPTY,
			start: item?.start ?? "",
			end: item?.end ?? "",
			location: item?.location ?? EMPTY,
			summary: item?.summary ?? EMPTY,
		} as ExperienceInput,
		validators: formValidators(experienceInputSchema),
	});

function ExperienceSheet({ item, onClose }: SectionSheetProps<ExperienceItem>) {
	const crud = useCrudForm({
		item,
		toInput: (values: ExperienceInput) => experienceInputSchema.parse(values),
		create: experienceSection.create(),
		update: experienceSection.update(),
		invalidate: [experienceSection.keys.all],
		reload: experienceSection.keys.all,
		onSaved: onClose,
	});
	const form = useAppForm({ ...experienceOptions(item), ...crud.formProps });
	return (
		<form.AppForm>
			<FormSheet
				title={item ? m.portfolio_admin_experience_edit() : m.portfolio_admin_experience_new()}
				submitLabel={item ? m.crud_save() : m.crud_create()}
				pendingLabel={m.crud_saving()}
				onClose={onClose}
				stale={crud.stale}
				data-testid="experience-sheet"
			>
				<form.AppField name="company">
					{(field) => <field.TextField label={m.portfolio_admin_field_company()} maxLength={80} />}
				</form.AppField>
				<LocalizedField form={form} fields="role" label={m.portfolio_admin_field_role()} maxLength={80} />
				<div className="grid gap-6 sm:grid-cols-2">
					<form.AppField name="start">
						{(field) => (
							<field.TextField
								label={m.portfolio_admin_field_start()}
								description={m.portfolio_admin_field_month_description()}
								placeholder="2021-04"
								maxLength={7}
							/>
						)}
					</form.AppField>
					<form.AppField name="end">
						{(field) => (
							<field.TextField
								label={m.portfolio_admin_field_end()}
								description={m.portfolio_admin_field_end_description()}
								placeholder="2024-09"
								optional
								maxLength={7}
							/>
						)}
					</form.AppField>
				</div>
				<LocalizedField form={form} fields="location" label={m.portfolio_admin_field_location()} maxLength={80} />
				<LocalizedField
					form={form}
					fields="summary"
					label={m.portfolio_admin_field_summary()}
					multiline
					maxLength={600}
				/>
			</FormSheet>
		</form.AppForm>
	);
}

export function ExperiencePage() {
	return (
		<OrderedSection<ExperienceInput, ExperienceItem>
			title={m.portfolio_admin_experience_title()}
			description={m.portfolio_admin_experience_description()}
			queries={experienceSection}
			label={(item) => item.company}
			detail={(item) => `${localizedValue(item.role)} · ${item.start} – ${item.end || m.portfolio_about_present()}`}
			addLabel={m.portfolio_admin_experience_new()}
			empty={m.portfolio_admin_section_empty()}
			Sheet={ExperienceSheet}
			data-testid="experience-list"
		/>
	);
}

// Skills ----------------------------------------------------------------------

const skillOptions = (item?: SkillItem) =>
	formOptions({
		defaultValues: {
			title: item?.title ?? EMPTY,
			summary: item?.summary ?? EMPTY,
			skills: item?.skills ?? [],
		} as SkillInput,
		validators: formValidators(skillInputSchema),
	});

function SkillSheet({ item, onClose }: SectionSheetProps<SkillItem>) {
	const crud = useCrudForm({
		item,
		toInput: (values: SkillInput) => skillInputSchema.parse(values),
		create: skillSection.create(),
		update: skillSection.update(),
		invalidate: [skillSection.keys.all],
		reload: skillSection.keys.all,
		onSaved: onClose,
	});
	const form = useAppForm({ ...skillOptions(item), ...crud.formProps });
	return (
		<form.AppForm>
			<FormSheet
				title={item ? m.portfolio_admin_skills_edit() : m.portfolio_admin_skills_new()}
				submitLabel={item ? m.crud_save() : m.crud_create()}
				pendingLabel={m.crud_saving()}
				onClose={onClose}
				stale={crud.stale}
				data-testid="skill-sheet"
			>
				<LocalizedField form={form} fields="title" label={m.portfolio_admin_field_title()} maxLength={80} />
				<LocalizedField
					form={form}
					fields="summary"
					label={m.portfolio_admin_field_summary()}
					multiline
					maxLength={400}
				/>
				<form.AppField name="skills">
					{(field) => (
						<field.TagsInputField
							label={m.portfolio_admin_field_skills()}
							description={m.portfolio_admin_field_skills_description()}
						/>
					)}
				</form.AppField>
			</FormSheet>
		</form.AppForm>
	);
}

export function SkillsPage() {
	return (
		<OrderedSection<SkillInput, SkillItem>
			title={m.portfolio_admin_skills_title()}
			description={m.portfolio_admin_skills_description()}
			queries={skillSection}
			label={(item) => localizedValue(item.title)}
			detail={(item) => item.skills.join(", ")}
			addLabel={m.portfolio_admin_skills_new()}
			empty={m.portfolio_admin_section_empty()}
			Sheet={SkillSheet}
			data-testid="skills-list"
		/>
	);
}

// Process ---------------------------------------------------------------------

const processOptions = (item?: ProcessStepItem) =>
	formOptions({
		defaultValues: {
			title: item?.title ?? EMPTY,
			body: item?.body ?? EMPTY,
			outputs: item?.outputs ?? [],
		} as ProcessStepInput,
		validators: formValidators(processStepInputSchema),
	});

function ProcessSheet({ item, onClose }: SectionSheetProps<ProcessStepItem>) {
	const crud = useCrudForm({
		item,
		toInput: (values: ProcessStepInput) => processStepInputSchema.parse(values),
		create: processSection.create(),
		update: processSection.update(),
		invalidate: [processSection.keys.all],
		reload: processSection.keys.all,
		onSaved: onClose,
	});
	const form = useAppForm({ ...processOptions(item), ...crud.formProps });
	const n = (index: number) => formatNumber(index + 1);
	return (
		<form.AppForm>
			<FormSheet
				title={item ? m.portfolio_admin_process_edit() : m.portfolio_admin_process_new()}
				submitLabel={item ? m.crud_save() : m.crud_create()}
				pendingLabel={m.crud_saving()}
				onClose={onClose}
				stale={crud.stale}
				data-testid="process-sheet"
			>
				<LocalizedField form={form} fields="title" label={m.portfolio_admin_field_title()} maxLength={80} />
				<LocalizedField
					form={form}
					fields="body"
					label={m.portfolio_admin_field_description()}
					multiline
					maxLength={600}
				/>
				<form.AppField name="outputs" mode="array">
					{() => (
						<SortableListField<{ en: string; ne: string }>
							label={m.portfolio_admin_field_outputs()}
							optional
							addLabel={m.portfolio_admin_add_output()}
							newItem={() => EMPTY}
							getItemLabel={(output, index) => output.en || m.portfolio_admin_output_n({ n: n(index) })}
							max={8}
							renderItem={({ index }) => (
								<LocalizedField
									form={form}
									fields={`outputs[${index}]`}
									label={m.portfolio_admin_output_n({ n: n(index) })}
									maxLength={80}
								/>
							)}
						/>
					)}
				</form.AppField>
			</FormSheet>
		</form.AppForm>
	);
}

export function ProcessPage() {
	return (
		<OrderedSection<ProcessStepInput, ProcessStepItem>
			title={m.portfolio_admin_process_title()}
			description={m.portfolio_admin_process_description()}
			queries={processSection}
			label={(item) => localizedValue(item.title)}
			detail={(item) => localizedValue(item.body)}
			addLabel={m.portfolio_admin_process_new()}
			empty={m.portfolio_admin_section_empty()}
			Sheet={ProcessSheet}
			data-testid="process-list"
		/>
	);
}

// Testimonials ----------------------------------------------------------------

const testimonialOptions = (item?: TestimonialItem) =>
	formOptions({
		defaultValues: {
			quote: item?.quote ?? EMPTY,
			name: item?.name ?? "",
			role: item?.role ?? EMPTY,
			company: item?.company ?? "",
			published: item?.published ?? true,
		} as TestimonialInput,
		validators: formValidators(testimonialInputSchema),
	});

function TestimonialSheet({ item, onClose }: SectionSheetProps<TestimonialItem>) {
	const crud = useCrudForm({
		item,
		toInput: (values: TestimonialInput) => testimonialInputSchema.parse(values),
		create: testimonialSection.create(),
		update: testimonialSection.update(),
		invalidate: [testimonialSection.keys.all],
		reload: testimonialSection.keys.all,
		onSaved: onClose,
	});
	const form = useAppForm({ ...testimonialOptions(item), ...crud.formProps });
	return (
		<form.AppForm>
			<FormSheet
				title={item ? m.portfolio_admin_testimonials_edit() : m.portfolio_admin_testimonials_new()}
				submitLabel={item ? m.crud_save() : m.crud_create()}
				pendingLabel={m.crud_saving()}
				onClose={onClose}
				stale={crud.stale}
				data-testid="testimonial-sheet"
			>
				<LocalizedField form={form} fields="quote" label={m.portfolio_admin_field_quote()} multiline maxLength={600} />
				<div className="grid gap-6 sm:grid-cols-2">
					<form.AppField name="name">
						{(field) => <field.TextField label={m.portfolio_admin_field_person()} maxLength={80} />}
					</form.AppField>
					<form.AppField name="company">
						{(field) => <field.TextField label={m.portfolio_admin_field_company()} maxLength={80} />}
					</form.AppField>
				</div>
				<LocalizedField form={form} fields="role" label={m.portfolio_admin_field_role()} maxLength={80} />
				<form.AppField name="published">
					{(field) => (
						<field.SwitchField
							label={m.portfolio_admin_field_testimonial_published()}
							description={m.portfolio_admin_field_testimonial_published_description()}
						/>
					)}
				</form.AppField>
			</FormSheet>
		</form.AppForm>
	);
}

export function TestimonialsPage() {
	return (
		<OrderedSection<TestimonialInput, TestimonialItem>
			title={m.portfolio_admin_testimonials_title()}
			description={m.portfolio_admin_testimonials_description()}
			queries={testimonialSection}
			label={(item) => `${item.name}, ${item.company}`}
			detail={(item) => localizedValue(item.quote)}
			badge={(item) =>
				item.published ? null : <StatusBadge tone="neutral">{m.portfolio_admin_testimonial_hidden()}</StatusBadge>
			}
			addLabel={m.portfolio_admin_testimonials_new()}
			empty={m.portfolio_admin_section_empty()}
			Sheet={TestimonialSheet}
			data-testid="testimonials-list"
		/>
	);
}
