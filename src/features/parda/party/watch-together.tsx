import { useNavigate } from "@tanstack/react-router";
import { UsersIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { errorMessage } from "@/components/errors/error-page";
import { Button } from "@/components/ui/button";
import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";
import { useEnsureViewer } from "../library/use-viewer-session";
import { pardaLinks } from "../links";
import type { WatchPageData } from "../player/watch-types";

/**
 * *Watch together* on the watch page's bar (PLAN Task 69a, decision 0243): makes a party on
 * this title, starting a Parda guest first when there's no session, and opens its page. The
 * party starts where the host is.
 */
export function WatchTogetherButton({
	data,
	position,
}: {
	data: Extract<WatchPageData, { configured: true }>;
	position: number;
}) {
	const navigate = useNavigate();
	const ensureViewer = useEnsureViewer({ playerMounted: true });
	const [pending, setPending] = useState(false);
	const create = async () => {
		setPending(true);
		try {
			if (!(await ensureViewer())) return;
			const { createPardaParty } = await import("@/functions/parda/party");
			const { code } = await createPardaParty({
				data: {
					media: data.title.media,
					id: data.title.id,
					...(data.episode ? { season: data.episode.season, episode: data.episode.episode } : {}),
					position: Math.floor(position),
					locale: getLocale(),
				},
			});
			await navigate(pardaLinks.party(code));
		} catch (error) {
			toast.error(errorMessage(error));
		} finally {
			setPending(false);
		}
	};
	return (
		<Button variant="ghost" size="sm" onClick={() => void create()} disabled={pending} data-testid="watch-together">
			<UsersIcon aria-hidden />
			{m.pd_party_watch_together()}
		</Button>
	);
}
