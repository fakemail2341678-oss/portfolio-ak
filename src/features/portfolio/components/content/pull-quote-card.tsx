import { cn } from "../../lib/cn";

/** A quotation set at statement size, its opening mark hung in the margin, muted. */
export function PullQuote({ text, cite, className }: { text: string; cite?: string | undefined; className?: string }) {
	return (
		<figure className={cn("ps-[0.6em] md:ps-0", className)}>
			<blockquote className="hm-statement text-hm-lead">
				<p className="-indent-[0.45em]">
					<span aria-hidden className="font-bold text-hm-muted">
						“
					</span>
					{text}
				</p>
			</blockquote>
			{cite ? <figcaption className="mt-4 text-hm-muted">{cite}</figcaption> : null}
		</figure>
	);
}
