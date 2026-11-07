import { queryOptions } from "@tanstack/react-query";
import { listAuditEvents } from "@/functions/audit";
import { auditKeys } from "./keys";
import type { AuditListInput } from "./search";

/** Read only: rows are written by the services, in the transaction of the change they record. */
export const auditListQueryOptions = (input: AuditListInput) =>
	queryOptions({ queryKey: auditKeys.list(input), queryFn: () => listAuditEvents({ data: input }) });
