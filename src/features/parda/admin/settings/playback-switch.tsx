import { useSuspenseQuery } from "@tanstack/react-query";
import { PowerIcon } from "lucide-react";
import { useId } from "react";
import { toast } from "sonner";
import { useCrudMutation } from "@/components/crud/use-crud-mutation";
import { useConfirm } from "@/components/dialogs/confirm";
import { Switch } from "@/components/ui/switch";
import { useCan } from "@/features/rbac/can";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { pardaAdminKeys } from "../keys";
import { pardaAdminMutations, pardaSettingsQueryOptions } from "../queries";

/**
 * The kill switch (PLAN 12.2, "Legal"; decision 0237): off, no player loads anywhere in
 * Parda, within 30 s on every server. Turning it off asks first. On the sources page and
 * the settings page; only `parda:configure` can flip it, everyone else sees its state.
 */
export function PlaybackSwitch({ className }: { className?: string }) {
	const { data: settings } = useSuspenseQuery(pardaSettingsQueryOptions());
	const canConfigure = useCan("parda:configure");
	const confirm = useConfirm();
	const id = useId();
	const set = useCrudMutation(pardaAdminMutations.setPlayback(), { invalidate: [pardaAdminKeys.settings()] });
	const on = settings.playbackEnabled;

	const flip = async (enabled: boolean) => {
		if (!enabled) {
			const confirmed = await confirm({
				destructive: true,
				title: m.pd_admin_playback_off_title(),
				description: m.pd_admin_playback_off_body(),
				confirmLabel: m.pd_admin_playback_off_confirm(),
			});
			if (!confirmed) return;
		}
		set.mutate(enabled, {
			onSuccess: () => toast.success(enabled ? m.pd_admin_playback_on_toast() : m.pd_admin_playback_off_toast()),
		});
	};

	return (
		<section
			aria-labelledby={`${id}-label`}
			className={cn(
				"flex items-start gap-4 rounded-lg border p-4",
				on ? "bg-card" : "border-destructive/40 bg-destructive/5",
				className,
			)}
			data-testid="parda-playback"
			data-state={on ? "on" : "off"}
		>
			<PowerIcon
				aria-hidden
				className={cn("mt-0.5 size-5 shrink-0", on ? "text-muted-foreground" : "text-destructive")}
			/>
			<div className="min-w-0 flex-1">
				<h2 id={`${id}-label`} className="font-medium">
					{on ? m.pd_admin_playback_on() : m.pd_admin_playback_off()}
				</h2>
				<p id={`${id}-hint`} className="text-muted-foreground text-sm">
					{on ? m.pd_admin_playback_on_hint() : m.pd_admin_playback_off_hint()}
				</p>
			</div>
			<Switch
				checked={on}
				disabled={!canConfigure || set.isPending}
				onCheckedChange={(checked) => void flip(checked)}
				aria-label={m.pd_admin_playback_switch()}
				aria-describedby={`${id}-hint`}
				data-testid="parda-playback-switch"
			/>
		</section>
	);
}
