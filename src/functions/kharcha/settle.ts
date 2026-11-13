import { createServerFn } from "@tanstack/react-start";
import { personIdInput, settleUpInput } from "@/features/kharcha/schema";
import type { RemindResult, SettleUp } from "@/features/kharcha/types";
import { zodInput } from "@/functions/_lib/validator";
import { requireKharchaUser, withKharchaServices } from "@/middleware/kharcha";
import * as settle from "@/server/kharcha/settle/service";

/**
 * Kharcha's settling up (docs/guides/kharcha.md "Balances and settling up", Task 91): the
 * settle-up dialog's options and reminders. Anyone signed in, guests included
 * (`requireKharchaUser`); the service resolves the group or the friend first (the access
 * matrix: tests/server/kharcha-access.test.ts). The payment itself is payments.ts'.
 */

export const getKharchaSettleUp = createServerFn({ method: "GET" })
	.middleware([requireKharchaUser, withKharchaServices])
	.validator(zodInput(settleUpInput))
	.handler(({ data, context }): Promise<SettleUp> => settle.getSettleUp(context, data));

/** An email to a friend who owes the caller: once a day per friend, never from a guest. */
export const remindKharchaFriend = createServerFn({ method: "POST" })
	.middleware([requireKharchaUser, withKharchaServices])
	.validator(zodInput(personIdInput))
	.handler(({ data, context }): Promise<RemindResult> => settle.remindFriend(context, data.personId));
