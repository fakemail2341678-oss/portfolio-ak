import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Link, useRouter } from "@tanstack/react-router";
import { LockIcon, PencilIcon, PlusIcon, UsersIcon } from "lucide-react";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import { errorMessage } from "@/components/errors/error-page";
import { MAIN_CONTENT } from "@/components/layout/skip-link";
import { EmptyState } from "@/components/page/empty-state";
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
import { Switch } from "@/components/ui/switch";
import { sessionQueryOptions } from "@/features/auth/queries";
import { isAppError } from "@/lib/errors";
import { formatNumber } from "@/lib/i18n/intl";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";
import { pardaLibraryKeys } from "../keys";
import { pardaProfilesQueryOptions } from "../library/queries";
import { PARDA_PATHS, pardaLinks } from "../links";
import { INSET } from "../title/title-sections";
import { ProfileAvatar } from "./profile-avatar";
import { ProfileFormDialog } from "./profile-form";
import type { ProfileSummary, ProfilesData } from "./types";

/**
 * Who's watching (PLAN Task 67, decision 0240): the profiles to pick from, a PIN for a
 * locked one, and, from a profile that isn't a kids' one, adding, changing and deleting
 * them, plus the account's email digest. Noindex. Picking reloads Parda as that profile,
 * because every list on every page may change with it (a kids' cap, a region).
 */

const focusRing = "outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

/** Every cached answer may differ for another profile, so Parda starts again from its home. */
function useSwitch() {
	const router = useRouter();
	return () => window.location.assign(router.buildLocation(pardaLinks.home()).href);
}

function PinDialog({
	profile,
	onOpenChange,
	onOpened,
}: {
	profile: ProfileSummary | null;
	onOpenChange: (open: boolean) => void;
	onOpened: () => void;
}) {
	const [pin, setPin] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [pending, setPending] = useState(false);
	const submit = async (event: FormEvent) => {
		event.preventDefault();
		if (!profile) return;
		setPending(true);
		setError(null);
		try {
			const { switchPardaProfile } = await import("@/functions/parda/profiles");
			await switchPardaProfile({ data: { id: profile.id, pin } });
			onOpened();
		} catch (caught) {
			const field = isAppError(caught) ? caught.fieldErrors?.pin?.[0] : undefined;
			setError(field ?? errorMessage(caught));
			setPin("");
		} finally {
			setPending(false);
		}
	};
	return (
		<Dialog
			open={profile !== null}
			onOpenChange={(open) => {
				if (!open) {
					setPin("");
					setError(null);
				}
				onOpenChange(open);
			}}
		>
			<DialogContent className="sm:max-w-sm" data-testid="pin-dialog">
				<DialogHeader>
					<DialogTitle>{m.pd_profile_pin_ask_title({ name: profile?.name ?? "" })}</DialogTitle>
					<DialogDescription>{m.pd_profile_pin_ask()}</DialogDescription>
				</DialogHeader>
				<form method="post" className="flex flex-col gap-4" onSubmit={(event) => void submit(event)}>
					<div className="flex flex-col gap-1.5">
						<Label htmlFor="pin-entry">{m.pd_profile_pin()}</Label>
						<Input
							id="pin-entry"
							inputMode="numeric"
							autoComplete="off"
							maxLength={4}
							value={pin}
							onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 4))}
							aria-invalid={error ? true : undefined}
							aria-describedby={error ? "pin-error" : undefined}
							className="w-32 tracking-[0.5em]"
							autoFocus
							data-testid="pin-entry"
						/>
						<p id="pin-error" role="alert" className="min-h-5 text-destructive text-sm">
							{error}
						</p>
					</div>
					<DialogFooter>
						<Button type="submit" disabled={pin.length !== 4 || pending} data-testid="pin-submit">
							{m.pd_profile_pin_open()}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

