import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckIcon, HeartIcon, PlusIcon, ThumbsDownIcon, ThumbsUpIcon } from "lucide-react";
import { type ReactNode, useState } from "react";
import { toast } from "sonner";
import { errorMessage } from "@/components/errors/error-page";
import { Button } from "@/components/ui/button";
import { sessionQueryOptions } from "@/features/auth/queries";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { pardaLibraryKeys } from "../keys";
import { pardaSavedQueryOptions } from "./queries";
import type { LibraryMedia, SavedState } from "./types";
import { useEnsureViewer } from "./use-viewer-session";

/**
 * My List, ♥ and Like (PLAN Task 67, decision 0240): the buttons on cards, the title page,
 * a person's page and the player. Each reads what the profile saved (the layout loaded it
 * for a session), changes it at once, and starts a Parda guest first when there's no
 * session, as the marks do.
 */

const EMPTY: SavedState = { watchlist: [], favourite: [], people: [], likes: [], dislikes: [] };

type TitleRef = { media: LibraryMedia; id: number; title: string };

const keyOf = (ref: { media: LibraryMedia; id: number }) => `${ref.media}:${ref.id}`;
const toggled = <T,>(list: ReadonlyArray<T>, value: T, on: boolean) =>
	on ? [value, ...list.filter((each) => each !== value)] : list.filter((each) => each !== value);

export function useSaved(): SavedState {
	const { data: session } = useQuery(sessionQueryOptions());
	const { data } = useQuery({ ...pardaSavedQueryOptions(), enabled: Boolean(session) });
	return session ? (data ?? EMPTY) : EMPTY;
}

/** Runs a change: a session first, the buttons at once, the write, then the library reads again. */
function useSavedChange({ playerMounted = false }: { playerMounted?: boolean } = {}) {
	const queryClient = useQueryClient();
	const ensureViewer = useEnsureViewer({ playerMounted });
	const [pending, setPending] = useState(false);
	const run = async (change: (state: SavedState) => SavedState, write: () => Promise<unknown>) => {
		setPending(true);
		const key = pardaLibraryKeys.saved();
		const before = queryClient.getQueryData<SavedState>(key);
		try {
			if (!(await ensureViewer())) return;
			queryClient.setQueryData<SavedState>(key, (state) => change(state ?? EMPTY));
			await write();
			await queryClient.invalidateQueries({ queryKey: pardaLibraryKeys.all, refetchType: "active" });
		} catch (error) {
			queryClient.setQueryData(key, before);
			toast.error(errorMessage(error));
		} finally {
			setPending(false);
		}
	};
	return { run, pending };
}

function useListToggle(ref: TitleRef, kind: "watchlist" | "favourite", playerMounted?: boolean) {
	const saved = useSaved();
	const { run, pending } = useSavedChange({ playerMounted });
	const key = keyOf(ref);
	const on = saved[kind].includes(key);
	const toggle = () =>
		run(
			(state) => ({ ...state, [kind]: toggled(state[kind], key, !on) }),
			async () => {
				const { setPardaListed } = await import("@/functions/parda/library");
				await setPardaListed({ data: { media: ref.media, id: ref.id, kind, on: !on } });
			},
		);
	return { on, pending, toggle: () => void toggle() };
}

/** + My List as a labelled button (the title page). */
export function ListButton({ title, size = "lg" }: { title: TitleRef; size?: "sm" | "lg" }) {
	const { on, pending, toggle } = useListToggle(title, "watchlist");
	return (
		<Button variant="ghost" size={size} onClick={toggle} disabled={pending} aria-pressed={on} data-testid="list-toggle">
			{on ? <CheckIcon aria-hidden className="text-pd-action" /> : <PlusIcon aria-hidden />}
			{m.pd_my_list()}
		</Button>
	);
}

/** An icon button with its name for screen readers (and the pointer's tooltip). */
function IconToggle({
	on,
	pending,
	onClick,
	label,
	icon,
	testId,
	className,
}: {
	on: boolean;
	pending: boolean;
	onClick: () => void;
	label: string;
	icon: ReactNode;
	testId: string;
	className?: string;
}) {
	return (
		<Button
			variant="ghost"
			size="icon"
			onClick={onClick}
			disabled={pending}
			aria-pressed={on}
			title={label}
			className={className}
			data-testid={testId}
		>
			{icon}
			<span className="sr-only">{label}</span>
		</Button>
	);
}

/** + My List as an icon (the player's bar). */
export function ListIconButton({ title, playerMounted }: { title: TitleRef; playerMounted?: boolean }) {
	const { on, pending, toggle } = useListToggle(title, "watchlist", playerMounted);
	return (
		<IconToggle
			on={on}
			pending={pending}
			onClick={toggle}
			label={on ? m.pd_list_remove({ title: title.title }) : m.pd_list_add({ title: title.title })}
			icon={on ? <CheckIcon aria-hidden className="text-pd-action" /> : <PlusIcon aria-hidden />}
			testId="list-toggle"
		/>
	);
}

