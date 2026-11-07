import { Link } from "@tanstack/react-router";
import {
	CalendarRangeIcon,
	ClockIcon,
	type LucideIcon,
	PlayIcon,
	ShieldCheckIcon,
	SquareKanbanIcon,
	TimerIcon,
	WorkflowIcon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Page } from "@/components/page/page";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { authErrorMessage } from "@/features/auth/errors";
import { useAuthNavigation } from "@/features/auth/use-auth-actions";
import { GUEST_LIFETIME_DAYS } from "@/lib/guests";
import { formatNumber } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import { tasklineLinks } from "../links";
import { TasklinePublicFrame } from "../shell/public-frame";
import { TasklineArt } from "../shell/taskline-art";

/**
 * /app/taskline for visitors (signed-in people go to Home): what Taskline is, a
 * sandbox to try it without an account, and sign in or up. The page search engines see.
 */
export function TasklineLanding() {
	const features: ReadonlyArray<{ icon: LucideIcon; title: string; body: string }> = [
		{ icon: SquareKanbanIcon, title: m.taskline_feature_views(), body: m.taskline_feature_views_body() },
		{ icon: TimerIcon, title: m.taskline_feature_sprints(), body: m.taskline_feature_sprints_body() },
		{ icon: ClockIcon, title: m.taskline_feature_time(), body: m.taskline_feature_time_body() },
		{ icon: CalendarRangeIcon, title: m.taskline_feature_timeline(), body: m.taskline_feature_timeline_body() },
		{ icon: WorkflowIcon, title: m.taskline_feature_automations(), body: m.taskline_feature_automations_body() },
		{ icon: ShieldCheckIcon, title: m.taskline_feature_team(), body: m.taskline_feature_team_body() },
	];
	return (
		<TasklinePublicFrame>
			<Page width="wide" className="gap-16" data-testid="taskline-landing">
				<section className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
					<div className="flex flex-col gap-6">
						<div className="flex flex-col gap-3">
							<p className="font-medium text-primary text-sm">{m.taskline_landing_eyebrow()}</p>
							<h1 className="max-w-2xl text-balance font-semibold text-4xl leading-tight tracking-tight sm:text-5xl">
								{m.taskline_landing_heading()}
							</h1>
							<p className="max-w-xl text-lg text-muted-foreground">{m.taskline_landing_description()}</p>
						</div>
						<div className="flex flex-wrap items-center gap-3">
							<TrySandboxButton />
							<Button asChild variant="outline" size="lg">
								<Link {...tasklineLinks.signIn()}>{m.taskline_sign_in()}</Link>
							</Button>
						</div>
						<p className="max-w-prose text-muted-foreground text-sm">
							{m.taskline_landing_sandbox_note({ days: formatNumber(GUEST_LIFETIME_DAYS) })}
						</p>
					</div>
					<div className="rounded-xl border bg-surface-1 p-6">
						<TasklineArt className="w-full" />
					</div>
				</section>
				<section aria-labelledby="taskline-features" className="flex flex-col gap-6">
					<h2 id="taskline-features" className="text-title">
						{m.taskline_features_title()}
					</h2>
					<ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
						{features.map(({ icon: Icon, title, body }) => (
							<li key={title} className="flex flex-col gap-2 rounded-lg border bg-surface-1 p-5">
								<Icon className="size-5 text-primary" aria-hidden />
								<h3 className="font-medium text-body">{title}</h3>
								<p className="text-muted-foreground text-sm">{body}</p>
							</li>
						))}
					</ul>
				</section>
			</Page>
		</TasklinePublicFrame>
	);
}

/**
 * "Try the sandbox": a guest session (decision 0185) whose sandbox is seeded in the
 * page's language; the landing then sends the new guest to Home. Rate limited per address.
 */
function TrySandboxButton() {
	const [pending, setPending] = useState(false);
	const { refresh } = useAuthNavigation();
	const start = async () => {
		setPending(true);
		// Loaded on demand: most visitors never press it.
		const { authClient } = await import("@/lib/auth-client");
		const { error } = await authClient.signIn.anonymous();
		if (error) {
			setPending(false);
			toast.error(error.status === 429 ? m.taskline_try_rate_limited() : authErrorMessage(error));
			return;
		}
		// Re-runs the landing's guard, which sends the new guest to Home.
		await refresh();
		setPending(false);
	};
	return (
		<Button size="lg" onClick={() => void start()} disabled={pending} aria-busy={pending} data-testid="try-sandbox">
			{pending ? <Spinner aria-hidden /> : <PlayIcon aria-hidden />}
			{pending ? m.taskline_try_starting() : m.taskline_try()}
		</Button>
	);
}
