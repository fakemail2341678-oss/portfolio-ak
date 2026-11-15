/**
 * The permission catalog: every resource and the actions on it, in code.
 *
 * A permission is "<resource>:<action>" (e.g. "test-crud:publish"). Roles are
 * sets of these, edited by admins in the permission matrix; the server checks
 * them on every request (requirePermission). Adding a resource or action here
 * makes it appear in the matrix: also add its labels in ./labels.ts and the
 * messages files, then guard the server functions that need it.
 */
export const PERMISSION_CATALOG = {
	"test-crud": ["read", "create", "update", "publish", "delete"],
	/** ban also covers signing a user out everywhere (revoking their sessions). */
	users: ["read", "invite", "update", "ban"],
	roles: ["read", "manage"],
	/** Images go into an item through its own save (test-crud:create/update); uploading needs this too. */
	attachments: ["upload"],
	/** The audit log of admin actions (/admin/audit). */
	audit: ["read"],
	// portfolio:start
	/** The portfolio's content (/admin/portfolio): read covers draft previews, publish the status of projects and posts. */
	portfolio: ["read", "write", "publish"],
	/** The contact form's inbox: manage marks, archives and deletes. */
	messages: ["read", "manage"],
	/** The media library (/admin/media): write uploads, describes and deletes. */
	media: ["read", "write"],
	// portfolio:end
	// apps:start
	/** The showcase apps' usage (/admin/apps): who has data, and how much. Never the data itself. */
	apps: ["read"],
	/** Short links of every user (/admin/links): block, unblock and delete them (decision 0191). */
	links: ["moderate"],
	// apps:end
	// taskline:start
	/**
	 * Taskline (/app/taskline, decision 0204): read sees /admin/taskline and reads every team project;
	 * manage runs projects and members (lead rights everywhere); configure the workflows, fields,
	 * automations, templates and settings; time every timesheet.
	 */
	taskline: ["read", "manage", "configure", "time"],
	// taskline:end
	// parda:start
	/**
	 * Parda (/app/parda, decision 0228): read sees /admin/parda; curate the home page and collections;
	 * moderate takedowns and reports; configure the sources, settings and the player lab.
	 */
	parda: ["read", "curate", "moderate", "configure"],
	// parda:end
	// chaal:start
	/**
	 * Chaal (/app/chaal, decision 0254): read sees /admin/chaal; configure the switches, limits,
	 * scopes and the lab; moderate connections and blocks; curate the home page and featured content.
	 */
	chaal: ["read", "configure", "moderate", "curate"],
	// chaal:end
	// kharcha:start
	/**
	 * Kharcha (/app/kharcha, decision 0277): read sees /admin/kharcha's counts, never anyone's
	 * expenses; configure the limits, the currencies offered and the defaults.
	 */
	kharcha: ["read", "configure"],
	// kharcha:end
	// @new-feature:permissions
} as const;

type Catalog = typeof PERMISSION_CATALOG;
export type Resource = keyof Catalog;
export type Permission = { [R in Resource]: `${R}:${Catalog[R][number]}` }[Resource];

export const RESOURCES = Object.keys(PERMISSION_CATALOG) as Resource[];

/** Every permission, in catalog order (the matrix's row order). */
export const ALL_PERMISSIONS: ReadonlyArray<Permission> = RESOURCES.flatMap((resource) =>
	PERMISSION_CATALOG[resource].map((action) => `${resource}:${action}` as Permission),
);

const KNOWN = new Set<string>(ALL_PERMISSIONS);
export const isPermission = (value: string): value is Permission => KNOWN.has(value);

export const permissionsOf = (resource: Resource): Permission[] =>
	ALL_PERMISSIONS.filter((permission) => permission.startsWith(`${resource}:`));

/** System roles: `admin` holds every permission and can't be edited; `user` is everyone's baseline. */
export const SYSTEM_ROLE_KEYS = ["admin", "user"] as const;

/** True when `granted` contains every one of `required`. */
export const hasAll = (granted: ReadonlyArray<string>, required: ReadonlyArray<Permission>) =>
	required.every((permission) => granted.includes(permission));

/** Permissions that open the admin area (any one is enough). */
export const canEnterAdmin = (granted: ReadonlyArray<string>) => granted.some(isPermission);
