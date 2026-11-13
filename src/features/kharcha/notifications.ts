import { formatMoney } from "@/lib/i18n/currency";
import { m } from "@/paraglide/messages";
import type { Locale } from "@/paraglide/runtime";
import type { Amount } from "./types";

/**
 * Kharcha's conversations and notifications, shared by the server and the browser (Task 92,
 * decision 0286; docs/guides/kharcha.md "Conversations and notifications").
 */

/**
 * A thread, named from the reader's side: a group's (`g:<group>`), the one with a friend
 * (`f:<their person>`) or an expense's (`e:<expense>`). Comments, read marks and
 * notifications use it; the tables keep the group, the pair or the expense themselves.
 */
export type ThreadKey = `g:${string}` | `f:${string}` | `e:${string}`;
export const THREAD_KEY = /^[gfe]:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export type ThreadKind = "g" | "f" | "e";

export const threadKey = (kind: ThreadKind, id: string): ThreadKey => `${kind}:${id}` as ThreadKey;
export const parseThread = (key: ThreadKey): { kind: ThreadKind; id: string } => ({
	kind: key.slice(0, 1) as ThreadKind,
	id: key.slice(2),
});

/** A thread's page, unlocalized: a group's, a friend's or an expense's. */
export const threadPath = (key: ThreadKey): string => {
	const { kind, id } = parseThread(key);
	return kind === "g" ? `/app/kharcha/g/${id}` : kind === "f" ? `/app/kharcha/f/${id}` : `/app/kharcha/e/${id}`;
};

/** What a comment may be: plain text, up to this long. */
export const COMMENT_MAX = 2000;
/** Comments one person writes: 60 per 10 minutes (PLAN 14.5 "Rate limits"). */
export const COMMENT_LIMIT = { max: 60, windowSeconds: 10 * 60 } as const;

/** The fixed set of reactions, each with its name for screen readers. */
export const REACTIONS = ["👍", "❤️", "😂", "🎉", "🙏", "😮"] as const;
export type Reaction = (typeof REACTIONS)[number];
export const reactionLabel = (emoji: Reaction): string =>
	({
		"👍": m.kharcha_reaction_thumbs,
		"❤️": m.kharcha_reaction_heart,
		"😂": m.kharcha_reaction_laugh,
		"🎉": m.kharcha_reaction_party,
		"🙏": m.kharcha_reaction_thanks,
		"😮": m.kharcha_reaction_wow,
	})[emoji]();

/**
 * What someone hears about (PLAN 14.5 "Notifications and email"). Budgets and recurring
 * expenses add theirs with Task 94.
 */
export const NOTIFY_KINDS = [
	"group.added",
	"expense.added",
	"expense.updated",
	"expense.deleted",
	"payment.received",
	"comment.mention",
	"comment.thread",
	"reminder",
] as const;
export type NotifyKind = (typeof NOTIFY_KINDS)[number];

/** How a kind is emailed: at once, in the daily digest, or not at all (it is on Home either way). */
export const NOTIFY_EMAILS = ["instant", "digest", "none"] as const;
export type NotifyEmail = (typeof NOTIFY_EMAILS)[number];

/** By default only "added you", payments and reminders are emailed at once; the rest wait for the digest. */
export const NOTIFY_DEFAULTS: Readonly<Record<NotifyKind, NotifyEmail>> = {
	"group.added": "instant",
	"expense.added": "digest",
	"expense.updated": "digest",
	"expense.deleted": "digest",
	"payment.received": "instant",
	"comment.mention": "digest",
	"comment.thread": "digest",
	reminder: "instant",
};

/** A person's choices over the defaults (`kh_profile.notify`): only what they changed is stored. */
export type NotifySettings = Partial<Record<NotifyKind, NotifyEmail>>;

export const notifyMode = (
	settings: NotifySettings | Readonly<Record<string, string>>,
	kind: NotifyKind,
): NotifyEmail => {
	const chosen = (settings as Record<string, string | undefined>)[kind];
	return chosen && (NOTIFY_EMAILS as readonly string[]).includes(chosen)
		? (chosen as NotifyEmail)
		: NOTIFY_DEFAULTS[kind];
};

/**
 * A snapshot for the sentence, taken when it was made: who did it, what it was about (an
 * expense's title, a group's name), the group, the money, the start of a comment.
 */
