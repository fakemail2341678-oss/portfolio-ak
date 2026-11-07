import { useSuspenseQuery } from "@tanstack/react-query";
import { ListOrderedIcon } from "lucide-react";
import { useId } from "react";
import { toast } from "sonner";
import { useCrudMutation } from "@/components/crud/use-crud-mutation";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useCan } from "@/features/rbac/can";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { pardaAdminKeys } from "../keys";
import { pardaAdminMutations, pardaSettingsQueryOptions } from "../queries";
import { SOURCE_ORDER_MODES } from "../schema";

const isMode = (value: string): value is (typeof SOURCE_ORDER_MODES)[number] =>
	(SOURCE_ORDER_MODES as ReadonlyArray<string>).includes(value);

/**
 * How plays pick their first source (PLAN 12.5, "Admin"; decision 0238): automatic, by
 * the daily scores, or the admin's own order. Pinned sources lead in either. Its own
 * write, like the kill switch; only `parda:configure` can change it.
 */
export function SourceOrderSwitch({ className }: { className?: string }) {
	const { data: settings } = useSuspenseQuery(pardaSettingsQueryOptions());
	const canConfigure = useCan("parda:configure");
	const id = useId();
	const set = useCrudMutation(pardaAdminMutations.setSourceOrder(), {
		invalidate: [pardaAdminKeys.settings(), pardaAdminKeys.sources()],
	});
	const mode = settings.sourceOrder;

	return (
		<section
			aria-labelledby={`${id}-label`}
			className={cn("flex flex-wrap items-start gap-4 rounded-lg border bg-card p-4", className)}
			data-testid="parda-source-order"
			data-state={mode}
		>
			<ListOrderedIcon aria-hidden className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
			<div className="min-w-0 flex-1 basis-60">
				<h2 id={`${id}-label`} className="font-medium">
					{mode === "auto" ? m.pd_admin_order_auto_title() : m.pd_admin_order_manual_title()}
				</h2>
				<p id={`${id}-hint`} className="text-muted-foreground text-sm">
					{mode === "auto" ? m.pd_admin_order_auto_hint() : m.pd_admin_order_manual_hint()}
				</p>
			</div>
			<ToggleGroup
				type="single"
				variant="outline"
				value={mode}
				disabled={!canConfigure || set.isPending}
				onValueChange={(value) => {
					if (!isMode(value) || value === mode) return;
					set.mutate(value, {
						onSuccess: () =>
							toast.success(value === "auto" ? m.pd_admin_order_auto_toast() : m.pd_admin_order_manual_toast()),
					});
				}}
				aria-label={m.pd_admin_order_label()}
				aria-describedby={`${id}-hint`}
			>
				<ToggleGroupItem value="auto" data-testid="parda-source-order-auto">
					{m.pd_admin_order_auto()}
				</ToggleGroupItem>
				<ToggleGroupItem value="manual" data-testid="parda-source-order-manual">
					{m.pd_admin_order_manual()}
				</ToggleGroupItem>
			</ToggleGroup>
		</section>
	);
}
