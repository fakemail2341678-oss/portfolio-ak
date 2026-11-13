import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, type LinkOptions, useLocation } from "@tanstack/react-router";
import {
	BellIcon,
	FileUpIcon,
	HouseIcon,
	type LucideIcon,
	PlusIcon,
	SearchIcon,
	UserIcon,
	UserPlusIcon,
	UsersIcon,
	WalletIcon,
} from "lucide-react";
import { lazy, type ReactNode, Suspense, useEffect, useRef, useState } from "react";
import { ConfirmProvider } from "@/components/dialogs/confirm";
import { NavigationProgress } from "@/components/layout/navigation-progress";
import { sessionQueryOptions } from "@/features/auth/queries";
import { useHotkeys } from "@/hooks/use-hotkeys";
import { GUEST_LIFETIME_DAYS } from "@/lib/guests";
import { formatNumber } from "@/lib/i18n/intl";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { KHARCHA_NAME } from "../brand";
import { KharchaMark, KharchaWordmark } from "../kit/wordmark";
import { kharchaLinks } from "../links";
import { kharchaMeQueryOptions, kharchaRevQueryOptions, refreshKharcha } from "../queries";
import {
	type CreateAction,
	type ExpenseStart,
	InKharchaShell,
	type KharchaActions,
	KharchaActionsContext,
	type SettleStart,
	useKharchaUserId,
} from "./actions";
import { CreateMenu } from "./create-menu";
import { KharchaPalette } from "./kharcha-palette";
import { KharchaUserMenu } from "./kharcha-user-menu";
import { KharchaShortcutsDialog } from "./shortcuts-dialog";

const CreateDialog = lazy(() => import("./create-dialogs"));
const ExpenseDialog = lazy(() => import("../expenses/expense-dialog"));
const SettleDialog = lazy(() => import("../settle/settle-dialog"));

/** The shell's open dialog: one of the + menu's, the expense dialog or the settle-up dialog with what it starts from. */
type ShellDialog =
	| { action: Exclude<CreateAction, "expense" | "split" | "settle"> }
	| ({ action: "expense" } & ExpenseStart)
	| { action: "settle"; start: SettleStart };

type NavItem = { key: string; label: () => string; icon: LucideIcon; link: () => LinkOptions };

/** The rail's and the tabs' pages (PLAN 14.5 "UX"): each arrives with its route (Insights in 94). */
const NAV: ReadonlyArray<NavItem> = [
	{ key: "home", label: () => m.kharcha_nav_home(), icon: HouseIcon, link: () => kharchaLinks.home() },
	{ key: "spend", label: () => m.kharcha_nav_spend(), icon: WalletIcon, link: () => kharchaLinks.spend() },
	{ key: "people", label: () => m.kharcha_nav_people(), icon: UsersIcon, link: () => kharchaLinks.people() },
];

/**
 * Kharcha's frame (PLAN 14.5 "UX", decision 0282): on a laptop the red bookcloth rail
 * (the mark, the pages, search, and the caller's plate at its foot); on a phone the red
 * top bar, bottom tabs and the floating +. Around the page: the guest banner, the confirm
 * dialog pages ask through, the palette, the shortcuts and the + menu's dialogs. It polls
 * the caller's `rev` and refetches their pages when it moves. The page renders its own <main>.
 */