export type NotificationData = {
	actor?: string;
	title?: string;
	group?: string;
	amounts?: Amount[];
	excerpt?: string;
};

const amountsText = (amounts: ReadonlyArray<Amount> | undefined, locale?: Locale) =>
	(amounts ?? []).map((amount) => formatMoney(amount.amountMinor, amount.currency, locale)).join(", ");

/** A notification in words, in the given language (the email's) or the page's. */
export function notificationSentence(kind: NotifyKind, data: NotificationData, locale?: Locale): string {
	const options = locale ? { locale } : {};
	const actor = data.actor || m.kharcha_notify_someone({}, options);
	const title = data.title ?? "";
	switch (kind) {
		case "group.added":
			return m.kharcha_notify_group_added({ actor, group: data.group ?? title }, options);
		case "expense.added":
			return m.kharcha_notify_expense_added({ actor, title }, options);
		case "expense.updated":
			return m.kharcha_notify_expense_updated({ actor, title }, options);
		case "expense.deleted":
			return m.kharcha_notify_expense_deleted({ actor, title }, options);
		case "payment.received":
			return m.kharcha_notify_payment({ actor, amount: amountsText(data.amounts, locale) }, options);
		case "comment.mention":
			return m.kharcha_notify_mention({ actor }, options);
		case "comment.thread":
			return title
				? m.kharcha_notify_comment({ actor, title }, options)
				: m.kharcha_notify_comment_friend({ actor }, options);
		case "reminder":
			return m.kharcha_notify_reminder({ actor, amount: amountsText(data.amounts, locale) }, options);
	}
}

/** How the start of a comment is quoted in a notification. */
export const excerptOf = (body: string, max = 140): string => {
	const flat = body.replace(/\s+/g, " ").trim();
	return flat.length <= max ? flat : `${flat.slice(0, max - 1).trimEnd()}…`;
};

/** A piece of a comment as it is shown: text, a link, or a mention of someone in the thread. */
export type CommentPart =
	| { type: "text"; text: string }
	| { type: "link"; text: string; href: string }
	| { type: "mention"; text: string; personId: string };

const LINK = /https?:\/\/[^\s<>"]+/g;
/** Punctuation that ends a sentence rather than a link ("see https://x.test/a."). */
const TRAILING = /[.,;:!?)\]}'"]+$/;

/**
 * Splits a comment into text, links (http and https only) and the mentions it holds:
 * "@Name" for each person it mentions, the longest names first. Nothing is markup: the
 * body is shown as text, so nothing in it can run.
 */
export function commentParts(body: string, mentioned: ReadonlyArray<{ id: string; name: string }>): CommentPart[] {
	const names = [...mentioned].filter((person) => person.name).sort((a, b) => b.name.length - a.name.length);
	const parts: CommentPart[] = [];
	const pushText = (text: string) => {
		if (!text) return;
		let rest = text;
		while (rest) {
			let best: { index: number; person: { id: string; name: string } } | null = null;
			for (const person of names) {
				const index = rest.indexOf(`@${person.name}`);
				if (index >= 0 && (best === null || index < best.index)) best = { index, person };
			}
			if (!best) {
				parts.push({ type: "text", text: rest });
				return;
			}
			if (best.index > 0) parts.push({ type: "text", text: rest.slice(0, best.index) });
			const text = `@${best.person.name}`;
			parts.push({ type: "mention", text, personId: best.person.id });
			rest = rest.slice(best.index + text.length);
		}
	};
	let last = 0;
	for (const match of body.matchAll(LINK)) {
		const raw = match[0];
		const href = raw.replace(TRAILING, "");
		const start = match.index ?? 0;
		pushText(body.slice(last, start));
		parts.push({ type: "link", text: href, href });
		last = start + href.length;
	}
	pushText(body.slice(last));
	return parts;
}

/** The "@word" being typed at the caret, for the composer's suggestions: its start and what follows the @. */
export function mentionAt(text: string, caret: number): { start: number; query: string } | null {
	const before = text.slice(0, caret);
	const at = before.lastIndexOf("@");
	if (at < 0) return null;
	if (at > 0 && !/\s/.test(before[at - 1] ?? "")) return null;
	const query = before.slice(at + 1);
	if (query.length > 30 || /\n/.test(query) || /\s{2}/.test(query)) return null;
	return { start: at, query };
}
