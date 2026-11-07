import { tasklineLinks } from "@/features/taskline/links";
import { m } from "@/paraglide/messages";
import { ButtonLink } from "../primitives/links";

/**
 * A case study's way into Taskline, for a project whose "App" field says `taskline`:
 * Taskline isn't an /apps app (decision 0208), so it has a link of its own. Part of the
 * taskline layer (strip-demo removes it with Taskline).
 */
export function TasklineLink() {
	return (
		<ButtonLink {...tasklineLinks.landing()} className="self-start" data-testid="case-try-taskline">
			{m.portfolio_case_try_app()}
		</ButtonLink>
	);
}
