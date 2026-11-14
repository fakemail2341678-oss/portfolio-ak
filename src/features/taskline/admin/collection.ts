import { crudCollection } from "@/lib/crud/collection";
import type { TimeEntry } from "../types";
import { adminMemberKeys, adminProjectKeys, adminTimeKeys, tasklineAdminKeys } from "./keys";
import type { AdminInvitation, AdminMemberItem, AdminProjectItem, AdminTemplate, AdminTemplates } from "./schema";

/**
 * The admin lists' rows as TanStack DB collections (docs/guides/crud.md, "Writes").
 * Imported by components only, never by a route file or `queries.ts` (0189).
 */
export const adminProjectRows = crudCollection<AdminProjectItem>("taskline-admin-projects", adminProjectKeys.lists());
export const adminMemberRows = crudCollection<AdminMemberItem>("taskline-admin-members", adminMemberKeys.lists());
export const adminInvitationRows = crudCollection<AdminInvitation>(
	"taskline-admin-invitations",
	tasklineAdminKeys.invitations(),
);
export const adminTimeRows = crudCollection<TimeEntry>("taskline-admin-time", adminTimeKeys.lists());
/** The team's own templates (the built-in ones can't be deleted). */
export const adminTemplateRows = crudCollection<AdminTemplate>(
	"taskline-admin-templates",
	tasklineAdminKeys.templates(),
	(cached) => (cached as AdminTemplates | undefined)?.templates ?? [],
);
