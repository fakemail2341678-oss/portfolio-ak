import { CheckIcon, CopyIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { m } from "@/paraglide/messages";

const RESET_AFTER_MS = 2400;

/**
 * Copies the address to the clipboard and says so (politely, for screen
 * readers too). Before hydration, or without clipboard access, the mailto
 * link beside it still works.
 */
export function CopyEmailButton({ email }: { email: string }) {
	const [copied, setCopied] = useState(false);

	useEffect(() => {
		if (!copied) return;
		const timer = window.setTimeout(() => setCopied(false), RESET_AFTER_MS);
		return () => window.clearTimeout(timer);
	}, [copied]);

	const copy = async () => {
		try {
			await navigator.clipboard.writeText(email);
			setCopied(true);
		} catch {
			// No clipboard permission: the mailto link remains the way to get the address.
		}
	};

	return (
		<div className="flex items-center gap-4">
			<button
				type="button"
				onClick={copy}
				className="hm-focus inline-flex min-h-11 items-center gap-2 bg-hm-action px-4 font-semibold text-hm-on-action transition-transform active:scale-[0.98]"
			>
				{copied ? <CheckIcon aria-hidden className="size-3.5" /> : <CopyIcon aria-hidden className="size-3.5" />}
				{m.portfolio_contact_copy()}
			</button>
			<output aria-live="polite" className="font-semibold">
				{copied ? m.portfolio_contact_copied() : ""}
			</output>
		</div>
	);
}
