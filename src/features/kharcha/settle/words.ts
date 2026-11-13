import { formatMoney } from "@/lib/i18n/currency";
import { m } from "@/paraglide/messages";
import type { KharchaPerson } from "../types";

/** A debt as the payment that clears it, in words: "You pay Asha NPR 600.00", "Bikash pays you …", "Bikash pays Asha …". */
export function transferSentence(
	transfer: { fromId: string; toId: string; amountMinor: number; currency: string },
	people: ReadonlyArray<KharchaPerson>,
): string {
	const find = (id: string) => people.find((person) => person.id === id);
	const from = find(transfer.fromId);
	const to = find(transfer.toId);
	const amount = formatMoney(transfer.amountMinor, transfer.currency);
	if (from?.isMe) return m.kharcha_settle_you_pay({ to: to?.name ?? m.kharcha_someone(), amount });
	if (to?.isMe) return m.kharcha_settle_pays_you({ from: from?.name ?? m.kharcha_someone(), amount });
	return m.kharcha_settle_pays({
		from: from?.name ?? m.kharcha_someone(),
		to: to?.name ?? m.kharcha_someone(),
		amount,
	});
}
