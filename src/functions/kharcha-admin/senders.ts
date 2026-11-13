import { createServerFn } from "@tanstack/react-start";
import { type KharchaSender, suspendKharchaSenderInput } from "@/features/kharcha/admin/schema";
import { zodInput } from "@/functions/_lib/validator";
import { requirePermission } from "@/middleware/auth";
import { withServices } from "@/middleware/services";
import { listSenders, suspendSender } from "@/server/kharcha/admin/senders";

/** /admin/kharcha/senders (Task 96): invites per sender as counts (`kharcha:read`); suspending one (`kharcha:configure`), audited. */

export const listKharchaSenders = createServerFn({ method: "GET" })
	.middleware([requirePermission("kharcha:read"), withServices])
	.handler(({ context }): Promise<KharchaSender[]> => listSenders(context.db));

export const suspendKharchaSender = createServerFn({ method: "POST" })
	.middleware([requirePermission("kharcha:configure"), withServices])
	.validator(zodInput(suspendKharchaSenderInput))
	.handler(({ data, context }): Promise<void> => suspendSender(context, data));
