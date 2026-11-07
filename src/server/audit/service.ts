import "@tanstack/react-start/server-only";
import type { AuditPage } from "@/features/audit/schema";
import type { AuditListInput } from "@/features/audit/search";
import type { Services } from "@/server/services";
import { listAuditEvents } from "./repository";

/** The audit log, read only: rows are written by the services, in the transaction of their change (withAudit). */
export const list = ({ db }: Pick<Services, "db">, input: AuditListInput): Promise<AuditPage> =>
	listAuditEvents(db, input);
