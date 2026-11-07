import { RefreshCwIcon, TriangleAlertIcon } from "lucide-react";
import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { m } from "@/paraglide/messages";

/**
 * Shown above a form whose save was refused because someone else changed the
 * record first (a stale CONFLICT, src/lib/concurrency.ts). Nothing was saved;
 * "Reload" fetches the latest version and resets the form to it.
 */
export function StaleVersionAlert({ onReload }: { onReload: () => Promise<unknown> }) {
	const [reloading, setReloading] = useState(false);
	const reload = async () => {
		setReloading(true);
		try {
			await onReload();
		} finally {
			setReloading(false);
		}
	};
	return (
		<Alert variant="destructive" data-testid="stale-version-alert">
			<TriangleAlertIcon aria-hidden />
			<AlertTitle>{m.form_stale_title()}</AlertTitle>
			<AlertDescription>
				<p>{m.form_stale_description()}</p>
				<Button type="button" variant="outline" size="sm" className="mt-2" onClick={reload} disabled={reloading}>
					<RefreshCwIcon className={reloading ? "animate-spin" : undefined} aria-hidden />
					{m.form_stale_reload()}
				</Button>
			</AlertDescription>
		</Alert>
	);
}
