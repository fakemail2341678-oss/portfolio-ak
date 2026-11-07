import { ChevronDownIcon } from "lucide-react";
import type * as React from "react";
import { cn } from "@/lib/utils";

/**
 * A styled native <select>, matching Input. Use it where the control must work
 * before hydration and without JavaScript (filters in GET forms); the Radix
 * Select is for richer, JS-only pickers.
 */
function NativeSelect({ className, ...props }: React.ComponentProps<"select">) {
	return (
		<div className="relative" data-slot="native-select-wrapper">
			<select
				data-slot="native-select"
				className={cn(
					"h-(--control-height) w-full min-w-0 appearance-none rounded-md border border-input bg-transparent py-1 ps-3 pe-8 text-base shadow-xs outline-none transition-[color,box-shadow] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30",
					"focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
					// Options render in the OS menu; give them the page colours in dark mode.
					"[&>option]:bg-popover [&>option]:text-popover-foreground",
					className,
				)}
				{...props}
			/>
			<ChevronDownIcon
				className="pointer-events-none absolute end-2.5 top-1/2 size-4 -translate-y-1/2 opacity-50"
				aria-hidden
			/>
		</div>
	);
}

export { NativeSelect };
