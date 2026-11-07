import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type StatusTone = "neutral" | "success" | "warning" | "info" | "danger";

const TONES: Record<StatusTone, string> = {
	neutral: "bg-muted text-muted-foreground",
	success: "bg-success-subtle text-success",
	warning: "bg-warning-subtle text-warning",
	info: "bg-info-subtle text-info",
	danger: "bg-danger-subtle text-danger",
};

/**
 * A state in a word ("Published", "Banned"), tinted by Graphite's status tokens
 * (each pair is 4.5:1 in every theme and accent, tests/unit/design-tokens.test.ts).
 * The dot repeats the colour; the word carries the meaning, so colour is never the
 * only signal.
 */
export function StatusBadge({
	tone = "neutral",
	children,
	className,
}: {
	tone?: StatusTone;
	children: ReactNode;
	className?: string;
}) {
	return (
		<span
			className={cn(
				"inline-flex w-fit shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 font-medium text-caption",
				TONES[tone],
				className,
			)}
			data-tone={tone}
		>
			<span className="size-1.5 rounded-full bg-current" aria-hidden />
			{children}
		</span>
	);
}

/** A feature's statuses: each one's tone and label (a message, read at render time). */
export type StatusMap<S extends string> = Readonly<Record<S, { tone: StatusTone; label: () => string }>>;

/** Declares a feature's status map once (next to its labels), typed by its status values. */
export const defineStatuses = <S extends string>(map: StatusMap<S>): StatusMap<S> => map;

/** The badge for one value of a feature's status map: `<StatusOf status={row.status} map={TEST_CRUD_STATUS} />`. */
export function StatusOf<S extends string>({
	status,
	map,
	className,
}: {
	status: S;
	map: StatusMap<S>;
	className?: string;
}) {
	const { tone, label } = map[status];
	return (
		<StatusBadge tone={tone} className={className}>
			{label()}
		</StatusBadge>
	);
}
