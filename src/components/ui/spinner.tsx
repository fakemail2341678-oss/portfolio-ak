import { Loader2Icon } from "lucide-react";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";

/** A busy indicator. Pass `aria-hidden` when visible text already says what's happening (a "Saving…" button). */
function Spinner({ className, ...props }: React.ComponentProps<"svg">) {
	return (
		<Loader2Icon
			role="status"
			aria-label={props["aria-hidden"] ? undefined : m.pending_loading()}
			className={cn("size-4 animate-spin motion-reduce:animate-none", className)}
			{...props}
		/>
	);
}

export { Spinner };
