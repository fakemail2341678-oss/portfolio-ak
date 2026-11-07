import { formOptions } from "@tanstack/react-form";
import { Trash2Icon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { useConfirm } from "@/components/dialogs/confirm";
import { errorMessage } from "@/components/errors/error-page";
import { formValidators, handleSaveError, useAppForm } from "@/components/forms";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { required } from "@/lib/validation";
import { m } from "@/paraglide/messages";
import type { Locale } from "@/paraglide/runtime";
import { isKidsCap, KIDS_CAPS } from "../kids";
import { isProfileAvatar, PROFILE_AVATARS } from "./options";
import { AVATAR_ICONS } from "./profile-avatar";
import type { ProfileSummary, ProfilesData } from "./types";

/**
 * A profile's form (PLAN Task 67, decision 0240), in a dialog on the profiles page: its
 * name and picture, kids with a cap, the region and players' language (Automatic follows
 * the visitor's country and the page), autoplay, and its PIN lock.
 */

/** Selects can't hold an empty value: "auto" stands for "not chosen". */
const AUTO = "auto";

const formSchema = z.object({
	name: required({ max: 30 }),
	avatar: z.string(),
	kids: z.boolean(),
	cap: z.string(),
	region: z.string(),
	audioLanguage: z.string(),
	autoplay: z.boolean(),
});
type Values = z.input<typeof formSchema>;

const LANGUAGE_NAMES: Readonly<Record<Locale, () => string>> = { en: m.language_en, ne: m.language_ne };

const valuesOf = (profile: ProfileSummary | null): Values => ({
	name: profile?.name ?? "",
	avatar: profile?.avatar ?? PROFILE_AVATARS[0],
	kids: profile?.kids ?? false,
	cap: profile?.cap ?? AUTO,
	region: profile?.region ?? AUTO,
	audioLanguage: profile?.audioLanguage ?? AUTO,
	autoplay: profile?.autoplay ?? true,
});

const orNull = (value: string) => (value === AUTO || value === "" ? null : value);

const AVATAR_LABELS: Readonly<Record<(typeof PROFILE_AVATARS)[number], () => string>> = {
	sun: m.pd_avatar_sun,
	moon: m.pd_avatar_moon,
	star: m.pd_avatar_star,
	leaf: m.pd_avatar_leaf,
	wave: m.pd_avatar_wave,
	flame: m.pd_avatar_flame,
	cloud: m.pd_avatar_cloud,
	bolt: m.pd_avatar_bolt,
};

function AvatarPicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
	return (
		<fieldset className="flex flex-col gap-2">
			<legend className="mb-2 font-medium text-sm">{m.pd_profile_avatar()}</legend>
			<div className="flex flex-wrap gap-2">
				{PROFILE_AVATARS.map((avatar) => {
					const Icon = AVATAR_ICONS[avatar];
					return (
						<label
							key={avatar}
							className={cn(
								"flex size-12 cursor-pointer items-center justify-center bg-pd-ground-2 text-pd-action outline-none has-[:checked]:ring-2 has-[:checked]:ring-pd-action has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50",
							)}
						>
							<input
								type="radio"
								name="avatar"
								value={avatar}
								checked={value === avatar}
								onChange={() => onChange(avatar)}
								className="sr-only"
							/>
							<Icon aria-hidden className="size-6" />
							<span className="sr-only">{AVATAR_LABELS[avatar]()}</span>
						</label>
					);
				})}
			</div>
		</fieldset>
	);
}

