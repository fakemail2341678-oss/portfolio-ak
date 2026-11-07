import { z } from "zod";
import { isoDateTime } from "@/lib/crud/schema";
import type { Paged } from "@/lib/list/paging";

/**
 * The audit log (docs/decisions.md 0132): what is recorded, and what the list
 * shows (its URL contract is ./search.ts). Rows are written by the services
 * (src/server/audit/record.ts); this file is shared with the browser.
 */

/** Every recorded action. A new one needs a label (./labels.ts; its type requires one) and a writer. */
export const AUDIT_ACTIONS = [
	"role.create",
	"role.update",
	"role.delete",
	"role.permissions",
	"user.invite",
	"user.roles",
	"user.ban",
	"user.unban",
	"user.sessions-revoke",
	"user.impersonate",
	"user.impersonate-stop",
	"test-crud.create",
	"test-crud.update",
	"test-crud.publish",
	"test-crud.unpublish",
	"test-crud.delete",
	// portfolio:start
	"profile.update",
	"project.create",
	"project.update",
	"project.publish",
	"project.unpublish",
	"project.delete",
	"project.reorder",
	"post.create",
	"post.update",
	"post.publish",
	"post.unpublish",
	"post.delete",
	"portfolio-section.create",
	"portfolio-section.update",
	"portfolio-section.delete",
	"portfolio-section.reorder",
	"message.archive",
	"message.unarchive",
	"message.delete",
	"media.update",
	"media.delete",
	// portfolio:end
	// apps:start
	"link.block",
	"link.unblock",
	"link.delete",
	// apps:end
	// taskline:start
	"taskline.project.create",
	"taskline.project.update",
	"taskline.project.state",
	"taskline.project.archive",
	"taskline.project.unarchive",
	"taskline.project.lead",
	"taskline.project.delete",
	"taskline.project.export",
	"taskline.project.member",
	"taskline.project.member-remove",
	"taskline.member.add",
	"taskline.member.update",
	"taskline.member.deactivate",
	"taskline.member.reactivate",
	"taskline.invite",
	"taskline.invite.resend",
	"taskline.invite.revoke",
	"taskline.settings.update",
	"taskline.workflows.update",
	"taskline.label.create",
	"taskline.label.update",
	"taskline.label.delete",
	"taskline.time.update",
	"taskline.time.delete",
	"taskline.time.lock",
	"taskline.field.create",
	"taskline.field.update",
	"taskline.field.delete",
	"taskline.automation.create",
	"taskline.automation.update",
	"taskline.automation.delete",
	"taskline.template.create",
	"taskline.template.update",
	"taskline.template.delete",
	// taskline:end
	// parda:start
	"parda.source.create",
	"parda.source.update",
	"parda.source.state",
	"parda.source.reorder",
	"parda.source.order",
	"parda.source.delete",
	"parda.title.block",
	"parda.title.unblock",
	"parda.report.status",
	"parda.settings.update",
	"parda.playback",
	"parda.cache.purge",
	"parda.billboard.create",
	"parda.billboard.update",
	"parda.billboard.reorder",
	"parda.billboard.delete",
	"parda.collection.create",
	"parda.collection.update",
	"parda.collection.delete",
	"parda.layout.update",
	// parda:end
	// @new-feature:audit-actions
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const AUDIT_TARGETS = [
	"role",
	"user",
	"test-crud",
	// portfolio:start
	"profile",
	"project",
	"post",
	"experience",
	"skill",
	"process-step",
	"testimonial",
	"message",
	"media",
	// portfolio:end
	"link", // @apps
	// taskline:start
	"taskline-project",
	"taskline-member",
	"taskline-invitation",
	"taskline-workspace",
	"taskline-label",
	"taskline-time-entry",
	"taskline-field",
	"taskline-automation",
	"taskline-template",
	// taskline:end
	// parda:start
	"parda-source",
	"parda-title",
	"parda-report",
	"parda-settings",
	"parda-billboard",
	"parda-collection",
	"parda-layout",
	// parda:end
	// @new-feature:audit-targets
] as const;
export type AuditTarget = (typeof AUDIT_TARGETS)[number];

/** A summarized field value: short, JSON, never a secret. */
export type AuditValue = string | number | boolean | null | string[];
export type AuditValues = Record<string, AuditValue>;

/** One row of the log as the list shows it (the list's URL contract is in ./search.ts). */
export const auditEventItem = z.object({
	id: z.string(),
	action: z.custom<AuditAction>(),
	/** The account that acted; `id` is null once it was deleted (name and email are then from the time). */
	actor: z.object({ id: z.string().nullable(), name: z.string(), email: z.string() }),
	/** The admin behind an impersonated session, when there was one. */
	impersonator: z.string().nullable(),
	target: z.object({ type: z.custom<AuditTarget>(), id: z.string(), label: z.string() }),
	before: z.custom<AuditValues>().nullable(),
	after: z.custom<AuditValues>().nullable(),
	requestId: z.string().nullable(),
	ip: z.string().nullable(),
	createdAt: isoDateTime(),
});
export type AuditEventItem = z.output<typeof auditEventItem>;
export type AuditPage = Paged<AuditEventItem>;
