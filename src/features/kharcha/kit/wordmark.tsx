import { cn } from "@/lib/utils";
import { getLocale } from "@/paraglide/runtime";

/** The name in both scripts: never translated, only reordered (decision 0281). */
const LATIN = "Kharcha";
const DEVANAGARI = "खर्च";

/**
 * The wordmark: "Kharcha" in Laila with "खर्च" beside it, the locale's script first. On the
 * cloth it is light; on a page, ink. One accessible name in the locale's script.
 */
export function KharchaWordmark({ className, onCloth = false }: { className?: string; onCloth?: boolean }) {
	const nepali = getLocale() === "ne";
	const [first, second] = nepali ? [DEVANAGARI, LATIN] : [LATIN, DEVANAGARI];
	return (
		<span
			className={cn(
				"kh-display inline-flex items-baseline gap-1.5",
				onCloth ? "text-kh-on-cloth" : "text-kh-ink",
				className,
			)}
			role="img"
			aria-label={nepali ? DEVANAGARI : LATIN}
		>
			<span className="text-[1.25em] leading-none">{first}</span>
			<span className="text-[0.875em] leading-none opacity-80" lang={nepali ? "en" : "ne"}>
				{second}
			</span>
		</span>
	);
}

/**
 * The mark: ख on red bookcloth, edged with the yellow binding thread, as on the rail and
 * the app's icon (Task 88 draws the icon files from it).
 */
export function KharchaMark({ className }: { className?: string }) {
	return (
		<span
			aria-hidden
			className={cn(
				"kh-display inline-grid size-9 place-items-center rounded-md bg-kh-cloth text-[1.375rem] text-kh-on-cloth leading-none shadow-[inset_0_-3px_0_var(--kh-thread)]",
				className,
			)}
		>
			ख
		</span>
	);
}
