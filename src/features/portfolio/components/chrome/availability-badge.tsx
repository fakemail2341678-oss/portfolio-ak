import { m } from "@/paraglide/messages";
import type { Profile } from "../../types";

type Availability = Profile["availability"];

const LABELS: Record<Availability["status"], () => string> = {
	open: m.portfolio_availability_open,
	limited: m.portfolio_availability_limited,
	closed: m.portfolio_availability_closed,
};

/**
 * "Limited availability. Booking one partnership for early 2027.": the status
 * in words. No coloured mark beside it: the palette has no status colours, and
 * the bold word already says it.
 */
export function AvailabilityNote({
	availability,
	className,
}: {
	availability: Availability;
	className?: string | undefined;
}) {
	return (
		<p className={className}>
			<span className="font-semibold">{LABELS[availability.status]()}.</span> {availability.note}
		</p>
	);
}
