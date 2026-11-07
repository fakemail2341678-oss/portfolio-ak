import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { m } from "@/paraglide/messages";
import { localizedPath } from "../use-auth-actions";
import { FormMessage } from "./auth-field";

/** Shown after sign-up and when verification is pending; can resend the link. */
export function CheckEmail({ email }: { email: string }) {
	const [resent, setResent] = useState(false);
	const [pending, setPending] = useState(false);

	const resend = async () => {
		setPending(true);
		await authClient.sendVerificationEmail({ email, callbackURL: localizedPath("/verify-email") });
		setPending(false);
		// Same message whatever happened, so the page doesn't reveal which emails exist.
		setResent(true);
	};

	return (
		<section className="flex flex-col gap-4" data-testid="check-email">
			<h1 className="font-semibold text-2xl tracking-tight">{m.auth_check_email_title()}</h1>
			<p className="text-muted-foreground">{m.auth_check_email_body({ email })}</p>
			{resent ? <FormMessage tone="success">{m.auth_verification_resent()}</FormMessage> : null}
			<Button type="button" variant="outline" onClick={resend} disabled={pending}>
				{m.auth_resend_verification()}
			</Button>
			<Link to="/login" className="text-sm underline underline-offset-4">
				{m.auth_back_to_login()}
			</Link>
		</section>
	);
}