function ProfileTile({
	profile,
	active,
	managing,
	onPick,
	onEdit,
}: {
	profile: ProfileSummary;
	active: boolean;
	managing: boolean;
	onPick: () => void;
	onEdit: () => void;
}) {
	const facts = [profile.kids ? m.pd_profile_kids_badge() : null, active ? m.pd_profile_active() : null].filter(
		Boolean,
	);
	return (
		<li className="flex flex-col items-center gap-2" data-testid="profile-tile">
			<button
				type="button"
				onClick={managing ? onEdit : onPick}
				className={cn(
					"pd-press group relative flex flex-col items-center gap-3",
					focusRing,
					active ? null : "text-pd-muted hover:text-pd-ink",
				)}
				aria-current={active ? "true" : undefined}
				data-testid={managing ? "profile-edit" : "profile-pick"}
			>
				<ProfileAvatar
					avatar={profile.avatar}
					name={profile.name}
					size="lg"
					className={cn("size-24 sm:size-28", active ? "ring-2 ring-pd-action" : null)}
				/>
				{managing ? (
					<span className="absolute end-1 top-1 flex size-8 items-center justify-center rounded-none bg-black/60 text-pd-on-picture">
						<PencilIcon aria-hidden className="size-4" />
					</span>
				) : null}
				<span className="flex max-w-32 items-center gap-1 font-medium text-sm">
					{profile.locked ? <LockIcon aria-hidden className="size-3.5 shrink-0" /> : null}
					<span className="truncate">{profile.name}</span>
					{profile.locked ? <span className="sr-only">, {m.pd_profile_locked()}</span> : null}
					{managing ? <span className="sr-only">, {m.pd_profile_edit()}</span> : null}
				</span>
			</button>
			<span className="h-4 text-pd-muted text-xs">{facts.join(" · ")}</span>
		</li>
	);
}

function DigestSwitch({ digest }: { digest: boolean }) {
	const queryClient = useQueryClient();
	const [pending, setPending] = useState(false);
	const change = async (on: boolean) => {
		setPending(true);
		try {
			const { setPardaDigest } = await import("@/functions/parda/profiles");
			await setPardaDigest({ data: { digest: on, locale: getLocale() } });
			await queryClient.invalidateQueries({ queryKey: pardaLibraryKeys.profiles(getLocale()) });
		} catch (error) {
			toast.error(errorMessage(error));
		} finally {
			setPending(false);
		}
	};
	return (
		<section aria-labelledby="profiles-account" className="flex flex-col gap-3 border-border border-t pt-6">
			<h2 id="profiles-account" className="pd-display text-pd-head font-bold">
				{m.pd_profiles_account()}
			</h2>
			<div className="flex items-start gap-3">
				<Switch
					id="profiles-digest"
					checked={digest}
					disabled={pending}
					onCheckedChange={(on) => void change(on)}
					data-testid="profiles-digest"
				/>
				<div className="flex flex-col gap-1">
					<Label htmlFor="profiles-digest">{m.pd_profiles_digest()}</Label>
					<p className="max-w-prose text-pd-muted text-sm">{m.pd_profiles_digest_hint()}</p>
				</div>
			</div>
		</section>
	);
}

