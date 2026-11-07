import { CheckIcon, CopyIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";

const RESET_MS = 2000;

/**
 * Copies `value` to the clipboard: an icon button whose icon turns into a check
 * for two seconds, with "Copied" announced to screen readers. `label` names what
 * is copied ("Copy request id"); it is the button's accessible name.
 */
export function CopyButton({
	value,
	label,
	showLabel = false,
	className,
}: {
	value: string;
	label: string;
	/** Shows the label next to the icon (a toolbar button) instead of in a tooltip only. */
	showLabel?: boolean;
	className?: string;
}) {
	const [copied, setCopied] = useState(false);
	useEffect(() => {
		if (!copied) return;
		const timer = setTimeout(() => setCopied(false), RESET_MS);
		return () => clearTimeout(timer);
	}, [copied]);
	const copy = async () => {
		try {
			await navigator.clipboard.writeText(value);
			setCopied(true);
		} catch {
			// No clipboard permission (an insecure origin or a denied prompt): nothing to announce.
		}
	};
	const Icon = copied ? CheckIcon : CopyIcon;
	return (
		<Button
			type="button"
			variant={showLabel ? "outline" : "ghost"}
			size={showLabel ? "sm" : "icon-sm"}
			onClick={copy}
			aria-label={showLabel ? undefined : label}
			title={showLabel ? undefined : label}
			className={cn(!showLabel && "text-muted-foreground", className)}
			data-copied={copied || undefined}
		>
			<Icon aria-hidden className={cn(copied && "text-success")} />
			{showLabel ? label : null}
			<span className="sr-only" aria-live="polite">
				{copied ? m.copy_done() : ""}
			</span>
		</Button>
	);
}
