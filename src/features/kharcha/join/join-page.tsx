import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, Link, useLocation, useNavigate } from "@tanstack/react-router";
import { CheckIcon } from "lucide-react";
import { toast } from "sonner";
import { errorMessage } from "@/components/errors/error-page";
import { MAIN_CONTENT } from "@/components/layout/skip-link";
import { Button } from "@/components/ui/button";
import { sessionQueryOptions } from "@/features/auth/queries";
import { formatDayMonth } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import { GroupPlate } from "../kit/group-plate";
import { PersonAvatar } from "../kit/person-avatar";
import { kharchaLinks } from "../links";
import { kharchaJoinQueryOptions, kharchaMutations } from "../queries";
import { KharchaAuthFrame } from "../shell/public-frame";
import type { JoinInvite } from "../types";

const route = getRouteApi("/_kharcha/app/kharcha/join/$token");

/**
 * An invite link's page (Task 90, decision 0284): who sent it and from which group, then
 * one step. A visitor signs up or in and comes back here; a guest signs up first; a
 * signed-in account joins after a confirm (the button says as whom). A used or expired
 * link says so. Signing up with the invited address, verified, joins without the button.
 */
export function JoinPage() {
	const { token } = route.useParams();
	const { data: invite } = useSuspenseQuery(kharchaJoinQueryOptions(token));
	return <JoinView token={token} invite={invite} />;
}

/** The page for a given invite (the route's, or a story's). */
export function JoinView({ token, invite }: { token: string; invite: JoinInvite }) {
	const { data: session } = useQuery(sessionQueryOptions());
	const location = useLocation();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const userId = session?.user.id ?? "";
	const accept = useMutation(kharchaMutations.acceptInvite(queryClient, userId));
	const guest = session?.isAnonymous === true;
	const join = async () => {
		try {
			const joined = await accept.mutateAsync(token);
			toast.success(m.kharcha_join_done({ name: invite.inviter.name }));
			await navigate(joined.groupId ? kharchaLinks.group(joined.groupId) : kharchaLinks.friend(joined.inviterId));
		} catch (error) {
			toast.error(errorMessage(error));
		}
	};
	return (
		<KharchaAuthFrame>
			<main
				{...MAIN_CONTENT}
				className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-12"
				data-testid="kharcha-join"
			>
				<div className="flex items-center gap-3">
					<PersonAvatar name={invite.inviter.name} color={invite.inviter.color} size="lg" />
					{invite.group ? <GroupPlate icon={invite.group.icon} color={invite.group.color} size="lg" /> : null}
				</div>
				<div className="flex flex-col gap-2">
					<h1 className="kh-display text-kh-title">{m.kharcha_join_heading({ name: invite.inviter.name })}</h1>
					<p className="text-kh-muted">
						{invite.group
							? m.kharcha_join_group({ name: invite.inviter.name, group: invite.group.name })
							: m.kharcha_join_body({ name: invite.inviter.name })}
					</p>
				</div>

				{invite.status === "accepted" ? (
					<p
						className="rounded-md border border-kh-hair bg-kh-page px-3 py-2 text-sm"
						data-testid="kharcha-join-status"
					>
						{m.kharcha_join_used()}
					</p>
				) : invite.status === "expired" ? (
					<p
						className="rounded-md border border-kh-hair bg-kh-page px-3 py-2 text-sm"
						data-testid="kharcha-join-status"
					>
						{m.kharcha_join_expired({ name: invite.inviter.name })}
					</p>
				) : !session || guest ? (
					<div className="flex flex-col gap-3">
						<Button asChild>
							<Link {...kharchaLinks.signUp(location.href)} data-testid="kharcha-join-sign-up">
								{guest ? m.kharcha_join_sign_up_guest() : m.kharcha_join_sign_up()}
							</Link>
						</Button>
						{guest ? null : (
							<Button asChild variant="outline">
								<Link {...kharchaLinks.signIn(location.href)} data-testid="kharcha-join-sign-in">
									{m.kharcha_join_sign_in()}
								</Link>
							</Button>
						)}
						<p className="text-caption text-kh-muted">
							{m.kharcha_join_until({ date: formatDayMonth(invite.expiresAt.slice(0, 10)) })}
						</p>
					</div>
				) : (
					<div className="flex flex-col gap-3">
						<Button onClick={() => void join()} disabled={accept.isPending} data-testid="kharcha-join-accept">
							<CheckIcon aria-hidden />
							{m.kharcha_join_as({ name: session.user.name })}
						</Button>
						<p className="text-caption text-kh-muted">{m.kharcha_join_confirm_help({ name: invite.inviter.name })}</p>
					</div>
				)}
			</main>
		</KharchaAuthFrame>
	);
}