export function ProfileFormDialog({
	open,
	onOpenChange,
	profile,
	data,
	onSaved,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** Null adds a profile. */
	profile: ProfileSummary | null;
	data: ProfilesData;
	onSaved: () => Promise<void>;
}) {
	const confirm = useConfirm();
	const form = useAppForm({
		...formOptions({ defaultValues: valuesOf(profile), validators: formValidators(formSchema) }),
		onSubmit: async ({ value, formApi }) => {
			const fields = {
				name: value.name.trim(),
				avatar: isProfileAvatar(value.avatar) ? value.avatar : null,
				kids: value.kids,
				cap: value.kids && isKidsCap(value.cap) ? value.cap : null,
				region: orNull(value.region),
				audioLanguage: (data.languages as ReadonlyArray<string>).includes(value.audioLanguage)
					? (value.audioLanguage as Locale)
					: null,
				autoplay: value.autoplay,
			};
			try {
				const functions = await import("@/functions/parda/profiles");
				if (profile) await functions.updatePardaProfile({ data: { id: profile.id, ...fields } });
				else await functions.createPardaProfile({ data: fields });
				await onSaved();
				onOpenChange(false);
			} catch (error) {
				handleSaveError(formApi, error);
			}
		},
	});
	const remove = async () => {
		if (!profile) return;
		const sure = await confirm({
			title: m.pd_profile_delete_title({ name: profile.name }),
			description: m.pd_profile_delete_description(),
			confirmLabel: m.pd_profile_delete(),
			destructive: true,
		});
		if (!sure) return;
		try {
			const { deletePardaProfile } = await import("@/functions/parda/profiles");
			await deletePardaProfile({ data: { id: profile.id } });
			await onSaved();
			onOpenChange(false);
		} catch (error) {
			toast.error(errorMessage(error));
		}
	};
	const capOptions = [
		{ value: AUTO, label: m.pd_profile_cap_default({ cap: data.defaultCap }) },
		...KIDS_CAPS.map((cap) => ({ value: cap, label: cap })),
	];
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg" data-testid="profile-dialog">
				<DialogHeader>
					<DialogTitle>{profile ? m.pd_profile_edit_title({ name: profile.name }) : m.pd_profile_add()}</DialogTitle>
					<DialogDescription>{m.pd_profile_form_description()}</DialogDescription>
				</DialogHeader>
				<form.AppForm>
					<form.Form className="flex flex-col gap-5" data-testid="profile-form">
						<form.FormErrorSummary />
						<form.AppField name="name">
							{(field) => <field.TextField label={m.pd_profile_name()} maxLength={30} autoComplete="off" />}
						</form.AppField>
						<form.Field name="avatar">
							{(field) => <AvatarPicker value={field.state.value} onChange={(value) => field.handleChange(value)} />}
						</form.Field>
						{profile?.isDefault ? null : (
							<form.AppField name="kids">
								{(field) => <field.SwitchField label={m.pd_profile_kids()} description={m.pd_profile_kids_hint()} />}
							</form.AppField>
						)}
						<form.Subscribe selector={(state) => state.values.kids}>
							{(kids) =>
								kids ? (
									<form.AppField name="cap">
										{(field) => (
											<field.SelectField
												label={m.pd_profile_cap()}
												description={m.pd_profile_cap_hint()}
												options={capOptions}
											/>
										)}
									</form.AppField>
								) : null
							}
						</form.Subscribe>
						<form.AppField name="region">
							{(field) => (
								<field.SelectField
									label={m.pd_profile_region()}
									description={m.pd_profile_region_hint()}
									options={[
										{ value: AUTO, label: m.pd_profile_automatic() },
										...data.regions.map((region) => ({ value: region.code, label: region.name })),
									]}
								/>
							)}
						</form.AppField>
						<form.AppField name="audioLanguage">
							{(field) => (
								<field.SelectField
									label={m.pd_profile_audio()}
									description={m.pd_profile_audio_hint()}
									options={[
										{ value: AUTO, label: m.pd_profile_automatic() },
										...data.languages.map((language) => ({ value: language, label: LANGUAGE_NAMES[language]() })),
									]}
								/>
							)}
						</form.AppField>
						<form.AppField name="autoplay">
							{(field) => (
								<field.SwitchField label={m.pd_profile_autoplay()} description={m.pd_profile_autoplay_hint()} />
							)}
						</form.AppField>
						<DialogFooter className="gap-2 sm:justify-between">
							{profile && !profile.isDefault ? (
								<Button type="button" variant="ghost" onClick={() => void remove()} data-testid="profile-delete">
									<Trash2Icon aria-hidden />
									{m.pd_profile_delete()}
								</Button>
							) : (
								<span />
							)}
							<form.SubmitButton>{profile ? m.crud_save() : m.pd_profile_add()}</form.SubmitButton>
						</DialogFooter>
					</form.Form>
				</form.AppForm>
				{profile ? <PinSection profile={profile} onSaved={onSaved} /> : null}
			</DialogContent>
		</Dialog>
	);
}

/** The PIN lock: four digits to open the profile from another one. */
function PinSection({ profile, onSaved }: { profile: ProfileSummary; onSaved: () => Promise<void> }) {
	const [pin, setPin] = useState("");
	const [pending, setPending] = useState(false);
	const valid = /^\d{4}$/.test(pin);
	const save = async (value: string | null) => {
		setPending(true);
		try {
			const { setPardaProfilePin } = await import("@/functions/parda/profiles");
			await setPardaProfilePin({ data: { id: profile.id, pin: value } });
			setPin("");
			toast.success(value ? m.pd_profile_pin_set_done() : m.pd_profile_pin_removed());
			await onSaved();
		} catch (error) {
			toast.error(errorMessage(error));
		} finally {
			setPending(false);
		}
	};
	return (
		<section aria-labelledby="profile-pin" className="flex flex-col gap-3 border-border border-t pt-5">
			<h3 id="profile-pin" className="font-medium text-sm">
				{m.pd_profile_pin_heading()}
			</h3>
			<p className="text-pd-muted text-sm">{profile.locked ? m.pd_profile_pin_locked() : m.pd_profile_pin_hint()}</p>
			<div className="flex flex-wrap items-end gap-2">
				<div className="flex flex-col gap-1.5">
					<Label htmlFor="profile-pin-input">{profile.locked ? m.pd_profile_pin_new() : m.pd_profile_pin()}</Label>
					<Input
						id="profile-pin-input"
						inputMode="numeric"
						autoComplete="off"
						maxLength={4}
						pattern="[0-9]{4}"
						value={pin}
						onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 4))}
						className="w-28 tracking-[0.5em]"
						data-testid="profile-pin-input"
					/>
				</div>
				<Button
					type="button"
					variant="outline"
					onClick={() => void save(pin)}
					disabled={!valid || pending}
					data-testid="profile-pin-save"
				>
					{m.pd_profile_pin_set()}
				</Button>
				{profile.locked ? (
					<Button
						type="button"
						variant="ghost"
						onClick={() => void save(null)}
						disabled={pending}
						data-testid="profile-pin-remove"
					>
						{m.pd_profile_pin_remove()}
					</Button>
				) : null}
			</div>
		</section>
	);
}
