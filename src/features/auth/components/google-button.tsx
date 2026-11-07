import { useState } from "react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { m } from "@/paraglide/messages";
import { authErrorMessage } from "../errors";
import { localizedPath } from "../use-auth-actions";
import { FormMessage } from "./auth-field";

/** Rendered only when Google OAuth is configured on the server (authFeatures.google). */
export function GoogleButton({ redirectTo }: { redirectTo: string }) {
	const [pending, setPending] = useState(false);
	const [error, setError] = useState<string>();

	const signIn = async () => {
		setPending(true);
		setError(undefined);
		// On success the browser is redirected to Google, so this only returns on failure.
		const { error: failure } = await authClient.signIn.social({
			provider: "google",
			callbackURL: localizedPath(redirectTo),
		});
		if (failure) setError(authErrorMessage(failure));
		setPending(false);
	};

	return (
		<div className="flex flex-col gap-2">
			<Button type="button" variant="outline" onClick={signIn} disabled={pending} data-testid="google-sign-in">
				{m.auth_google()}
			</Button>
			{error ? <FormMessage tone="error">{error}</FormMessage> : null}
		</div>
	);
}
