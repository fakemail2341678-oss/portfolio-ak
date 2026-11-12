import { cn } from "@/lib/utils";
import type { KharchaColor } from "../types";

const graphemes = (text: string) =>
	[...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text)].map((part) => part.segment);

/**
 * Up to two initials, whole characters in any script: "Sita Rai" gives "SR", "सीता राई"
 * gives "सीरा" (a vowel sign stays with its letter), "Pokhara" gives "PO".
 */
export const personInitials = (name: string): string => {
	const words = name.trim().split(/\s+/).filter(Boolean);
	const first = graphemes(words[0] ?? "");
	if (words.length > 1) return `${first[0] ?? ""}${graphemes(words.at(-1) ?? "")[0] ?? ""}`.toUpperCase();
	return (first.slice(0, 2).join("") || "?").toUpperCase();
};

const SIZES = {
	sm: "size-6 rounded-[0.3125rem] text-[0.6875rem]",
	md: "size-8 rounded-md text-caption",
	lg: "size-10 rounded-md text-body",
} as const;

/**
 * A person's (or a group's) square plate: their initials in white on their colour, the
 * same everywhere they appear. Decorative: their name is always written beside it.
 */
export function PersonAvatar({
	name,
	color,
	size = "md",
	className,
}: {
	name: string;
	color: KharchaColor;
	size?: keyof typeof SIZES;
	className?: string;
}) {
	return (
		<span
			aria-hidden
			className={cn(
				"inline-grid shrink-0 select-none place-items-center font-semibold text-white leading-none",
				SIZES[size],
				className,
			)}
			style={{ backgroundColor: `var(--kh-c-${color})` }}
			data-color={color}
		>
			{personInitials(name)}
		</span>
	);
}