export function KharchaShell({ children }: { children: ReactNode }) {
	const { data: session } = useQuery(sessionQueryOptions());
	const userId = useKharchaUserId();
	const { data: me } = useQuery({ ...kharchaMeQueryOptions(userId), enabled: Boolean(session) });
	const [paletteOpen, setPaletteOpen] = useState(false);
	const [shortcutsOpen, setShortcutsOpen] = useState(false);
	const [dialog, setDialog] = useState<ShellDialog | null>(null);
	const unread = useFreshness(session ? userId : "");
	const actions: KharchaActions = {
		openPalette: () => setPaletteOpen(true),
		openShortcuts: () => setShortcutsOpen(true),
		create: (action) =>
			setDialog(
				action === "split"
					? { action: "expense", split: true }
					: action === "expense"
						? { action: "expense" }
						: action === "settle"
							? { action: "settle", start: {} }
							: { action },
			),
		addExpense: (start = {}) => setDialog({ action: "expense", ...start }),
		editExpense: (expense) => setDialog({ action: "expense", expense }),
		settleUp: (start = {}) => setDialog({ action: "settle", start }),
	};
	useHotkeys({
		"mod+k": () => setPaletteOpen((open) => !open),
		"shift+?": () => setShortcutsOpen(true),
		n: () => actions.addExpense(),
	});
	const dragging = useDropReceipts((files) => actions.addExpense({ files }), Boolean(me) && dialog === null);
	const guest = session?.isAnonymous === true;
	return (
		<KharchaActionsContext value={actions}>
			<ConfirmProvider>
				<div className="flex min-h-dvh flex-1 bg-kh-ground text-kh-ink" data-testid="kharcha-shell">
					<NavigationProgress />
					<Rail person={me?.person} onSearch={actions.openPalette} unread={unread} />
					<div className="flex min-w-0 flex-1 flex-col pb-16 md:pb-0">
						<PhoneBar person={me?.person} onSearch={actions.openPalette} unread={unread} />
						{guest ? <GuestBanner /> : null}
						<InKharchaShell value>{children}</InKharchaShell>
					</div>
					<PhoneTabs guest={guest} />
					<div className="fixed end-4 bottom-20 z-30 md:hidden">
						<CreateMenu side="top">
							<button
								type="button"
								className="kh-ease grid size-14 place-items-center rounded-xl bg-kh-act text-kh-on-act shadow-[0_2px_4px_rgb(0_0_0/0.2),0_10px_24px_rgb(0_0_0/0.22)] outline-none hover:brightness-110 focus-visible:ring-[3px] focus-visible:ring-kh-thread"
								data-testid="kharcha-fab"
							>
								<PlusIcon className="size-6" aria-hidden />
								<span className="sr-only">{m.kharcha_create_label()}</span>
							</button>
						</CreateMenu>
					</div>
				</div>
				<KharchaPalette
					open={paletteOpen}
					onOpenChange={setPaletteOpen}
					onOpenShortcuts={actions.openShortcuts}
					onCreate={actions.create}
				/>
				<KharchaShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
				{dialog && me ? (
					<Suspense fallback={null}>
						{dialog.action === "expense" ? (
							<ExpenseDialog
								me={me}
								userId={userId}
								onClose={() => setDialog(null)}
								{...(dialog.expense ? { expense: dialog.expense } : {})}
								{...(dialog.draft ? { draft: dialog.draft } : {})}
								{...(dialog.files ? { files: dialog.files } : {})}
								{...(dialog.groupId ? { groupId: dialog.groupId } : {})}
								{...(dialog.with ? { with: dialog.with } : {})}
								{...(dialog.split ? { split: true } : {})}
							/>
						) : dialog.action === "settle" ? (
							<SettleDialog me={me} userId={userId} start={dialog.start} onClose={() => setDialog(null)} />
						) : (
							<CreateDialog action={dialog.action} me={me} userId={userId} onClose={() => setDialog(null)} />
						)}
					</Suspense>
				) : null}
				{dragging ? (
					<div
						className="pointer-events-none fixed inset-3 z-50 grid place-items-center rounded-xl border-2 border-kh-act border-dashed bg-kh-page/90"
						aria-hidden
						data-testid="kharcha-drop"
					>
						<p className="flex items-center gap-2 font-semibold text-kh-mark">
							<FileUpIcon className="size-5" />
							{m.kharcha_drop_receipt()}
						</p>
					</div>
				) : null}
			</ConfirmProvider>
		</KharchaActionsContext>
	);
}

/** Whether a drag holds files (not text or a link dragged within the page). */
const hasFiles = (event: DragEvent) => Array.from(event.dataTransfer?.types ?? []).includes("Files");

/**
 * Drop a receipt anywhere (PLAN 14.5 "Receipts"): files dragged over any page show where to
 * drop them, and dropping starts an expense with them. Off while a dialog is open (its own
 * fields take files) or before the caller is known.
 */