function Profiles({ data }: { data: ProfilesData }) {
	const queryClient = useQueryClient();
	const switched = useSwitch();
	const [managing, setManaging] = useState(false);
	const [locked, setLocked] = useState<ProfileSummary | null>(null);
	const [editing, setEditing] = useState<ProfileSummary | "new" | null>(null);
	const refresh = async () => {
		await queryClient.invalidateQueries({ queryKey: pardaLibraryKeys.all });
	};
	const pick = async (profile: ProfileSummary) => {
		if (profile.id === data.active) {
			switched();
			return;
		}
		if (profile.locked) {
			setLocked(profile);
			return;
		}
		try {
			const { switchPardaProfile } = await import("@/functions/parda/profiles");
			await switchPardaProfile({ data: { id: profile.id } });
			switched();
		} catch (error) {
			toast.error(errorMessage(error));
		}
	};
	const canAdd = data.canManage && data.profiles.length < data.max;
	return (
		<div className="flex flex-col gap-10">
			<ul
				className="flex flex-wrap justify-center gap-x-6 gap-y-8 sm:gap-x-10"
				aria-label={m.pd_profiles_list_label()}
				data-testid="profiles-list"
			>
				{data.profiles.map((profile) => (
					<ProfileTile
						key={profile.id}
						profile={profile}
						active={profile.id === data.active}
						managing={managing}
						onPick={() => void pick(profile)}
						onEdit={() => setEditing(profile)}
					/>
				))}
				{managing && canAdd ? (
					<li className="flex flex-col items-center gap-2">
						<button
							type="button"
							onClick={() => setEditing("new")}
							className={cn("pd-press flex flex-col items-center gap-3 text-pd-muted hover:text-pd-ink", focusRing)}
							data-testid="profile-add"
						>
							<span className="flex size-24 items-center justify-center border border-border border-dashed sm:size-28">
								<PlusIcon aria-hidden className="size-10" />
							</span>
							<span className="font-medium text-sm">{m.pd_profile_add()}</span>
						</button>
						<span className="h-4" />
					</li>
				) : null}
			</ul>
			<div className="flex flex-col items-center gap-2">
				{data.canManage ? (
					<Button
						variant={managing ? "default" : "outline"}
						onClick={() => setManaging((on) => !on)}
						aria-pressed={managing}
						data-testid="profiles-manage"
					>
						{managing ? m.pd_profiles_done() : m.pd_profiles_manage()}
					</Button>
				) : (
					<p className="max-w-prose text-center text-pd-muted text-sm" data-testid="profiles-kids-note">
						{m.pd_profiles_kids_note()}
					</p>
				)}
				{managing ? (
					<p className="text-pd-muted text-xs">
						{m.pd_profiles_count({ count: formatNumber(data.profiles.length), max: formatNumber(data.max) })}
					</p>
				) : null}
			</div>
			{data.digest !== null && data.canManage ? <DigestSwitch digest={data.digest} /> : null}
			<PinDialog profile={locked} onOpenChange={(open) => (open ? null : setLocked(null))} onOpened={switched} />
			{editing ? (
				<ProfileFormDialog
					key={editing === "new" ? "new" : editing.id}
					open
					onOpenChange={(open) => (open ? null : setEditing(null))}
					profile={editing === "new" ? null : editing}
					data={data}
					onSaved={refresh}
				/>
			) : null}
		</div>
	);
}

function SignedIn() {
	const { data } = useSuspenseQuery(pardaProfilesQueryOptions(getLocale()));
	return <Profiles data={data} />;
}

export function PardaProfilesPage() {
	const { data: session } = useQuery(sessionQueryOptions());
	return (
		<main {...MAIN_CONTENT} className="flex flex-1 flex-col outline-none" data-testid="parda-profiles">
			<div className={cn(INSET, "mx-auto flex w-full max-w-4xl flex-col gap-10 pt-10 pb-16")}>
				<h1 className="pd-display text-center text-pd-title leading-none [&:lang(ne)]:leading-[1.2]">
					{m.pd_profiles_title()}
				</h1>
				{session ? (
					<SignedIn />
				) : (
					<EmptyState
						icon={UsersIcon}
						title={m.pd_profiles_signed_out_title()}
						description={m.pd_profiles_signed_out()}
						primaryAction={
							<Button asChild>
								<Link {...pardaLinks.signIn(PARDA_PATHS.profiles)}>{m.pd_sign_in()}</Link>
							</Button>
						}
						secondaryAction={
							<Button asChild variant="ghost">
								<Link {...pardaLinks.signUp(PARDA_PATHS.profiles)}>{m.pd_sign_up()}</Link>
							</Button>
						}
						data-testid="profiles-signed-out"
					/>
				)}
			</div>
		</main>
	);
}
