import { formOptions, useStore } from "@tanstack/react-form";
import { useId } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { FormDialog } from "@/components/dialogs/form-dialog";
import { formValidators, handleSaveError, useAppForm } from "@/components/forms";
import {
	createKharchaCategory,
	createKharchaMethod,
	createKharchaRule,
	createKharchaTag,
	updateKharchaCategory,
	updateKharchaMethod,
	updateKharchaRule,
	updateKharchaTag,
} from "@/functions/kharcha/lists";
import { required } from "@/lib/validation";
import { m } from "@/paraglide/messages";
import { CATEGORY_NAME_MAX, MERCHANT_MAX, METHOD_MAX, TAG_NAME_MAX } from "../schema";
import {
	CATEGORY_ICONS,
	type CategoryView,
	KHARCHA_COLORS,
	type KharchaLists,
	type MethodView,
	RULE_MATCHES,
	type RuleView,
	type TagView,
} from "../types";
import { ColorPicker, IconPicker } from "./pickers";

/** Which list dialog is open: a new item of a kind, or one to edit. */
export type ListDialog =
	| { kind: "category"; category?: CategoryView }
	| { kind: "tag"; tag?: TagView }
	| { kind: "method"; method?: MethodView }
	| { kind: "rule"; rule?: RuleView };

type Props = { lists: KharchaLists; onSaved: (lists: KharchaLists) => void; onClose: () => void };

/** The Settings tabs' forms (loaded with the first one opened): each saves, says so, and closes. */
export default function ListDialogs({ dialog, ...props }: Props & { dialog: ListDialog }) {
	switch (dialog.kind) {
		case "category":
			return <CategoryDialog {...props} {...(dialog.category ? { category: dialog.category } : {})} />;
		case "tag":
			return <NameDialog {...props} kind="tag" {...(dialog.tag ? { item: dialog.tag } : {})} />;
		case "method":
			return <NameDialog {...props} kind="method" {...(dialog.method ? { item: dialog.method } : {})} />;
		case "rule":
			return <RuleDialog {...props} {...(dialog.rule ? { rule: dialog.rule } : {})} />;
	}
}

const categorySchema = z.object({
	name: required({ max: CATEGORY_NAME_MAX }),
	icon: z.enum(CATEGORY_ICONS),
	color: z.enum(KHARCHA_COLORS),
	archived: z.boolean(),
});

function CategoryDialog({ category, lists: _lists, onSaved, onClose }: Props & { category?: CategoryView }) {
	const name = useId();
	const form = useAppForm({
		...formOptions({
			defaultValues: {
				name: category?.name ?? "",
				icon: category?.icon ?? "receipt",
				color: category?.color ?? "teal",
				archived: category?.archived ?? false,
			},
			validators: formValidators(categorySchema),
		}),
		onSubmit: async ({ value, formApi }) => {
			try {
				const fields = { name: value.name.trim(), icon: value.icon, color: value.color };
				onSaved(
					category
						? await updateKharchaCategory({ data: { ...fields, id: category.id, archived: value.archived } })
						: await createKharchaCategory({ data: fields }),
				);
				toast.success(m.kharcha_settings_saved());
				onClose();
			} catch (error) {
				handleSaveError(formApi, error);
			}
		},
	});
	const color = useStore(form.store, (state) => state.values.color);
	return (
		<form.AppForm>
			<FormDialog
				title={category ? m.kharcha_settings_edit_category() : m.kharcha_settings_add_category()}
				description={m.kharcha_settings_category_description()}
				submitLabel={m.kharcha_settings_save()}
				onClose={onClose}
				className="sm:max-w-lg"
				data-testid="kharcha-category-dialog"
			>
				<form.AppField name="name">
					{(field) => (
						<field.TextField label={m.kharcha_field_name()} maxLength={CATEGORY_NAME_MAX} autoComplete="off" />
					)}
				</form.AppField>
				<form.AppField name="color">
					{(field) => (
						<ColorPicker
							name={`${name}-color`}
							value={field.state.value}
							onChange={(next) => field.handleChange(next)}
						/>
					)}
				</form.AppField>
				<form.AppField name="icon">
					{(field) => (
						<IconPicker
							name={`${name}-icon`}
							value={field.state.value}
							color={color}
							onChange={(next) => field.handleChange(next)}
						/>
					)}
				</form.AppField>
				{category ? (
					<form.AppField name="archived">
						{(field) => (
							<field.SwitchField label={m.kharcha_settings_archive()} description={m.kharcha_settings_archive_help()} />
						)}
					</form.AppField>
				) : null}
			</FormDialog>
		</form.AppForm>
	);
}

