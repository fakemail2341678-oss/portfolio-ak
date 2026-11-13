import "@tanstack/react-start/server-only";
import { and, eq, inArray, isNotNull } from "drizzle-orm";
import {
	type NotificationData,
	type NotifyEmail,
	type NotifyKind,
	notifyMode,
	type ThreadKey,
} from "@/features/kharcha/notifications";
import { khNotification, khPerson, khProfile, user } from "@/server/db/schema";
import type { Tx } from "@/server/db/types";

/**
 * Kharcha's notifications (docs/guides/kharcha.md "Conversations and notifications",
 * decision 0286), Taskline's pattern (0214): written in the transaction of the change that
 * causes them, so a refused change tells nobody. Who hears is decided here:
 *
 * - people with an account (a contact without one sees nothing in Kharcha), never the actor;
 * - once per change: the first event naming someone wins (a mention beats "a comment in
 *   your thread");
 * - emailed as they chose for the kind, else the default (`NOTIFY_DEFAULTS`); a guest's
 *   placeholder address gets none. The row is on Home either way.
 *
 * The ids of rows to email at once are returned: the service hands them to
 * `services.deliver` after the commit (src/server/kharcha/notify/deliver.ts).
 */

export type NotifyEvent = {
	kind: NotifyKind;
	/** People ids; filtered as above. */
	to: ReadonlyArray<string | null | undefined>;
	/** Where it points, from the recipients' side (a friend's thread is `f:<the actor>`). */
	thread: ThreadKey;
	groupId?: string | null;
	expenseId?: string | null;
	data: NotificationData;
	/** Its email went another way already (a reminder's own template): an instant row is marked sent. */
	sentNow?: boolean;
};

export type NotifyActor = { personId: string | null; name: string | null };

export type Produced = {
	/** Rows to email at once, after the commit. */
	instant: string[];
	/** How each person told is emailed, by person id. */
	emails: Map<string, NotifyEmail>;
};

type Recipient = { personId: string; userId: string; notify: Record<string, string>; guest: boolean };

async function recipients(tx: Tx, personIds: ReadonlyArray<string>): Promise<Map<string, Recipient>> {
	if (personIds.length === 0) return new Map();
	const rows = await tx
		.select({
			personId: khPerson.id,
			userId: khPerson.userId,
			notify: khProfile.notify,
			guest: user.isAnonymous,
		})
		.from(khPerson)
		.innerJoin(user, eq(user.id, khPerson.userId))
		.leftJoin(khProfile, eq(khProfile.userId, khPerson.userId))
		.where(and(inArray(khPerson.id, [...personIds]), isNotNull(khPerson.userId)));
	return new Map(
		rows.flatMap((row) =>
			row.userId
				? [
						[
							row.personId,
							{
								personId: row.personId,
								userId: row.userId,
								notify: (row.notify ?? {}) as Record<string, string>,
								guest: row.guest === true,
							},
						] as const,
					]
				: [],
		),
	);
}

/** Writes the notifications of one change. */
export async function produce(
	tx: Tx,
	actor: NotifyActor,
	events: ReadonlyArray<NotifyEvent>,
	now = new Date(),
): Promise<Produced> {
	const produced: Produced = { instant: [], emails: new Map() };
	const wanted = [
		...new Set(events.flatMap((event) => event.to).filter((id): id is string => Boolean(id) && id !== actor.personId)),
	];
	if (wanted.length === 0) return produced;
	const byPerson = await recipients(tx, wanted);
	const rows: (typeof khNotification.$inferInsert)[] = [];
	const sentNow = new Set<number>();
	for (const event of events) {
		for (const personId of event.to) {
			const recipient = personId ? byPerson.get(personId) : undefined;
			if (!recipient || produced.emails.has(recipient.personId) || recipient.personId === actor.personId) continue;
			const email: NotifyEmail = recipient.guest ? "none" : notifyMode(recipient.notify, event.kind);
			produced.emails.set(recipient.personId, email);
			if (event.sentNow && email === "instant") sentNow.add(rows.length);
			rows.push({
				userId: recipient.userId,
				kind: event.kind,
				thread: event.thread,
				groupId: event.groupId ?? null,
				expenseId: event.expenseId ?? null,
				actorId: actor.personId,
				data: actor.name ? { actor: actor.name, ...event.data } : event.data,
				email,
				emailedAt: event.sentNow && email === "instant" ? now : null,
			});
		}
	}
	if (rows.length === 0) return produced;
	const inserted = await tx
		.insert(khNotification)
		.values(rows)
		.returning({ id: khNotification.id, email: khNotification.email });
	produced.instant = inserted
		.filter((row, index) => row.email === "instant" && !sentNow.has(index))
		.map((row) => row.id);
	return produced;
}

/** Hands the instant rows to the deliverer, after the commit; without one (tests, the cron) they wait for the digest. */
export function deliverAfter(deliver: ((ids: string[]) => void) | undefined, ids: ReadonlyArray<string>): void {
	if (deliver && ids.length > 0) deliver([...ids]);
}
