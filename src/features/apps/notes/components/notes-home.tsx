import { useDbClient, useLiveSuspenseQuery } from "@tanstack/react-db";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi, Link, useLocation, useNavigate } from "@tanstack/react-router";
import {
	ArchiveIcon,
	ArchiveRestoreIcon,
	Globe2Icon,
	ImageIcon,
	MoreHorizontalIcon,
	NotebookTextIcon,
	PinIcon,
	PinOffIcon,
	PlusIcon,
	SearchIcon,
	ShareIcon,
	Trash2Icon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { RelativeTime } from "@/components/data-display/relative-time";
import { useConfirm } from "@/components/dialogs/confirm";
import { errorMessage } from "@/components/errors/error-page";
import { FilterBar } from "@/components/filters/filter-bar";
import { SearchFilter } from "@/components/filters/filters";
import { EmptyState } from "@/components/page/empty-state";
import { Page, PageHeader } from "@/components/page/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CloudImage } from "@/features/attachments/components/cloud-image";
import { GUEST_LIFETIME_DAYS } from "@/lib/guests";
import { formatNumber } from "@/lib/i18n/intl";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { TryAppButton } from "../../components/try-app-button";
import { notesCollection } from "../collections";
import { visibleNotes } from "../list";
import { notesListQueryOptions, notesSearchQueryOptions } from "../queries";
import type { NotesSearch } from "../search";
import { NOTES_QUOTAS, type NoteSummary } from "../types";

const route = getRouteApi("/_apps/apps/notes/");

/**
 * /apps/notes (decision 0190): the app's landing for a visitor (what it is, "Try it"),
 * the user's notes once they have a session (a guest's included). The landing is what
 * search engines see.
 */
export function NotesHome() {
	const { session } = route.useRouteContext();
	return session ? <NotesList userId={session.user.id} /> : <NotesLanding />;
}

function NotesLanding() {
	const location = useLocation();
	const features = [
		{ icon: SearchIcon, title: m.notes_feature_search(), body: m.notes_feature_search_body() },
		{ icon: ImageIcon, title: m.notes_feature_write(), body: m.notes_feature_write_body() },
		{ icon: ShareIcon, title: m.notes_feature_share(), body: m.notes_feature_share_body() },
	];
	return (
		<Page width="wide" data-testid="notes-landing">
			<div className="grid items-center gap-10 lg:grid-cols-[1fr_minmax(0,28rem)]">
				<div className="flex flex-col gap-6">
					<PageHeader size="display" title={m.notes_name()} description={m.notes_description()} />
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
				<NotesPreview />
			</div>
			<section aria-labelledby="notes-features" className="flex flex-col gap-4">
				<h2 id="notes-features" className="text-heading">
					{m.notes_features_title()}
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

/** A still picture of a few notes (decorative: the text beside it says what the app does). */
function NotesPreview() {
	const notes = [
		{ title: m.notes_seed_welcome(), tag: m.notes_seed_tag_start(), pinned: true },
		{ title: m.notes_seed_search(), tag: m.notes_seed_tag_start(), pinned: false },
		{ title: m.notes_seed_ideas(), tag: m.notes_seed_tag_ideas(), pinned: false },
	];
	return (
		<div aria-hidden className="flex flex-col gap-2 rounded-xl border bg-surface-1 p-3 shadow-sm">
			<div className="flex h-8 items-center gap-2 rounded-md border bg-background px-2 text-caption text-muted-foreground">
				<SearchIcon className="size-3.5" />
				{m.notes_search_placeholder()}
			</div>
			{notes.map((note) => (
				<div key={note.title} className="flex flex-col gap-1 rounded-lg border bg-background p-3">
					<p className="flex items-center gap-1.5 font-medium text-caption">
						{note.pinned ? <PinIcon className="size-3 text-primary" /> : null}
						{note.title}
					</p>
					<span className="w-fit rounded-sm bg-surface-2 px-1.5 text-caption text-muted-foreground">#{note.tag}</span>
				</div>
			))}
		</div>
	);
}

function NotesList({ userId }: { userId: string }) {
	const search = route.useSearch();
	const navigate = useNavigate();
	const confirm = useConfirm();
	const {
		data: { now },
	} = useSuspenseQuery(notesListQueryOptions(userId));
	const collection = useDbClient().collection(notesCollection(userId));
	const { data: notes } = useLiveSuspenseQuery((q) => q.from({ note: collection }), [collection]);
	// The loader has read the matches of `q` (when there is one), so this renders on the server too.
	const matches = useQuery({ ...notesSearchQueryOptions(userId, search.q), enabled: search.q !== "" });
	const [creating, setCreating] = useState(false);
	const shown = visibleNotes(notes, search, search.q ? (matches.data?.ids ?? []) : null);
	const tags = [...new Set(notes.flatMap((note) => note.tags))].sort((a, b) => a.localeCompare(b));
	const full = notes.length >= NOTES_QUOTAS.notes;

	const create = async () => {
		setCreating(true);
		const id = crypto.randomUUID();
		const transaction = collection.insert({
			id,
			title: m.notes_untitled(),
			excerpt: "",
			tags: [],
			pinned: false,
			archived: false,
			shared: false,
			cover: null,
			updatedAt: new Date().toISOString(),
		});
		try {
			await transaction.isPersisted.promise;
			await navigate({ to: "/apps/notes/$noteId", params: { noteId: id } });
		} catch (error) {
			toast.error(m.common_toast_failed(), { description: errorMessage(error) });
		} finally {
			setCreating(false);
		}
	};

	/** A change that shows at once; if the server refuses it, DB has put it back and this says so. */
	const change = (note: NoteSummary, patch: Partial<Pick<NoteSummary, "pinned" | "archived">>, done: string) => {
		const transaction = collection.update(note.id, (draft) => Object.assign(draft, patch));
		transaction.isPersisted.promise.then(
			() => toast.success(done),
			(error: unknown) => toast.error(m.notes_rolled_back(), { description: errorMessage(error) }),
		);
	};

	const remove = async (note: NoteSummary) => {
		const confirmed = await confirm({
			title: m.crud_delete_title({ label: note.title }),
			description: m.notes_delete_body(),
			confirmLabel: m.crud_delete(),
			destructive: true,
		});
		if (!confirmed) return;
		collection.delete(note.id).isPersisted.promise.then(
			() => toast.success(m.crud_toast_deleted({ label: note.title })),
			(error: unknown) => toast.error(m.notes_rolled_back(), { description: errorMessage(error) }),
		);
	};

	const newButton = (
		<Button onClick={() => void create()} disabled={full || creating} data-testid="notes-new">
			<PlusIcon aria-hidden />
			{m.notes_new()}
		</Button>
	);
	const filtered = Boolean(search.q || search.tag);

	return (
		<Page width="wide" data-testid="notes-list">
			<PageHeader
				title={m.notes_title()}
				description={m.notes_count({ count: formatNumber(notes.length), max: formatNumber(NOTES_QUOTAS.notes) })}
				actions={newButton}
			/>
			<div className="flex flex-col gap-3">
				{/* Searches as you type; without JavaScript, "Apply" submits it (a GET form). */}
				<FilterBar values={search} preserve={["view", "tag"]} label={m.notes_search_label()}>
					<SearchFilter
						label={m.notes_search_label()}
						hideLabel
						value={search.q}
						placeholder={m.notes_search_placeholder()}
						className="sm:w-96"
					/>
				</FilterBar>
				<nav aria-label={m.notes_views()} className="flex flex-wrap items-center gap-2">
					<ViewLink view="notes" current={search.view} label={m.notes_view_notes()} />
					<ViewLink view="archive" current={search.view} label={m.notes_view_archive()} />
					{tags.length > 0 ? <span className="mx-1 h-5 w-px bg-border" aria-hidden /> : null}
					{tags.map((tag) => (
						<Link
							key={tag}
							to="/apps/notes"
							search={{ ...search, tag: search.tag === tag ? "" : tag }}
							aria-current={search.tag === tag ? "true" : undefined}
							className={cn(
								"rounded-md border px-2 py-0.5 text-caption outline-none transition-colors hover:bg-surface-2 focus-visible:ring-[3px] focus-visible:ring-ring/50",
								search.tag === tag && "border-primary bg-primary/10 text-foreground",
							)}
						>
							#{tag}
						</Link>
					))}
				</nav>
			</div>
			{search.q ? (
				<p className="text-muted-foreground text-sm" aria-live="polite" data-testid="notes-results">
					{m.notes_results({ count: formatNumber(shown.length), q: search.q })}
				</p>
			) : null}
			{shown.length === 0 ? (
				<EmptyState
					icon={NotebookTextIcon}
					variant={filtered ? "no-matches" : "empty"}
					title={
						filtered
							? m.notes_no_matches()
							: search.view === "archive"
								? m.notes_archive_empty()
								: m.notes_empty_title()
					}
					description={filtered ? m.notes_no_matches_body() : search.view === "archive" ? "" : m.notes_empty_body()}
					primaryAction={filtered || search.view === "archive" ? undefined : newButton}
				/>
			) : (
				<ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
					{shown.map((note) => (
						<li key={note.id} className="relative flex flex-col overflow-hidden rounded-lg border bg-surface-1">
							{note.cover ? (
								<CloudImage
									image={note.cover}
									variant="cover"
									sizes="(min-width: 1024px) 22rem, (min-width: 640px) 50vw, 100vw"
									alt=""
									className="aspect-video w-full object-cover"
									loading="lazy"
								/>
							) : null}
							<div className="flex flex-1 flex-col gap-2 p-4 pe-12">
								<Link
									to="/apps/notes/$noteId"
									params={{ noteId: note.id }}
									className="font-medium text-body outline-none after:absolute after:inset-0 focus-visible:after:ring-[3px] focus-visible:after:ring-ring/50"
									data-testid="notes-open"
								>
									{note.pinned ? (
										<>
											<PinIcon className="me-1.5 inline size-3.5 align-[-2px] text-primary" aria-hidden />
											<span className="sr-only">{m.notes_pinned()} </span>
										</>
									) : null}
									{note.title}
								</Link>
								{note.excerpt ? <p className="line-clamp-3 text-muted-foreground text-sm">{note.excerpt}</p> : null}
								<div className="mt-auto flex flex-wrap items-center gap-1.5 pt-1">
									{note.shared ? (
										<Badge variant="secondary">
											<Globe2Icon aria-hidden />
											{m.notes_shared()}
										</Badge>
									) : null}
									{note.tags.map((tag) => (
										<Badge key={tag} variant="outline">
											#{tag}
										</Badge>
									))}
									<span className="ms-auto text-caption text-muted-foreground">
										<RelativeTime value={note.updatedAt} now={now} />
									</span>
								</div>
							</div>
							<DropdownMenu modal={false}>
								<DropdownMenuTrigger asChild>
									<Button
										variant="ghost"
										size="icon"
										className="absolute end-2 top-2 z-10"
										aria-label={m.notes_actions({ title: note.title })}
										data-testid="notes-menu"
									>
										<MoreHorizontalIcon aria-hidden />
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent align="end">
									<DropdownMenuItem
										onSelect={() =>
											change(
												note,
												{ pinned: !note.pinned },
												note.pinned ? m.notes_toast_unpinned() : m.notes_toast_pinned(),
											)
										}
									>
										{note.pinned ? <PinOffIcon aria-hidden /> : <PinIcon aria-hidden />}
										{note.pinned ? m.notes_unpin() : m.notes_pin()}
									</DropdownMenuItem>
									<DropdownMenuItem
										onSelect={() =>
											change(
												note,
												{ archived: !note.archived },
												note.archived ? m.notes_toast_restored() : m.notes_toast_archived(),
											)
										}
										data-testid="notes-archive"
									>
										{note.archived ? <ArchiveRestoreIcon aria-hidden /> : <ArchiveIcon aria-hidden />}
										{note.archived ? m.notes_restore() : m.notes_archive()}
									</DropdownMenuItem>
									<DropdownMenuSeparator />
									<DropdownMenuItem variant="destructive" onSelect={() => void remove(note)}>
										<Trash2Icon aria-hidden />
										{m.crud_delete()}
									</DropdownMenuItem>
								</DropdownMenuContent>
							</DropdownMenu>
						</li>
					))}
				</ul>
			)}
		</Page>
	);
}

function ViewLink({
	view,
	current,
	label,
}: {
	view: NotesSearch["view"];
	current: NotesSearch["view"];
	label: string;
}) {
	const search = route.useSearch();
	return (
		<Link
			to="/apps/notes"
			search={{ ...search, view, q: "" }}
			aria-current={view === current ? "page" : undefined}
			className={cn(
				"rounded-md px-2.5 py-1 font-medium text-sm outline-none transition-colors hover:bg-surface-2 focus-visible:ring-[3px] focus-visible:ring-ring/50",
				view === current ? "bg-surface-2 text-foreground" : "text-muted-foreground",
			)}
		>
			{label}
		</Link>
	);
}