/** ♥ on a title. */
export function HeartButton({ title, playerMounted }: { title: TitleRef; playerMounted?: boolean }) {
	const { on, pending, toggle } = useListToggle(title, "favourite", playerMounted);
	return (
		<IconToggle
			on={on}
			pending={pending}
			onClick={toggle}
			label={on ? m.pd_favourite_remove({ title: title.title }) : m.pd_favourite_add({ title: title.title })}
			icon={<HeartIcon aria-hidden className={on ? "fill-current text-pd-action" : undefined} />}
			testId="favourite-toggle"
		/>
	);
}

/** ♥ on a person (their page). */
export function PersonHeartButton({ id, name }: { id: number; name: string }) {
	const saved = useSaved();
	const { run, pending } = useSavedChange();
	const on = saved.people.includes(id);
	const toggle = () =>
		run(
			(state) => ({ ...state, people: toggled(state.people, id, !on) }),
			async () => {
				const { setPardaPersonFavourite } = await import("@/functions/parda/library");
				await setPardaPersonFavourite({ data: { id, on: !on } });
			},
		);
	return (
		<Button
			variant="outline"
			size="sm"
			onClick={() => void toggle()}
			disabled={pending}
			aria-pressed={on}
			className="self-start"
			data-testid="person-favourite"
		>
			<HeartIcon aria-hidden className={on ? "fill-current text-pd-action" : undefined} />
			{on ? m.pd_person_favourite_on() : m.pd_person_favourite({ name })}
		</Button>
	);
}

/** Like and Not for me: pressing the pressed one takes it back. */
export function RateButtons({ title }: { title: TitleRef }) {
	const saved = useSaved();
	const { run, pending } = useSavedChange();
	const key = keyOf(title);
	const current = saved.likes.includes(key) ? "like" : saved.dislikes.includes(key) ? "dislike" : null;
	const rate = (value: "like" | "dislike") => {
		const next = current === value ? null : value;
		void run(
			(state) => ({
				...state,
				likes: toggled(state.likes, key, next === "like"),
				dislikes: toggled(state.dislikes, key, next === "dislike"),
			}),
			async () => {
				const { ratePardaTitle } = await import("@/functions/parda/library");
				await ratePardaTitle({ data: { media: title.media, id: title.id, value: next } });
			},
		);
	};
	return (
		<span className="inline-flex items-center">
			<IconToggle
				on={current === "like"}
				pending={pending}
				onClick={() => rate("like")}
				label={m.pd_rate_like()}
				icon={<ThumbsUpIcon aria-hidden className={current === "like" ? "fill-current text-pd-action" : undefined} />}
				testId="rate-like"
			/>
			<IconToggle
				on={current === "dislike"}
				pending={pending}
				onClick={() => rate("dislike")}
				label={m.pd_rate_dislike()}
				icon={
					<ThumbsDownIcon aria-hidden className={current === "dislike" ? "fill-current text-pd-action" : undefined} />
				}
				testId="rate-dislike"
			/>
		</span>
	);
}

/**
 * + My List on a poster: over the picture's corner, like Continue watching's *Remove*.
 * A fine pointer sees it on the card's hover or focus; touch always; a listed title
 * always shows its tick.
 */
export function CardListToggle({
	title,
	kind = "watchlist",
}: {
	title: TitleRef;
	/** ♥'s grid toggles ♥ instead. */
	kind?: "watchlist" | "favourite";
}) {
	const { on, pending, toggle } = useListToggle(title, kind);
	const label =
		kind === "favourite"
			? on
				? m.pd_favourite_remove({ title: title.title })
				: m.pd_favourite_add({ title: title.title })
			: on
				? m.pd_list_remove({ title: title.title })
				: m.pd_list_add({ title: title.title });
	return (
		<Button
			variant="ghost"
			size="icon"
			onClick={toggle}
			disabled={pending}
			aria-pressed={on}
			title={label}
			className={cn(
				"size-8 rounded-none bg-black/60 text-pd-on-picture hover:bg-black/80 hover:text-pd-on-picture",
				on
					? null
					: "opacity-0 focus-visible:opacity-100 group-focus-within/card:opacity-100 group-hover/card:opacity-100 pointer-coarse:opacity-100",
			)}
			data-testid={kind === "favourite" ? "card-favourite-toggle" : "card-list-toggle"}
		>
			{kind === "favourite" ? (
				<HeartIcon aria-hidden className={on ? "fill-current text-pd-action" : undefined} />
			) : on ? (
				<CheckIcon aria-hidden className="text-pd-action" />
			) : (
				<PlusIcon aria-hidden />
			)}
			<span className="sr-only">{label}</span>
		</Button>
	);
}
