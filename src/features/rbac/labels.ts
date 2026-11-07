import { m } from "@/paraglide/messages";
import type { Permission, Resource } from "./permissions";

/** Localized names, called at render time. Every catalog entry must have one (a test checks). */
export const RESOURCE_LABELS: Record<Resource, () => string> = {
	"test-crud": m.perm_resource_test_crud,
	users: m.perm_resource_users,
	roles: m.perm_resource_roles,
	attachments: m.perm_resource_attachments,
	audit: m.perm_resource_audit,
	portfolio: m.perm_resource_portfolio, // @portfolio
	messages: m.perm_resource_messages, // @portfolio
	media: m.perm_resource_media, // @portfolio
	apps: m.perm_resource_apps, // @apps
	links: m.perm_resource_links, // @apps
	taskline: m.perm_resource_taskline, // @taskline
	parda: m.perm_resource_parda, // @parda
	chaal: m.perm_resource_chaal, // @chaal
	// @new-feature:resource-labels
};

export const PERMISSION_LABELS: Record<Permission, () => string> = {
	"test-crud:read": m.perm_test_crud_read,
	"test-crud:create": m.perm_test_crud_create,
	"test-crud:update": m.perm_test_crud_update,
	"test-crud:publish": m.perm_test_crud_publish,
	"test-crud:delete": m.perm_test_crud_delete,
	"users:read": m.perm_users_read,
	"users:invite": m.perm_users_invite,
	"users:update": m.perm_users_update,
	"users:ban": m.perm_users_ban,
	"roles:read": m.perm_roles_read,
	"roles:manage": m.perm_roles_manage,
	"attachments:upload": m.perm_attachments_upload,
	"audit:read": m.perm_audit_read,
	// portfolio:start
	"portfolio:read": m.perm_portfolio_read,
	"portfolio:write": m.perm_portfolio_write,
	"portfolio:publish": m.perm_portfolio_publish,
	"messages:read": m.perm_messages_read,
	"messages:manage": m.perm_messages_manage,
	"media:read": m.perm_media_read,
	"media:write": m.perm_media_write,
	// portfolio:end
	"apps:read": m.perm_apps_read, // @apps
	"links:moderate": m.perm_links_moderate, // @apps
	// taskline:start
	"taskline:read": m.perm_taskline_read,
	"taskline:manage": m.perm_taskline_manage,
	"taskline:configure": m.perm_taskline_configure,
	"taskline:time": m.perm_taskline_time,
	// taskline:end
	// parda:start
	"parda:read": m.perm_parda_read,
	"parda:curate": m.perm_parda_curate,
	"parda:moderate": m.perm_parda_moderate,
	"parda:configure": m.perm_parda_configure,
	// parda:end
	// chaal:start
	"chaal:read": m.perm_chaal_read,
	"chaal:configure": m.perm_chaal_configure,
	"chaal:moderate": m.perm_chaal_moderate,
	"chaal:curate": m.perm_chaal_curate,
	// chaal:end
	// @new-feature:permission-labels
};

/** A role's display name: system roles are localized, custom roles use their own name. */
export const roleLabel = (role: { key: string; name: string }) =>
	role.key === "admin" ? m.role_admin_name() : role.key === "user" ? m.role_user_name() : role.name;

export const roleDescription = (role: { key: string; description: string }) =>
	role.key === "admin"
		? m.role_admin_description()
		: role.key === "user"
			? m.role_user_description()
			: role.description;
