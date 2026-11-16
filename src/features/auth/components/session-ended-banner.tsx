import { ClockAlertIcon } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { m } from "@/paraglide/messages";

/**
 * Above the login form when a page the visitor had open lost its session
 * (`?reason=session-ended`, src/middleware/session-expiry.ts): why they are here.
 * Signing in takes them back to where they were.
 */
export function SessionEndedBanner() {
	return (
		<Alert variant="info" role="status">
			<ClockAlertIcon aria-hidden />
			<AlertDescription>{m.auth_session_ended()}</AlertDescription>
		</Alert>
	);
}
