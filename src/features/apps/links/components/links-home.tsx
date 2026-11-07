import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, Link, useLocation, useNavigate } from "@tanstack/react-router";
import {
	BarChart3Icon,
	Link2Icon,
	LockIcon,
	MoreHorizontalIcon,
	PauseIcon,
	PencilIcon,
	PlayIcon,
	PlusIcon,
	QrCodeIcon,
	ShieldCheckIcon,
	Trash2Icon,
} from "lucide-react";
import { lazy, Suspense, useState } from "react";
import { toast } from "sonner";
import { CopyButton } from "@/components/data-display/copy-button";
import { StatusOf } from "@/components/data-display/status-badge";
import { useConfirm } from "@/components/dialogs/confirm";
import { errorMessage } from "@/components/errors/error-page";
import { EmptyState } from "@/components/page/empty-state";
import { Page, PageHeader } from "@/components/page/page";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { GUEST_LIFETIME_DAYS } from "@/lib/guests";
import { formatNumber } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";
import { TryAppButton } from "../../components/try-app-button";
import { displayTarget, shortUrl } from "../format";
import { LINK_STATE } from "../labels";
import { linkMutations, linksListQueryOptions } from "../queries";
import { LINKS_QUOTAS, type LinkItem } from "../types";

const LinkDialog = lazy(() => import("./link-dialog"));

const route = getRouteApi("/_apps/apps/links/");

/**
 * /apps/links (decision 0191): the app's landing for a visitor, the user's short links
 * once they have a session (a guest's included). The landing is what search engines see.
 */
export function LinksHome() {
	const { session } = route.useRouteContext();
	return session ? <LinksList userId={session.user.id} isGuest={session.isAnonymous === true} /> : <LinksLanding />;
}

function LinksLanding() {
	const location = useLocation();
	const features = [
		{ icon: BarChart3Icon, title: m.links_feature_stats(), body: m.links_feature_stats_body() },
		{ icon: QrCodeIcon, title: m.links_feature_qr(), body: m.links_feature_qr_body() },
		{ icon: ShieldCheckIcon, title: m.links_feature_private(), body: m.links_feature_private_body() },
	];
	return (
		<Page width="wide" data-testid="links-landing">
			<div className="grid items-center gap-10 lg:grid-cols-[1fr_minmax(0,28rem)]">
				<div className="flex flex-col gap-6">
					<PageHeader size="display" title={m.links_name()} description={m.links_description()} />
					<div className="flex flex-wrap items-center gap-3">
						<TryAppButton />
						<Button asChild variant="outline" size="lg">
							<Link to="/login" search={{ redirect: location.href }}>
								{m.apps_sign_in_to_use()}
							</Link>
						</Button>
					</div>
					<p className="max-w-prose text-muted-foreground text-sm">
						{m.apps_guest_note({ days: formatNumber(GUEST_LIFETIME_DAYS) })}
					</p>
				</div>
				<LinksPreview />
			</div>
			<section aria-labelledby="links-features" className="flex flex-col gap-4">
				<h2 id="links-features" className="text-heading">
					{m.links_features_title()}
				</h2>
				<ul className="grid gap-4 sm:grid-cols-3">
					{features.map(({ icon: Icon, title, body }) => (
						<li key={title} className="flex flex-col gap-2 rounded-lg border bg-surface-1 p-4">
							<Icon className="size-5 text-primary" aria-hidden />
							<h3 className="font-medium text-body">{title}</h3>
							<p className="text-muted-foreground text-sm">{body}</p>
						</li>
					))}
				</ul>
			</section>
		</Page>
	);
}

/** A still picture of a link and its week of clicks (decorative: the text beside it says what the app does). */
function LinksPreview() {
	const bars = [3, 5, 4, 8, 6, 11, 9];
	return (
		<div aria-hidden className="flex flex-col gap-3 rounded-xl border bg-surface-1 p-4 shadow-sm">
			<div className="flex items-center gap-2 rounded-lg border bg-background p-3">
				<Link2Icon className="size-4 text-primary" />
				<span className="font-medium font-mono text-caption">/l/kathmandu-map</span>
				<span className="ms-auto text-caption text-muted-foreground">46</span>
			</div>
			<div className="flex h-24 items-end gap-2 rounded-lg border bg-background p-3">
				{bars.map((height, index) => (
					<span
						// biome-ignore lint/suspicious/noArrayIndexKey: a fixed decorative series.
						key={index}
						className="flex-1 rounded-sm bg-primary/70"
						style={{ height: `${(height / 11) * 100}%` }}
					/>
				))}
			</div>
		</div>
	);
}

type Editing = { kind: "new" } | { kind: "edit"; link: LinkItem } | null;

