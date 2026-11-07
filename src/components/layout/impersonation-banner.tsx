import { useMutation, useQuery } from "@tanstack/react-query";
import { EyeIcon } from "lucide-react";
import { useId } from "react";
import { Button } from "@/components/ui/button";
import { sessionQueryOptions } from "@/features/auth/queries";
import { stopImpersonating } from "@/functions/auth";
import { useSessionSkipped } from "@/lib/session-scope";
import { m } from "@/paraglide/messages";
import { localizeHref } from "@/paraglide/runtime";

/**
 * Shown on every page of an impersonated session (decisions.md 0134): whose view
 * this is, and one click back to the admin's own session. Rendered on the server
 * from the session, so it never shifts the layout.
 */
export function ImpersonationBanner() {
	const labelId = useId();
	// Not on pages that skip the session (the portfolio): it would be fetched after hydration.
	const { data: session } = useQuery({ ...sessionQueryOptions(), enabled: !useSessionSkipped() });
	const stop = useMutation({
		mutationFn: () => stopImpersonating(),
		// The admin's own session again: reload the app from the server, back on the users page.
		onSuccess: () => window.location.assign(localizeHref("/admin/users")),
		// sonner is imported on demand: this banner is part of every page's entry chunk.
		onError: () => void import("sonner").then(({ toast }) => toast.error(m.impersonation_stop_failed())),
	});
	if (!session?.impersonatedBy) return null;
	return (
		<aside
			aria-labelledby={labelId}
			className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 bg-amber-200 px-4 py-2 text-amber-950 text-sm dark:bg-amber-900 dark:text-amber-50"
			data-testid="impersonation-banner"
		>
			<p id={labelId} className="flex items-center gap-2">
				<EyeIcon className="size-4 shrink-0" aria-hidden />
				{m.impersonation_banner({ name: session.user.name, email: session.user.email })}
			</p>
			<Button size="sm" variant="outline" disabled={stop.isPending} onClick={() => stop.mutate()}>
				{m.impersonation_stop()}
			</Button>
		</aside>
	);
}
