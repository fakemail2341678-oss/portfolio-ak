import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, Link, useLocation, useNavigate } from "@tanstack/react-router";
import {
	BarChart3Icon,
	ClipboardListIcon,
	MoreHorizontalIcon,
	MousePointerClickIcon,
	PencilIcon,
	PlusIcon,
	Share2Icon,
	StarIcon,
	Trash2Icon,
} from "lucide-react";
import { lazy, Suspense, useState } from "react";
import { toast } from "sonner";
import { CopyButton } from "@/components/data-display/copy-button";
import { RelativeTime } from "@/components/data-display/relative-time";
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
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { GUEST_LIFETIME_DAYS } from "@/lib/guests";
import { formatNumber } from "@/lib/i18n/intl";
import { absoluteUrl } from "@/lib/seo";
import { m } from "@/paraglide/messages";
import { TryAppButton } from "../../components/try-app-button";
import { FORM_STATUS, publicFormPath } from "../labels";
import { formMutations, formsListQueryOptions } from "../queries";
import { FORM_TITLE_MAX } from "../schema";
import { FORMS_QUOTAS, type FormSummary } from "../types";

const NameDialog = lazy(() => import("../../components/name-dialog"));

const route = getRouteApi("/_apps/apps/forms/");

/**
 * /apps/forms (decision 0195): the app's landing for a visitor, the user's forms once
 * they have a session (a guest's included). The landing is what search engines see.
 */
export function FormsHome() {
	const { session } = route.useRouteContext();
	return session ? <FormsList userId={session.user.id} /> : <FormsLanding />;
}

