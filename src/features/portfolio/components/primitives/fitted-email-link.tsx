import { cn } from "../../lib/cn";
import { cssVars } from "../../lib/css-vars";
import { fitEm } from "../../lib/fit";

/**
 * An email address set as display type, margin to margin (hm-name, sized
 * from its length like FittedName). Where the whole address can't fit (a
 * phone), it is sized to its longer side of the @ and breaks after the @
 * (`<wbr>`), so it stays one word for screen readers and the link's name.
 * An address is Latin letters, not Nepali text: `lang="en"` keeps the Latin
 * tracking the estimate assumes (and an English voice spells it out).
 * Put it inside a size container (`@container`) and a mailto link.
 */
export function FittedEmail({ email, className }: { email: string; className?: string | undefined }) {
	const at = email.indexOf("@");
	const parts = at > 0 ? [email.slice(0, at + 1), email.slice(at + 1)] : [email];
	return (
		<span
			lang="en"
			className={cn("hm-name block", className)}
			style={cssVars({ "--hm-fit": fitEm(email), "--hm-fit-word": Math.max(...parts.map(fitEm)) })}
		>
			{parts[0]}
			{parts[1] ? (
				<>
					<wbr />
					{parts[1]}
				</>
			) : null}
		</span>
	);
}
