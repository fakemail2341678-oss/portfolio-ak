import type { Meta, StoryObj } from "@storybook/react-vite";
import { useQuery } from "@tanstack/react-query";
import { expect, fn, waitFor, within } from "storybook/test";
import { createRole, inviteUser, setUserRoles, updateRolePermissions } from "@/functions/rbac";
import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";
import { sampleBannedUser, sampleRoles } from "../../../../.storybook/mocks/data";
import { ALL_PERMISSIONS, type Permission } from "../permissions";
import { rolesQueryOptions } from "../queries";
import { InviteUserDialog } from "./invite-user-dialog";
import { PermissionMatrix } from "./permission-matrix";
import { RoleDialog } from "./role-dialog";
import { UserRolesDialog } from "./user-roles-dialog";

const admin = { id: "admin-1", isAdmin: true, permissions: [...ALL_PERMISSIONS] };
/** A non-admin who manages roles but holds only Test CRUD read and roles permissions. */
const manager = {
	id: "manager-1",
	isAdmin: false,
	permissions: ["test-crud:read", "roles:read", "roles:manage", "users:read", "users:update"] satisfies Permission[],
};

/** The matrix over the (mocked) roles query, like the Permissions page. */
function Matrix({ actor = admin, canEdit = true }: { actor?: typeof admin | typeof manager; canEdit?: boolean }) {
	const { data } = useQuery(rolesQueryOptions());
	return data ? <PermissionMatrix roles={data} actor={actor} canEdit={canEdit} /> : null;
}

const meta = {
	title: "Admin/Roles and permissions",
	component: Matrix,
	parameters: { app: { route: "/admin/roles/permissions" } },
} satisfies Meta<typeof Matrix>;
export default meta;
type Story = StoryObj<typeof meta>;

const box = (canvas: HTMLElement, role: string, permission: Permission) =>
	canvas.querySelector<HTMLButtonElement>(
		`button[role=checkbox][data-role="${role}"][data-permission="${permission}"]`,
	);

/** Ticking a box saves at once (optimistic); Admin is always all and locked. */
export const Matrix_: Story = {
	name: "Matrix",
	play: async ({ canvasElement, userEvent }) => {
		await waitFor(() => expect(box(canvasElement, "editor", "test-crud:delete")).not.toBeNull());
		await expect(box(canvasElement, "admin", "users:ban")).toBeDisabled();
		await expect(box(canvasElement, "admin", "users:ban")).toHaveAttribute("data-state", "checked");
		await userEvent.click(box(canvasElement, "editor", "test-crud:delete") as HTMLElement);
		await waitFor(() =>
			expect(updateRolePermissions).toHaveBeenCalledWith({
				data: { roleId: "role-editor", grant: ["test-crud:delete"], revoke: [] },
			}),
		);
	},
};

/** The server refuses: the box flips back. */
export const MatrixRollback: Story = {
	play: async ({ canvasElement, userEvent }) => {
		(updateRolePermissions as unknown as ReturnType<typeof fn>).mockRejectedValueOnce(new Error("offline"));
		await waitFor(() => expect(box(canvasElement, "editor", "users:read")).not.toBeNull());
		const target = box(canvasElement, "editor", "users:read") as HTMLElement;
		await userEvent.click(target);
		await waitFor(() => expect(target).toHaveAttribute("data-state", "unchecked"));
	},
};

/** A non-admin manager can only change permissions they hold themselves. */
export const MatrixAsManager: Story = {
	args: { actor: manager },
	play: async ({ canvasElement }) => {
		await waitFor(() => expect(box(canvasElement, "editor", "test-crud:read")).not.toBeNull());
		await expect(box(canvasElement, "editor", "test-crud:read")).toBeEnabled();
		await expect(box(canvasElement, "editor", "test-crud:delete")).toBeDisabled();
	},
};

export const MatrixReadOnly: Story = {
	args: { canEdit: false },
	play: async ({ canvasElement }) => {
		await waitFor(() => expect(canvasElement.querySelectorAll("button[role=checkbox]").length).toBeGreaterThan(0));
		for (const checkbox of canvasElement.querySelectorAll("button[role=checkbox]"))
			await expect(checkbox).toBeDisabled();
	},
};

export const NewRole: Story = {
	render: () => <RoleDialog onClose={fn()} />,
	play: async ({ canvasElement, userEvent }) => {
		const dialog = within(canvasElement.ownerDocument.body);
		await userEvent.type(await dialog.findByRole("textbox", { name: m.roles_field_name() }), "Reviewer");
		await userEvent.click(dialog.getByRole("button", { name: m.crud_create() }));
		await waitFor(() => expect(createRole).toHaveBeenCalledWith({ data: { name: "Reviewer", description: "" } }));
	},
};

/** A non-admin can't make admins: that box is disabled; roles within their power are not. */
export const UserRolesAsManager: Story = {
	render: () => <UserRolesDialog user={sampleBannedUser} roles={sampleRoles} actor={manager} onClose={fn()} />,
	play: async ({ canvasElement }) => {
		const dialog = within(canvasElement.ownerDocument.body);
		await expect(await dialog.findByRole("checkbox", { name: m.role_admin_name() })).toBeDisabled();
		await expect(dialog.getByRole("checkbox", { name: "Editor" })).toBeDisabled();
	},
};

export const UserRolesAsAdmin: Story = {
	render: () => <UserRolesDialog user={sampleBannedUser} roles={sampleRoles} actor={admin} onClose={fn()} />,
	play: async ({ canvasElement, userEvent }) => {
		const dialog = within(canvasElement.ownerDocument.body);
		await userEvent.click(await dialog.findByRole("checkbox", { name: "Editor" }));
		await userEvent.click(dialog.getByRole("button", { name: m.users_roles_save() }));
		await waitFor(() =>
			expect(setUserRoles).toHaveBeenCalledWith({
				data: { userId: "user-1", admin: false, roleIds: ["role-editor"], updatedAt: sampleBannedUser.updatedAt },
			}),
		);
	},
};

/** Name, address and the email's language (the current one by default); validated before sending. */
export const InviteUser: Story = {
	render: () => <InviteUserDialog onClose={fn()} />,
	play: async ({ canvasElement, userEvent }) => {
		const dialog = within(canvasElement.ownerDocument.body);
		await userEvent.click(await dialog.findByRole("button", { name: m.users_invite_send() }));
		await expect(await dialog.findAllByText(m.validation_required())).not.toHaveLength(0);
		await expect(inviteUser).not.toHaveBeenCalled();
		await userEvent.type(dialog.getByRole("textbox", { name: m.users_invite_name() }), "Hari");
		await userEvent.type(dialog.getByRole("textbox", { name: m.users_invite_email() }), "hari@example.com");
		await userEvent.click(dialog.getByRole("button", { name: m.users_invite_send() }));
		await waitFor(() =>
			expect(inviteUser).toHaveBeenCalledWith({
				data: { name: "Hari", email: "hari@example.com", locale: getLocale() },
			}),
		);
	},
};
