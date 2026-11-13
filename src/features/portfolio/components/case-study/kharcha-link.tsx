import { kharchaLinks } from "@/features/kharcha/links";
import { m } from "@/paraglide/messages";
import { ButtonLink } from "../primitives/links";

/**
 * A case study's way into Kharcha, for a project whose "App" field says `kharcha` (the
 * Expenses app's projects became that, decision 0289): Kharcha isn't an /apps app, so it
 * has a link of its own. Part of the kharcha layer (strip-demo removes it with Kharcha).
 */
export function KharchaLink() {
	return (
		<ButtonLink {...kharchaLinks.landing()} className="self-start" data-testid="case-try-kharcha">
			{m.portfolio_case_try_app()}
		</ButtonLink>
	);
}