function useDropReceipts(onFiles: (files: File[]) => void, enabled: boolean): boolean {
	const [dragging, setDragging] = useState(false);
	const latest = useRef(onFiles);
	latest.current = onFiles;
	useEffect(() => {
		if (!enabled) return;
		let depth = 0;
		const enter = (event: DragEvent) => {
			if (!hasFiles(event)) return;
			depth++;
			setDragging(true);
		};
		const leave = (event: DragEvent) => {
			if (!hasFiles(event)) return;
			depth = Math.max(0, depth - 1);
			if (depth === 0) setDragging(false);
		};
		const over = (event: DragEvent) => {
			if (hasFiles(event)) event.preventDefault();
		};
		const drop = (event: DragEvent) => {
			if (!hasFiles(event)) return;
			event.preventDefault();
			depth = 0;
			setDragging(false);
			const files = Array.from(event.dataTransfer?.files ?? []);
			if (files.length > 0) latest.current(files);
		};
		window.addEventListener("dragenter", enter);
		window.addEventListener("dragleave", leave);
		window.addEventListener("dragover", over);
		window.addEventListener("drop", drop);
		return () => {
			window.removeEventListener("dragenter", enter);
			window.removeEventListener("dragleave", leave);
			window.removeEventListener("dragover", over);
			window.removeEventListener("drop", drop);
			setDragging(false);
		};
	}, [enabled]);
	return dragging;
}

/**
 * Freshness (PLAN 14.5): the `rev` query polls every 15 s while the page is visible and on
 * focus; when it moved since the last read, everything the caller's pages show refetches.
 * The same answer carries the bell's unread count (Task 92), which it returns.
 */
function useFreshness(userId: string): number {
	const queryClient = useQueryClient();
	const { data: pulse } = useQuery({ ...kharchaRevQueryOptions(userId), enabled: Boolean(userId) });
	const rev = pulse?.rev;
	const seen = useRef<number | undefined>(undefined);
	useEffect(() => {
		if (rev === undefined) return;
		if (seen.current !== undefined && seen.current !== rev) void refreshKharcha(queryClient, userId);
		seen.current = rev;
	}, [rev, queryClient, userId]);
	return pulse?.unread ?? 0;
}

/** "Updates", with how many are unread: a link to Home's Updates (Task 92). */
function Bell({ unread, className, place }: { unread: number; className: string; place: "rail" | "bar" }) {
	return (
		<Link {...kharchaLinks.updates()} className={cn("relative", className)} data-testid={`kharcha-bell-${place}`}>
			<BellIcon className="size-5" aria-hidden />
			{place === "rail" ? m.kharcha_nav_updates() : <span className="sr-only">{m.kharcha_nav_updates()}</span>}
			{unread > 0 ? (
				<>
					<span className="sr-only">{` ${m.kharcha_bell_unread({ count: formatNumber(unread) })}`}</span>
					<span
						className={cn(
							"kh-figures absolute grid h-4 min-w-4 place-items-center rounded-full bg-kh-thread px-1 font-semibold text-[0.625rem] text-kh-cloth-deep leading-none",
							place === "rail" ? "start-[calc(50%+0.25rem)] top-1" : "end-1.5 top-1.5",
						)}
						aria-hidden
						data-testid="kharcha-bell-count"
					>
						{unread > 99 ? `${formatNumber(99)}+` : formatNumber(unread)}
					</span>
				</>
			) : null}
		</Link>
	);
}

const railItem =
	"kh-ease flex w-13 flex-col items-center gap-1 rounded-md px-0.5 pt-2 pb-1.5 text-center font-medium text-[0.6875rem] leading-tight outline-none focus-visible:ring-[3px] focus-visible:ring-kh-thread";

/** The laptop's rail: red bookcloth edged with the yellow thread (decision 0281). */
function Rail({
	person,
	onSearch,
	unread,
}: {
	person: Parameters<typeof KharchaUserMenu>[0]["person"];
	onSearch: () => void;
	unread: number;
}) {
	return (
		<nav
			aria-label={m.kharcha_nav_label()}
			className="sticky top-0 hidden h-dvh w-16 shrink-0 flex-col items-center gap-1 bg-kh-cloth pt-4 pb-3 text-kh-cloth-muted shadow-[inset_-2px_0_0_var(--kh-thread)] md:flex"
			data-testid="kharcha-rail"
		>
			<Link
				{...kharchaLinks.home()}
				className="mb-4 rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-kh-thread"
			>
				<KharchaMark className="shadow-none" />
				<span className="sr-only">{KHARCHA_NAME}</span>
			</Link>
			{NAV.map((item) => (
				<Link
					key={item.key}
					{...item.link()}
					className={cn(railItem, "hover:bg-kh-cloth-deep/70 hover:text-kh-on-cloth")}
					activeProps={{
						className: "bg-kh-cloth-deep text-kh-on-cloth [&>svg]:text-kh-thread",
						"aria-current": "page",
					}}
				>
					<item.icon className="size-5" aria-hidden />
					{item.label()}
				</Link>
			))}
			<Bell unread={unread} place="rail" className={cn(railItem, "hover:bg-kh-cloth-deep/70 hover:text-kh-on-cloth")} />
			<button
				type="button"
				onClick={onSearch}
				className={cn(railItem, "hover:bg-kh-cloth-deep/70 hover:text-kh-on-cloth")}
				aria-keyshortcuts="Control+K Meta+K"
				data-testid="open-command-menu"
			>
				<SearchIcon className="size-5" aria-hidden />
				{m.kharcha_nav_search()}
			</button>
			<div className="flex-1" />
			<KharchaUserMenu person={person} place="rail" />
		</nav>
	);
}

