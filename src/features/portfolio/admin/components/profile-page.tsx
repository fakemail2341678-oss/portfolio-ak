import { formOptions } from "@tanstack/react-form";
import { useSuspenseQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { CrudForm, crudFormKey, useCrudForm } from "@/components/crud/use-crud-form";
import { formValidators, useAppForm, withForm } from "@/components/forms";
import { SortableListField } from "@/components/forms/fields/list-fields";
import { LocalizedField } from "@/components/forms/fields/localized-fields";
import { FormSection, StickyFormBar } from "@/components/page/form-layout";
import { SettingsLayout, SettingsNavLink } from "@/components/page/layouts";
import { Page, PageHeader } from "@/components/page/page";
import { MediaField } from "@/features/media/components/media-field";
import { formatNumber } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import { AVAILABILITY_STATUSES } from "../../constants";
import { type ProfileDetail, type ProfileFormValues, profileFormSchema, toProfileInput } from "../../schema";
import { profileKeys } from "../keys";
import { AVAILABILITY_LABELS } from "../labels";
import { profileMutations, profileQueryOptions } from "../queries";
import { MetricFields } from "./field-groups";

const EMPTY = { en: "", ne: "" };
const picked = (image: ProfileDetail["portrait"]) => (image ? [{ id: image.id, preview: image }] : []);

const profileFormOptions = (item?: ProfileDetail) =>
	formOptions({
		defaultValues: {
			name: item?.name ?? EMPTY,
			initials: item?.initials ?? "",
			role: item?.role ?? EMPTY,
			location: item?.location ?? EMPTY,
			timezone: item?.timezone ?? "",
			email: item?.email ?? "",
			availabilityStatus: item?.availabilityStatus ?? "open",
			availabilityNote: item?.availabilityNote ?? EMPTY,
			headline: item?.headline ?? [EMPTY],
			intro: item?.intro ?? EMPTY,
			manifesto: item?.manifesto ?? EMPTY,
			bio: item?.bio ?? [EMPTY],
			principles: item?.principles ?? [],
			impact: item?.impact ?? [],
			socials: item?.socials ?? [],
			toolbox: item?.toolbox ?? [],
			since: item?.since ?? new Date().getFullYear(),
			seoTitle: item?.seoTitle ?? EMPTY,
			seoDescription: item?.seoDescription ?? EMPTY,
			portrait: picked(item?.portrait ?? null),
			resume: picked(item?.resume ?? null),
			ogImage: picked(item?.ogImage ?? null),
		} as ProfileFormValues,
		validators: formValidators(profileFormSchema),
	});

/** The sections, in order: their anchors are the page's navigation. */
const SECTIONS = [
	{ id: "identity", title: m.portfolio_admin_profile_identity },
	{ id: "story", title: m.portfolio_admin_profile_story },
	{ id: "proof", title: m.portfolio_admin_profile_proof },
	{ id: "links", title: m.portfolio_admin_profile_links },
	{ id: "search", title: m.portfolio_admin_profile_search },
] as const;

function Anchor({ id, children }: { id: string; children: ReactNode }) {
	return (
		<div id={id} className="scroll-mt-20">
			{children}
		</div>
	);
}

const n = (index: number) => formatNumber(index + 1);

const IdentitySection = withForm({
	...profileFormOptions(),
	render: function IdentitySection({ form }) {
		return (
			<FormSection title={m.portfolio_admin_profile_identity()}>
				<LocalizedField form={form} fields="name" label={m.portfolio_admin_field_name()} maxLength={80} />
				<div className="grid gap-6 sm:grid-cols-2">
					<form.AppField name="initials">
						{(field) => (
							<field.TextField
								label={m.portfolio_admin_field_initials()}
								description={m.portfolio_admin_field_initials_description()}
								maxLength={2}
							/>
						)}
					</form.AppField>
					<form.AppField name="email">
						{(field) => (
							<field.EmailField
								label={m.portfolio_admin_field_email()}
								description={m.portfolio_admin_field_email_description()}
							/>
						)}
					</form.AppField>
				</div>
				<LocalizedField form={form} fields="role" label={m.portfolio_admin_field_role()} maxLength={80} />
				<LocalizedField form={form} fields="location" label={m.portfolio_admin_field_location()} maxLength={80} />
				<form.AppField name="timezone">
					{(field) => (
						<field.TextField label={m.portfolio_admin_field_timezone()} placeholder="NPT · UTC+5:45" maxLength={40} />
					)}
				</form.AppField>
				<form.AppField name="availabilityStatus">
					{(field) => (
						<field.RadioGroupField
							label={m.portfolio_admin_field_availability()}
							options={AVAILABILITY_STATUSES.map((status) => ({ value: status, label: AVAILABILITY_LABELS[status]() }))}
						/>
					)}
				</form.AppField>
				<LocalizedField
					form={form}
					fields="availabilityNote"
					label={m.portfolio_admin_field_availability_note()}
					optional
					maxLength={200}
				/>
				<form.AppField name="portrait">
					{() => <MediaField label={m.portfolio_admin_field_portrait()} max={1} />}
				</form.AppField>
			</FormSection>
		);
	},
});

const StorySection = withForm({
	...profileFormOptions(),
	render: function StorySection({ form }) {
		return (
			<FormSection title={m.portfolio_admin_profile_story()}>
				<form.AppField name="headline" mode="array">
					{() => (
						<SortableListField<{ en: string; ne: string }>
							label={m.portfolio_admin_field_headline()}
							description={m.portfolio_admin_field_headline_description()}
							addLabel={m.portfolio_admin_add_line()}
							newItem={() => EMPTY}
							getItemLabel={(line, index) => line.en || m.portfolio_admin_line_n({ n: n(index) })}
							max={4}
							renderItem={({ index }) => (
								<LocalizedField
									form={form}
									fields={`headline[${index}]`}
									label={m.portfolio_admin_line_n({ n: n(index) })}
									maxLength={40}
								/>
							)}
						/>
					)}
				</form.AppField>
				<LocalizedField form={form} fields="intro" label={m.portfolio_admin_field_intro()} multiline maxLength={400} />
				<LocalizedField
					form={form}
					fields="manifesto"
					label={m.portfolio_admin_field_manifesto()}
					multiline
					maxLength={1200}
				/>
				<form.AppField name="bio" mode="array">
					{() => (
						<SortableListField<{ en: string; ne: string }>
							label={m.portfolio_admin_field_bio()}
							addLabel={m.portfolio_admin_add_paragraph()}
							newItem={() => EMPTY}
							getItemLabel={(_, index) => m.portfolio_admin_paragraph_n({ n: n(index) })}
							max={6}
							renderItem={({ index }) => (
								<LocalizedField
									form={form}
									fields={`bio[${index}]`}
									label={m.portfolio_admin_paragraph_n({ n: n(index) })}
									multiline
									maxLength={1200}
								/>
							)}
						/>
					)}
				</form.AppField>
			</FormSection>
		);
	},
});

const ProofSection = withForm({
	...profileFormOptions(),
	render: function ProofSection({ form }) {
		return (
			<FormSection title={m.portfolio_admin_profile_proof()}>
				<form.AppField name="principles" mode="array">
					{() => (
						<SortableListField
							label={m.portfolio_admin_field_principles()}
							optional
							addLabel={m.portfolio_admin_add_principle()}
							newItem={() => ({ title: EMPTY, body: EMPTY })}
							getItemLabel={(principle, index) => principle.title.en || m.portfolio_admin_principle_n({ n: n(index) })}
							max={8}
							renderItem={({ index }) => (
								<>
									<LocalizedField
										form={form}
										fields={`principles[${index}].title`}
										label={m.portfolio_admin_field_title()}
										maxLength={80}
									/>
									<LocalizedField
										form={form}
										fields={`principles[${index}].body`}
										label={m.portfolio_admin_field_description()}
										multiline
										maxLength={300}
									/>
								</>
							)}
						/>
					)}
				</form.AppField>
				<form.AppField name="impact" mode="array">
					{() => (
						<SortableListField
							label={m.portfolio_admin_field_impact()}
							optional
							addLabel={m.portfolio_admin_add_metric()}
							newItem={() => ({ value: 0, format: "number" as const, label: EMPTY })}
							getItemLabel={(metric, index) => metric.label.en || m.portfolio_admin_metric_n({ n: n(index) })}
							max={4}
							renderItem={({ index }) => <MetricFields form={form} fields={`impact[${index}]`} />}
						/>
					)}
				</form.AppField>
				<form.AppField name="toolbox">
					{(field) => (
						<field.TagsInputField
							label={m.portfolio_admin_field_toolbox()}
							description={m.portfolio_admin_field_toolbox_description()}
							optional
						/>
					)}
				</form.AppField>
				<form.AppField name="since">
					{(field) => (
						<field.NumberField
							label={m.portfolio_admin_field_since()}
							description={m.portfolio_admin_field_since_description()}
							integer
						/>
					)}
				</form.AppField>
			</FormSection>
		);
	},
});

const LinksSection = withForm({
	...profileFormOptions(),
	render: function LinksSection({ form }) {
		return (
			<FormSection title={m.portfolio_admin_profile_links()}>
				<form.AppField name="socials" mode="array">
					{() => (
						<SortableListField
							label={m.portfolio_admin_field_socials()}
							optional
							addLabel={m.portfolio_admin_add_social()}
							newItem={() => ({ network: "", handle: "", href: "" })}
							getItemLabel={(social, index) => social.network || m.portfolio_admin_link_n({ n: n(index) })}
							max={8}
							renderItem={({ index }) => (
								<div className="grid gap-3 sm:grid-cols-2">
									<form.AppField name={`socials[${index}].network`}>
										{(field) => <field.TextField label={m.portfolio_admin_field_network()} maxLength={40} />}
									</form.AppField>
									<form.AppField name={`socials[${index}].handle`}>
										{(field) => <field.TextField label={m.portfolio_admin_field_handle()} maxLength={60} />}
									</form.AppField>
									<div className="sm:col-span-2">
										<form.AppField name={`socials[${index}].href`}>
											{(field) => (
												<field.TextField
													label={m.portfolio_admin_field_href()}
													description={m.portfolio_admin_field_href_description()}
													inputMode="url"
												/>
											)}
										</form.AppField>
									</div>
								</div>
							)}
						/>
					)}
				</form.AppField>
				<form.AppField name="resume">
					{() => (
						<MediaField
							label={m.portfolio_admin_field_resume()}
							description={m.portfolio_admin_field_resume_description()}
							max={1}
							kind="document"
						/>
					)}
				</form.AppField>
			</FormSection>
		);
	},
});

const SearchSection = withForm({
	...profileFormOptions(),
	render: function SearchSection({ form }) {
		return (
			<FormSection
				title={m.portfolio_admin_profile_search()}
				description={m.portfolio_admin_profile_search_description()}
			>
				<LocalizedField
					form={form}
					fields="seoTitle"
					label={m.portfolio_admin_field_seo_title()}
					optional
					maxLength={70}
				/>
				<LocalizedField
					form={form}
					fields="seoDescription"
					label={m.portfolio_admin_field_seo_description()}
					optional
					multiline
					maxLength={160}
				/>
				<form.AppField name="ogImage">
					{() => (
						<MediaField
							label={m.portfolio_admin_field_og_image()}
							description={m.portfolio_admin_field_og_image_description()}
							max={1}
						/>
					)}
				</form.AppField>
			</FormSection>
		);
	},
});

function ProfileForm({ item }: { item: ProfileDetail }) {
	const crud = useCrudForm({
		item,
		toInput: toProfileInput,
		update: profileMutations.update(),
		invalidate: [profileKeys.all],
		reload: profileKeys.all,
	});
	const form = useAppForm({ ...profileFormOptions(item), ...crud.formProps });
	return (
		<CrudForm form={form} crud={crud} className="max-w-none" data-testid="profile-form">
			<Anchor id="identity">
				<IdentitySection form={form} />
			</Anchor>
			<Anchor id="story">
				<StorySection form={form} />
			</Anchor>
			<Anchor id="proof">
				<ProofSection form={form} />
			</Anchor>
			<Anchor id="links">
				<LinksSection form={form} />
			</Anchor>
			<Anchor id="search">
				<SearchSection form={form} />
			</Anchor>
			<StickyFormBar submitLabel={m.crud_save()} pendingLabel={m.crud_saving()} />
		</CrudForm>
	);
}

/**
 * /admin/portfolio/profile: the owner's profile in one form, its sections in a
 * side navigation (decision 0176). Text is typed in both languages; the
 * portrait, résumé and social image come from the media library.
 */
export function ProfilePage() {
	const { data: item } = useSuspenseQuery(profileQueryOptions());
	return (
		<Page width="admin">
			<PageHeader title={m.portfolio_admin_profile_title()} description={m.portfolio_admin_profile_description()} />
			<SettingsLayout
				label={m.portfolio_admin_profile_sections()}
				nav={SECTIONS.map((section) => (
					<SettingsNavLink
						key={section.id}
						to="/admin/portfolio/profile"
						hash={section.id}
						activeOptions={{ includeHash: true }}
					>
						{section.title()}
					</SettingsNavLink>
				))}
			>
				<ProfileForm key={crudFormKey(item)} item={item} />
			</SettingsLayout>
		</Page>
	);
}
