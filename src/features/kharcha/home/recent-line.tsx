import { formatMoney } from "@/lib/i18n/currency";
import { m } from "@/paraglide/messages";
import type { HomeActivity, KharchaPerson } from "../types";

/** A person in a sentence: "You" to start it, "you" inside it, their name, or "Someone" once they are gone. */
const subject = (person: KharchaPerson | null) =>
	person ? (person.isMe ? m.kharcha_you_subject() : person.name) : m.kharcha_someone();
const object = (person: KharchaPerson | null) =>
	person ? (person.isMe ? m.kharcha_you_object() : person.name) : m.kharcha_someone();

/** One line of Home's "Recent" in words ("Bikash added Momo at Thamel", "Asha paid you NPR 600.00"). */
export function recentSentence(line: HomeActivity): string {
	const actor = subject(line.actor);
	const title = line.title || m.kharcha_untitled();
	const group = line.group ?? "";
	switch (line.kind) {
		case "expense.created":
			return m.kharcha_recent_expense_created({ actor, title });
		case "expense.updated":
			return m.kharcha_recent_expense_updated({ actor, title });
		case "expense.deleted":
			return m.kharcha_recent_expense_deleted({ actor, title });
		case "expense.restored":
			return m.kharcha_recent_expense_restored({ actor, title });
		case "payment.created":
			return line.payment
				? m.kharcha_recent_paid({
						from: subject(line.payment.from),
						to: object(line.payment.to),
						amount: formatMoney(line.payment.amount.amountMinor, line.payment.amount.currency),
					})
				: m.kharcha_recent_payment_changed({ actor });
		case "payment.updated":
		case "payment.deleted":
		case "payment.restored":
			return m.kharcha_recent_payment_changed({ actor });
		case "group.created":
			return m.kharcha_recent_group_created({ actor, group });
		case "group.updated":
			return m.kharcha_recent_group_updated({ actor, group });
		case "group.archived":
			return m.kharcha_recent_group_archived({ actor, group });
		case "group.unarchived":
			return m.kharcha_recent_group_unarchived({ actor, group });
		case "member.added":
			return m.kharcha_recent_member_added({ actor, member: object(line.subject), group });
		case "member.removed":
			return m.kharcha_recent_member_removed({ actor, member: object(line.subject), group });
		case "member.left":
			return m.kharcha_recent_member_left({ member: subject(line.subject), group });
		case "friend.added":
			return m.kharcha_recent_friend_added({ actor, friend: object(line.subject) });
	}
}
