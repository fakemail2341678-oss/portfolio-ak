import { useState } from "react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { m } from "@/paraglide/messages";
import { authErrorMessage } from "../errors";
import { AccountSection, type Status } from "./account-section";
import { FormMessage } from "./auth-field";

/** Where the export is served (src/routes/api/account/export.ts). */
export const ACCOUNT_EXPORT_PATH = "/api/account/export";

/**
 * Your data (decisions.md 0129): download everything stored about you as JSON, or
 * delete the account. Deleting always goes through an emailed link, which opens
 * /account/delete for a last confirmation.
 */
export function AccountDataSection({ email }: { email: string }) {
	const [status, setStatus] = useState<Status>();
	const [pending, setPending] = useState(false);

	const requestDeletion = async () => {
		setPending(true);
		setStatus(undefined);
		// The emailed link opens /account/delete (auth.ts builds it), not Better Auth's callback.
		const { error } = await authClient.deleteUser({});
		setPending(false);
		if (error) return setStatus({ tone: "error", text: authErrorMessage(error) });
		setStatus({ tone: "success", text: m.account_delete_sent({ email }) });
	};

	return (
		<AccountSection title={m.account_data_title()}>
			{status ? <FormMessage tone={status.tone}>{status.text}</FormMessage> : null}
			<div className="flex flex-col gap-2">
				<h3 className="font-medium text-sm">{m.account_export_title()}</h3>
				<p className="text-muted-foreground text-sm">{m.account_export_intro()}</p>
				<Button asChild variant="outline" className="self-start">
					<a href={ACCOUNT_EXPORT_PATH} download data-testid="account-export">
						{m.account_export_download()}
					</a>
				</Button>
			</div>
			<div className="flex flex-col gap-2 border-t pt-4">
				<h3 className="font-medium text-sm">{m.account_delete_title()}</h3>
				<p className="text-muted-foreground text-sm">{m.account_delete_intro()}</p>
				<Button type="button" variant="destructive" className="self-start" disabled={pending} onClick={requestDeletion}>
					{m.account_delete_request()}
				</Button>
			</div>
		</AccountSection>
	);
}