/** The phone's top bar: the wordmark on the cloth, search and the caller's plate. */
function PhoneBar({
	person,
	onSearch,
	unread,
}: {
	person: Parameters<typeof KharchaUserMenu>[0]["person"];
	onSearch: () => void;
	unread: number;
}) {
	return (
		<header
			className="sticky top-0 z-20 flex h-13 shrink-0 items-center gap-1 bg-kh-cloth ps-3.5 pe-1.5 text-kh-on-cloth shadow-[inset_0_-2px_0_var(--kh-thread)] md:hidden"
			data-testid="kharcha-bar"
		>
			<Link
				{...kharchaLinks.home()}
				className="me-auto rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-kh-thread"
			>
				<KharchaWordmark onCloth className="text-[1.0625rem]" />
			</Link>
			<Bell
				unread={unread}
				place="bar"
				className="kh-ease grid size-11 place-items-center rounded-md outline-none hover:bg-kh-cloth-deep/70 focus-visible:ring-[3px] focus-visible:ring-kh-thread"
			/>
			<button
				type="button"
				onClick={onSearch}
				className="kh-ease grid size-11 place-items-center rounded-md outline-none hover:bg-kh-cloth-deep/70 focus-visible:ring-[3px] focus-visible:ring-kh-thread"
				aria-keyshortcuts="Control+K Meta+K"
			>
				<SearchIcon className="size-5" aria-hidden />
				<span className="sr-only">{m.command_open()}</span>
			</button>
			<KharchaUserMenu person={person} place="bar" />
		</header>
	);
}

/** The phone's bottom tabs: the pages, and the account (a guest's is sign-up). */
function PhoneTabs({ guest }: { guest: boolean }) {
	const location = useLocation();
	const tab =
		"kh-ease flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-md text-[0.6875rem] outline-none focus-visible:ring-[3px] focus-visible:ring-ring";
	return (
		<nav
			aria-label={m.kharcha_tabs_label()}
			className="fixed inset-x-0 bottom-0 z-30 grid h-16 auto-cols-fr grid-flow-col items-center border-kh-hair border-t bg-kh-page px-2 text-kh-muted md:hidden"
			data-testid="kharcha-tabs"
		>
			{NAV.map((item) => (
				<Link
					key={item.key}
					{...item.link()}
					className={tab}
					activeProps={{ className: "font-semibold text-kh-mark", "aria-current": "page" }}
				>
					<item.icon className="size-5" aria-hidden />
					{item.label()}
				</Link>
			))}
			{guest ? (
				<Link {...kharchaLinks.signUp(location.href)} className={tab}>
					<UserPlusIcon className="size-5" aria-hidden />
					{m.kharcha_tab_sign_up()}
				</Link>
			) : (
				<Link
					{...kharchaLinks.account()}
					className={tab}
					activeProps={{ className: "font-semibold text-kh-mark", "aria-current": "page" }}
				>
					<UserIcon className="size-5" aria-hidden />
					{m.nav_account()}
				</Link>
			)}
		</nav>
	);
}

/** Shown to a guest (decision 0185) on every page: how long the sample lives, and how to keep it. */
function GuestBanner() {
	const location = useLocation();
	return (
		<aside
			aria-label={m.guest_banner_label()}
			className="border-kh-hair border-b bg-kh-page"
			data-testid="guest-banner"
		>
			<p className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-caption sm:px-8">
				<span>{m.kharcha_guest_banner({ days: formatNumber(GUEST_LIFETIME_DAYS) })}</span>
				<Link {...kharchaLinks.signUp(location.href)} className="font-medium text-kh-mark underline underline-offset-4">
					{m.kharcha_guest_banner_action()}
				</Link>
			</p>
		</aside>
	);
}