function LinksList({ userId, isGuest }: { userId: string; isGuest: boolean }) {
	const queryClient = useQueryClient();
	const navigate = useNavigate();
	const confirm = useConfirm();
	const {
		data: { links },
	} = useSuspenseQuery(linksListQueryOptions(userId));
	const create = useMutation(linkMutations.create(queryClient, userId));
	const update = useMutation(linkMutations.update(queryClient, userId));
	const remove = useMutation(linkMutations.delete(queryClient, userId));
	const [editing, setEditing] = useState<Editing>(null);
	const full = links.length >= LINKS_QUOTAS.links;

	const setActive = (link: LinkItem, active: boolean) =>
		update.mutate(
			{ id: link.id, active },
			{
				onSuccess: () => toast.success(active ? m.links_toast_resumed() : m.links_toast_paused()),
				onError: (error) => toast.error(m.common_toast_failed(), { description: errorMessage(error) }),
			},
		);

	const removeLink = async (link: LinkItem) => {
		const label = link.title || link.slug;
		const confirmed = await confirm({
			title: m.crud_delete_title({ label }),
			description: m.links_delete_body(),
			confirmLabel: m.crud_delete(),
			destructive: true,
		});
		if (!confirmed) return;
		remove.mutate(link.id, {
			onSuccess: () => toast.success(m.crud_toast_deleted({ label })),
			onError: (error) => toast.error(m.common_toast_failed(), { description: errorMessage(error) }),
		});
	};

	const newButton = (
		<Button onClick={() => setEditing({ kind: "new" })} disabled={full} data-testid="links-new">
			<PlusIcon aria-hidden />
			{m.links_new()}
		</Button>
	);

	return (
		<Page width="wide" data-testid="links-list">
			<PageHeader
				title={m.links_title()}
				description={m.links_count({ count: formatNumber(links.length), max: formatNumber(LINKS_QUOTAS.links) })}
				actions={newButton}
			/>
			{isGuest ? (
				<p
					className="flex items-start gap-2 rounded-lg border bg-info-subtle p-3 text-sm"
					data-testid="links-guest-note"
				>
					<LockIcon className="mt-0.5 size-4 shrink-0 text-info" aria-hidden />
					<span>
						{m.links_guest_note()}{" "}
						<Link to="/upgrade" className="font-medium underline underline-offset-4">
							{m.guest_create_account()}
						</Link>
					</span>
				</p>
			) : null}
			{links.length === 0 ? (
				<EmptyState
					icon={Link2Icon}
					title={m.links_empty_title()}
					description={m.links_empty_body()}
					primaryAction={newButton}
				/>
			) : (
				<ul className="flex flex-col divide-y rounded-lg border bg-surface-1">
					{links.map((link) => (
						<li
							key={link.id}
							className="relative grid gap-x-4 gap-y-1 p-4 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center"
							data-testid="links-row"
						>
							<div className="flex min-w-0 flex-col gap-1 pe-10 sm:pe-0">
								<Link
									to="/apps/links/$linkId"
									params={{ linkId: link.id }}
									className="truncate font-medium text-body outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
									data-testid="links-open"
								>
									{link.title || link.slug}
								</Link>
								<span className="flex min-w-0 items-center gap-1">
									<span className="truncate font-mono text-primary text-sm" data-testid="links-short">
										{shortUrl(link.slug)}
									</span>
									<CopyButton value={shortUrl(link.slug)} label={m.links_copy()} />
								</span>
								<span className="truncate text-muted-foreground text-sm">{displayTarget(link.target)}</span>
							</div>
							<StatusOf status={link.state} map={LINK_STATE} className="w-fit" />
							<span className="text-muted-foreground text-sm tabular-nums">
								{m.links_clicks({ count: formatNumber(link.clicks) })}
							</span>
							<DropdownMenu modal={false}>
								<DropdownMenuTrigger asChild>
									<Button
										variant="ghost"
										size="icon"
										className="absolute end-2 top-2 sm:static"
										aria-label={m.links_actions({ name: link.title || link.slug })}
										data-testid="links-menu"
									>
										<MoreHorizontalIcon aria-hidden />
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent align="end">
									<DropdownMenuItem
										onSelect={() => void navigate({ to: "/apps/links/$linkId", params: { linkId: link.id } })}
									>
										<BarChart3Icon aria-hidden />
										{m.links_stats()}
									</DropdownMenuItem>
									<DropdownMenuItem onSelect={() => setEditing({ kind: "edit", link })}>
										<PencilIcon aria-hidden />
										{m.links_edit()}
									</DropdownMenuItem>
									<DropdownMenuItem onSelect={() => setActive(link, !link.active)} disabled={link.blocked}>
										{link.active ? <PauseIcon aria-hidden /> : <PlayIcon aria-hidden />}
										{link.active ? m.links_pause() : m.links_resume()}
									</DropdownMenuItem>
									<DropdownMenuSeparator />
									<DropdownMenuItem variant="destructive" onSelect={() => void removeLink(link)}>
										<Trash2Icon aria-hidden />
										{m.crud_delete()}
									</DropdownMenuItem>
								</DropdownMenuContent>
							</DropdownMenu>
						</li>
					))}
				</ul>
			)}
			<Suspense fallback={null}>
				{editing?.kind === "new" ? (
					<LinkDialog
						onSubmit={async (values) => {
							const link = await create.mutateAsync(values);
							toast.success(m.links_toast_created({ url: shortUrl(link.slug) }));
						}}
						onClose={() => setEditing(null)}
					/>
				) : editing?.kind === "edit" ? (
					<LinkDialog
						link={editing.link}
						onSubmit={async ({ target, title, expiresAt }) => {
							await update.mutateAsync({ id: editing.link.id, target, title, expiresAt });
							toast.success(m.crud_toast_saved());
						}}
						onClose={() => setEditing(null)}
					/>
				) : null}
			</Suspense>
		</Page>
	);
}