function NameDialog({ kind, item, onSaved, onClose }: Props & { kind: "tag" | "method"; item?: TagView | MethodView }) {
	const max = kind === "tag" ? TAG_NAME_MAX : METHOD_MAX;
	const method = item && "archived" in item ? item : undefined;
	const form = useAppForm({
		...formOptions({
			defaultValues: { name: item?.name ?? "", archived: method?.archived ?? false },
			validators: formValidators(z.object({ name: required({ max }), archived: z.boolean() })),
		}),
		onSubmit: async ({ value, formApi }) => {
			const name = value.name.trim();
			try {
				const saved =
					kind === "tag"
						? item
							? await updateKharchaTag({ data: { id: item.id, name } })
							: await createKharchaTag({ data: { name } })
						: item
							? await updateKharchaMethod({ data: { id: item.id, name, archived: value.archived } })
							: await createKharchaMethod({ data: { name } });
				onSaved(saved);
				toast.success(m.kharcha_settings_saved());
				onClose();
			} catch (error) {
				handleSaveError(formApi, error);
			}
		},
	});
	const title =
		kind === "tag"
			? item
				? m.kharcha_settings_edit_tag()
				: m.kharcha_settings_add_tag()
			: item
				? m.kharcha_settings_edit_method()
				: m.kharcha_settings_add_method();
	return (
		<form.AppForm>
			<FormDialog
				title={title}
				description={kind === "tag" ? m.kharcha_settings_tags_help() : m.kharcha_settings_methods_help()}
				submitLabel={m.kharcha_settings_save()}
				onClose={onClose}
				data-testid={`kharcha-${kind}-dialog`}
			>
				<form.AppField name="name">
					{(field) => <field.TextField label={m.kharcha_field_name()} maxLength={max} autoComplete="off" />}
				</form.AppField>
				{method ? (
					<form.AppField name="archived">
						{(field) => (
							<field.SwitchField
								label={m.kharcha_settings_archive()}
								description={m.kharcha_settings_archive_method_help()}
							/>
						)}
					</form.AppField>
				) : null}
			</FormDialog>
		</form.AppForm>
	);
}

/** "None" in a picker: shadcn's Select has no empty value. */
const NONE = "none";

const ruleSchema = z.object({
	match: z.enum(RULE_MATCHES),
	pattern: required({ max: MERCHANT_MAX }),
	categoryId: z.string(),
	tagIds: z.array(z.string()),
	methodId: z.string(),
});

function RuleDialog({ rule, lists, onSaved, onClose }: Props & { rule?: RuleView }) {
	const form = useAppForm({
		...formOptions({
			defaultValues: {
				match: rule?.match ?? "contains",
				pattern: rule?.pattern ?? "",
				categoryId: rule?.categoryId ?? NONE,
				tagIds: rule?.tagIds ?? [],
				methodId: rule?.methodId ?? NONE,
			},
			validators: formValidators(ruleSchema),
		}),
		onSubmit: async ({ value, formApi }) => {
			const fields = {
				match: value.match,
				pattern: value.pattern.trim(),
				categoryId: value.categoryId === NONE ? null : value.categoryId,
				tagIds: value.tagIds,
				methodId: value.methodId === NONE ? null : value.methodId,
			};
			try {
				onSaved(
					rule
						? await updateKharchaRule({ data: { ...fields, id: rule.id } })
						: await createKharchaRule({ data: fields }),
				);
				toast.success(m.kharcha_settings_saved());
				onClose();
			} catch (error) {
				handleSaveError(formApi, error);
			}
		},
	});
	const live = <T extends { archived: boolean; id: string }>(
		items: ReadonlyArray<T>,
		keep: string | null | undefined,
	) => items.filter((item) => !item.archived || item.id === keep);
	return (
		<form.AppForm>
			<FormDialog
				title={rule ? m.kharcha_settings_edit_rule() : m.kharcha_settings_add_rule()}
				description={m.kharcha_settings_rules_help()}
				submitLabel={m.kharcha_settings_save()}
				onClose={onClose}
				className="sm:max-w-lg"
				data-testid="kharcha-rule-dialog"
			>
				<div className="grid gap-4 sm:grid-cols-[minmax(0,10rem)_minmax(0,1fr)]">
					<form.AppField name="match">
						{(field) => (
							<field.SelectField
								label={m.kharcha_field_rule_match()}
								options={[
									{ value: "contains", label: m.kharcha_rule_match_contains() },
									{ value: "equals", label: m.kharcha_rule_match_equals() },
								]}
							/>
						)}
					</form.AppField>
					<form.AppField name="pattern">
						{(field) => (
							<field.TextField label={m.kharcha_field_merchant()} maxLength={MERCHANT_MAX} autoComplete="off" />
						)}
					</form.AppField>
				</div>
				<form.AppField name="categoryId">
					{(field) => (
						<field.SelectField
							label={m.kharcha_field_category()}
							options={[
								{ value: NONE, label: m.kharcha_rule_keep() },
								...live(lists.categories, rule?.categoryId).map((category) => ({
									value: category.id,
									label: category.name,
								})),
							]}
						/>
					)}
				</form.AppField>
				{lists.tags.length > 0 ? (
					<form.AppField name="tagIds">
						{(field) => (
							<field.CheckboxGroupField
								label={m.kharcha_field_tags()}
								optional
								options={lists.tags.map((tag) => ({ value: tag.id, label: tag.name }))}
							/>
						)}
					</form.AppField>
				) : null}
				<form.AppField name="methodId">
					{(field) => (
						<field.SelectField
							label={m.kharcha_field_method()}
							options={[
								{ value: NONE, label: m.kharcha_rule_keep() },
								...live(lists.methods, rule?.methodId).map((method) => ({ value: method.id, label: method.name })),
							]}
						/>
					)}
				</form.AppField>
			</FormDialog>
		</form.AppForm>
	);
}
