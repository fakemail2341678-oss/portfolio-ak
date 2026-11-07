import { Progress as ProgressPrimitive } from "radix-ui";
import type * as React from "react";
import { cn } from "@/lib/utils";

function Progress({ className, value, ...props }: React.ComponentProps<typeof ProgressPrimitive.Root>) {
	return (
		// shadcn's copy kept `value` for the indicator only, so the bar had no aria-valuenow.
		<ProgressPrimitive.Root
			data-slot="progress"
			value={value}
			className={cn("relative h-2 w-full overflow-hidden rounded-full bg-accent-subtle", className)}
			{...props}
		>
			<ProgressPrimitive.Indicator
				data-slot="progress-indicator"
				className="h-full w-full flex-1 bg-primary transition-transform motion-reduce:transition-none"
				style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
			/>
		</ProgressPrimitive.Root>
	);
}

export { Progress };