function FormsLanding() {
	const location = useLocation();
	const features = [
		{ icon: MousePointerClickIcon, title: m.forms_feature_build(), body: m.forms_feature_build_body() },
		{ icon: Share2Icon, title: m.forms_feature_share(), body: m.forms_feature_share_body() },
		{ icon: BarChart3Icon, title: m.forms_feature_results(), body: m.forms_feature_results_body() },
	];
	return (
		<Page width="wide" data-testid="forms-landing">
			<div className="grid items-center gap-10 lg:grid-cols-[1fr_minmax(0,28rem)]">
				<div className="flex flex-col gap-6">
					<PageHeader size="display" title={m.forms_name()} description={m.forms_description()} />
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
				<FormsPreview />
			</div>
			<section aria-labelledby="forms-features" className="flex flex-col gap-4">
				<h2 id="forms-features" className="text-heading">
					{m.forms_features_title()}
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

/** A still picture of a short survey (decorative: the text beside it says what the app does). */
function FormsPreview() {
	return (
		<div aria-hidden className="flex flex-col gap-4 rounded-xl border bg-surface-1 p-5 shadow-sm">
			<div className="flex flex-col gap-1">
				<span className="font-medium text-body">{m.forms_seed_title()}</span>
				<span className="text-caption text-muted-foreground">{m.forms_seed_description()}</span>
			</div>
			<div className="flex flex-col gap-2">
				<span className="text-sm">{m.forms_seed_rating()}</span>
				<div className="flex gap-1.5">
					{[1, 2, 3, 4, 5].map((score) => (
						<span
							key={score}
							className="flex h-8 min-w-10 items-center justify-center gap-1 rounded-md border bg-background text-caption"
						>
							<StarIcon
								className={score <= 4 ? "size-3.5 fill-warning text-warning" : "size-3.5 text-muted-foreground"}
							/>
							{formatNumber(score)}
						</span>
					))}
				</div>
			</div>
			<div className="flex flex-col gap-2">
				<span className="text-sm">{m.forms_seed_heard()}</span>
				{[m.forms_seed_heard_friends(), m.forms_seed_heard_social()].map((label, index) => (
					<span key={label} className="flex items-center gap-2 text-caption">
						<span
							className={index === 0 ? "size-3.5 rounded-full border-4 border-primary" : "size-3.5 rounded-full border"}
						/>
						{label}
					</span>
				))}
			</div>
			<span className="h-8 w-24 rounded-md bg-primary" />
		</div>
	);
}

function FormsList({ userId }: { userId: string }) {
	const queryClient = useQueryClient();
	const navigate = useNavigate();
	const {
		data: { forms, now },
	} = useSuspenseQuery(formsListQueryOptions(userId));
	const create = useMutation(formMutations.create(queryClient, userId));
	const [naming, setNaming] = useState(false);
	const full = forms.length >= FORMS_QUOTAS.forms;
	const newButton = (
		<Button onClick={() => setNaming(true)} disabled={full} data-testid="forms-new">
			<PlusIcon aria-hidden />
			{m.forms_new()}
		</Button>
	);
	return (
		<Page width="wide" data-testid="forms-list">
			<PageHeader
				title={m.forms_title()}
				description={m.forms_count({ count: formatNumber(forms.length), max: formatNumber(FORMS_QUOTAS.forms) })}
				actions={newButton}
			/>
			{forms.length === 0 ? (
				<EmptyState
					icon={ClipboardListIcon}
					title={m.forms_empty_title()}
					description={m.forms_empty_body()}
					primaryAction={newButton}
				/>
			) : (
				<ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
					{forms.map((form) => (
						<FormCard key={form.id} form={form} now={now} userId={userId} />
					))}
				</ul>
			)}
			<Suspense fallback={null}>
				{naming ? (
					<NameDialog
						title={m.forms_new()}
						label={m.forms_field_title()}
						submitLabel={m.crud_create()}
						max={FORM_TITLE_MAX}
						onSubmit={async (title) => {
							const form = await create.mutateAsync({ id: crypto.randomUUID(), title });
							await navigate({ to: "/apps/forms/$formId", params: { formId: form.id } });
						}}
						onClose={() => setNaming(false)}
						testId="forms-new-dialog"
					/>
				) : null}
			</Suspense>
		</Page>
	);
}

function FormCard({ form, now, userId }: { form: FormSummary; now: string; userId: string }) {
	const queryClient = useQueryClient();
	const confirm = useConfirm();
	const remove = useMutation(formMutations.delete(queryClient, userId));

	const onDelete = async () => {
		const confirmed = await confirm({
			title: m.crud_delete_title({ label: form.title }),
			description: m.forms_delete_body({ count: formatNumber(form.responses) }),
			confirmLabel: m.crud_delete(),
			destructive: true,
		});
		if (!confirmed) return;
		remove.mutate(form.id, {
			onSuccess: () => toast.success(m.crud_toast_deleted({ label: form.title })),
			onError: (error) => toast.error(m.common_toast_failed(), { description: errorMessage(error) }),
		});
	};

	return (
		<li className="flex flex-col gap-3 rounded-lg border bg-surface-1 p-4" data-testid="forms-card">
			<div className="flex items-start justify-between gap-2">
				<Link
					to="/apps/forms/$formId"
					params={{ formId: form.id }}
					className="min-w-0 break-words rounded-sm font-medium text-body outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
				>
					{form.title}
				</Link>
				<StatusOf status={form.status} map={FORM_STATUS} className="shrink-0" />
			</div>
			<p className="text-muted-foreground text-sm">
				{m.forms_card_summary({ fields: formatNumber(form.fieldCount), responses: formatNumber(form.responses) })}
			</p>
			<p className="text-caption text-muted-foreground">
				{m.forms_card_updated()} <RelativeTime value={form.updatedAt} now={now} />
			</p>
			<div className="mt-auto flex flex-wrap items-center gap-1">
				<Button asChild variant="outline" size="sm">
					<Link to="/apps/forms/$formId" params={{ formId: form.id }}>
						<PencilIcon aria-hidden />
						{m.forms_edit()}
					</Link>
				</Button>
				<Button asChild variant="ghost" size="sm">
					<Link to="/apps/forms/$formId/results" params={{ formId: form.id }} search={{ page: 1 }}>
						<BarChart3Icon aria-hidden />
						{m.forms_results()}
					</Link>
				</Button>
				{form.status === "published" ? (
					<CopyButton value={absoluteUrl(publicFormPath(form.slug))} label={m.forms_copy_link()} />
				) : null}
				<DropdownMenu modal={false}>
					<DropdownMenuTrigger asChild>
						<Button
							variant="ghost"
							size="icon-sm"
							className="ms-auto"
							aria-label={m.forms_actions({ title: form.title })}
						>
							<MoreHorizontalIcon aria-hidden />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						<DropdownMenuItem variant="destructive" onSelect={onDelete}>
							<Trash2Icon aria-hidden />
							{m.crud_delete()}
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>
		</li>
	);
}
