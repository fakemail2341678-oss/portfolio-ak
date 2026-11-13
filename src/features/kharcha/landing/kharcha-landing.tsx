import { Link } from "@tanstack/react-router";
import { BookOpenIcon, HandCoinsIcon, type LucideIcon, PlayIcon, ReceiptIcon, ScaleIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Page } from "@/components/page/page";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { authErrorMessage } from "@/features/auth/errors";
import { useAuthNavigation } from "@/features/auth/use-auth-actions";
import { GUEST_LIFETIME_DAYS, setGuestScope } from "@/lib/guests";
import { formatNumber } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import { kharchaLinks } from "../links";
import { KharchaArt } from "../shell/kharcha-art";
import { KharchaPublicFrame } from "../shell/public-frame";

/**
 * /app/kharcha for visitors (signed-in people go to Home): what Kharcha is, a try with
 * sample data and no account, and sign in or up. The one page search engines see.
 */
export function KharchaLanding() {
	const features: ReadonlyArray<{ icon: LucideIcon; title: string; body: string }> = [
		{ icon: ReceiptIcon, title: m.kharcha_feature_track(), body: m.kharcha_feature_track_body() },
		{ icon: ScaleIcon, title: m.kharcha_feature_split(), body: m.kharcha_feature_split_body() },
		{ icon: BookOpenIcon, title: m.kharcha_feature_pages(), body: m.kharcha_feature_pages_body() },
		{ icon: HandCoinsIcon, title: m.kharcha_feature_settle(), body: m.kharcha_feature_settle_body() },
	];
	return (
		<KharchaPublicFrame>
			<Page width="wide" className="gap-16" data-testid="kharcha-landing">
				<section className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,28rem)]">
					<div className="flex flex-col gap-6">
						<div className="flex flex-col gap-3">
							<h1 className="kh-display max-w-2xl text-balance text-4xl leading-tight sm:text-5xl">
								{m.kharcha_landing_heading()}
							</h1>
							<p className="max-w-xl text-kh-muted text-lg">{m.kharcha_landing_description()}</p>
						</div>
						<div className="flex flex-wrap items-center gap-3">
							<TryButton />
							<Button asChild variant="outline" size="lg">
								<Link {...kharchaLinks.signIn()}>{m.kharcha_sign_in()}</Link>
							</Button>
						</div>
						<p className="max-w-prose text-kh-muted text-sm">
							{m.kharcha_landing_try_note({ days: formatNumber(GUEST_LIFETIME_DAYS) })}
						</p>
					</div>
					<KharchaArt className="w-full" />
				</section>
				<section aria-labelledby="kharcha-features" className="flex flex-col gap-6">
					<h2 id="kharcha-features" className="kh-display text-kh-title">
						{m.kharcha_features_title()}
					</h2>
					<ul className="grid gap-px overflow-hidden rounded-md border border-kh-hair bg-kh-hair sm:grid-cols-2">
						{features.map(({ icon: Icon, title, body }) => (
							<li key={title} className="flex flex-col gap-2 bg-kh-page p-5">
								<Icon className="size-5 text-kh-mark" aria-hidden />
								<h3 className="font-semibold text-body">{title}</h3>
								<p className="text-kh-muted text-sm">{body}</p>
							</li>
						))}
					</ul>
				</section>
			</Page>
		</KharchaPublicFrame>
	);
}

/**
 * "Try it": a guest session (decision 0185) scoped to Kharcha (0236), so it gets Kharcha's
 * sample data in the page's language; the landing's guard then sends the guest to Home.
 * Rate limited per address.
 */
function TryButton() {
	const [pending, setPending] = useState(false);
	const { refresh } = useAuthNavigation();
	const start = async () => {
		setPending(true);
		// Loaded on demand: most visitors never press it.
		const { authClient } = await import("@/lib/auth-client");
		setGuestScope("kharcha");
		const { error } = await authClient.signIn.anonymous();
		if (error) {
			setPending(false);
			toast.error(error.status === 429 ? m.kharcha_try_rate_limited() : authErrorMessage(error));
			return;
		}
		// Re-runs the landing's guard, which sends the new guest to Home.
		await refresh();
		setPending(false);
	};
	return (
		<Button size="lg" onClick={() => void start()} disabled={pending} aria-busy={pending} data-testid="kharcha-try">
			{pending ? <Spinner aria-hidden /> : <PlayIcon aria-hidden />}
			{pending ? m.kharcha_try_starting() : m.kharcha_try()}
		</Button>
	);
}
