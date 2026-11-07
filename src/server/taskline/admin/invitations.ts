import "@tanstack/react-start/server-only";
import { waitUntil } from "@vercel/functions";
import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { type AdminInvitation, INVITATION_DAYS, type InviteMemberInput } from "@/features/taskline/admin/schema";
import { TASKLINE_NAME } from "@/features/taskline/brand";
import { TASKLINE_PATHS } from "@/features/taskline/links";
import { localizedUrl } from "@/lib/seo";
import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";
import { notFound, uniqueViolation, withAudit } from "@/server/db/crud";
import { type TlInvitationRow, tlInvitation, tlMember, tlProject, user } from "@/server/db/schema";
import type { Db, Tx } from "@/server/db/types";
import { sendEmail } from "@/server/email/send";
import { enforceRateLimit } from "@/server/http/rate-limit";
import { errorFields, log } from "@/server/log";
import type { Services } from "@/server/services";
import * as projectRepo from "../projects/repository";
import { fieldError } from "../rules";
import * as members from "../workspace/repository";
import { bumpRevs, recordTeamActivity, team, teamProject } from "./team";

/**
 * Invitations to the team by email (decision 0212). The email links to Taskline's
 * sign-up (or sign-in) and back to the project it names; the invitation is accepted
 * by the first session of a verified account with that address, wherever it signs in
 * (`acceptInvitations`, from Better Auth's session hook). An expired or revoked one
 * does nothing. Sending is rate limited per admin.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const SEND_LIMIT = { max: 30, windowSeconds: 60 * 60 };

const pending = (workspaceId: string) =>
	and(eq(tlInvitation.workspaceId, workspaceId), isNull(tlInvitation.acceptedAt), isNull(tlInvitation.revokedAt));

/** The team's open invitations (not accepted, not revoked), newest first; expired ones say so. */
export async function list({ db }: Pick<Services, "db">): Promise<AdminInvitation[]> {
	const { workspace } = await team(db);
	const rows = await db
		.select({ invitation: tlInvitation, project: tlProject, inviter: tlMember.displayName })
		.from(tlInvitation)
		.leftJoin(tlProject, eq(tlProject.id, tlInvitation.projectId))
		.leftJoin(tlMember, eq(tlMember.id, tlInvitation.invitedById))
		.where(pending(workspace.id))
		.orderBy(desc(tlInvitation.createdAt));
	const now = Date.now();
	return rows.map(({ invitation, project, inviter }) => ({
		id: invitation.id,
		email: invitation.email,
		role: invitation.role,
		project: project ? { id: project.id, key: project.key, name: project.name } : null,
		invitedBy: inviter,
		expiresAt: invitation.expiresAt.toISOString(),
		expired: invitation.expiresAt.getTime() <= now,
		createdAt: invitation.createdAt.toISOString(),
	}));
}

/** The email, sent after the transaction; a failure is logged (the admin can resend). */
function send(
	invitation: TlInvitationRow,
	details: { inviter: string; team: string; ws: string; project: { key: string; name: string } | null },
) {
	const locale = getLocale();
	const landing = details.project ? `/app/taskline/${details.ws}/p/${details.project.key}` : TASKLINE_PATHS.home;
	const url = `${localizedUrl("/app/taskline/sign-up", locale)}?redirect=${encodeURIComponent(landing)}`;
	waitUntil(
		sendEmail({
			to: invitation.email,
			template: "taskline-invite",
			locale,
			siteName: TASKLINE_NAME,
			data: {
				inviter: details.inviter,
				team: details.team,
				project: details.project?.name,
				url,
				expiresInDays: INVITATION_DAYS,
			},
		}).catch((error: unknown) => {
			log("error", "taskline invitation email failed", { invitationId: invitation.id, ...errorFields(error) });
		}),
	);
}

async function inviterName(db: Db, userId: string): Promise<string> {
	const [row] = await db.select({ name: user.name }).from(user).where(eq(user.id, userId));
	return row?.name ?? TASKLINE_NAME;
}

/** Whether `email` belongs to an account already active on the team. */
async function isMemberEmail(db: Db, workspaceId: string, email: string): Promise<boolean> {
	const [row] = await db
		.select({ id: tlMember.id })
		.from(tlMember)
		.innerJoin(user, eq(user.id, tlMember.userId))
		.where(and(eq(tlMember.workspaceId, workspaceId), eq(user.email, email), isNull(tlMember.deactivatedAt)));
	return row !== undefined;
}

export async function invite({ db, actor }: Services, input: InviteMemberInput): Promise<AdminInvitation> {
	const email = input.email.toLowerCase();
	await enforceRateLimit(db, `taskline-invite:${actor.id}`, SEND_LIMIT);
	const { invitation, details } = await withAudit(db, actor, async (tx, audit) => {
		const { workspace } = await team(tx);
		if (await isMemberEmail(tx, workspace.id, email)) {
			throw fieldError("CONFLICT", "email", m.taskline_admin_error_already_member());
		}
		const project = input.projectId ? await teamProject(tx, workspace.id, input.projectId) : null;
		const inviter = await members.memberOf(tx, workspace.id, actor.id);
		let row: TlInvitationRow | undefined;
		try {
			[row] = await tx
				.insert(tlInvitation)
				.values({
					workspaceId: workspace.id,
					email,
					role: input.role,
					invitedById: inviter?.id ?? null,
					projectId: project?.id ?? null,
					expiresAt: new Date(Date.now() + INVITATION_DAYS * DAY_MS),
				})
				.returning();
		} catch (error) {
			throw uniqueViolation(error, {
				tl_invitation_pending_unique: { field: "email", message: m.taskline_admin_error_already_invited },
			});
		}
		if (!row) throw new Error("Invitation insert returned no row");
		audit({
			action: "taskline.invite",
			target: { type: "taskline-invitation", id: row.id, label: row.email },
			after: { email, role: input.role, project: project?.key ?? null },
		});
		return {
			invitation: row,
			details: {
				inviter: await inviterName(tx, actor.id),
				team: workspace.name,
				ws: workspace.slug,
				project: project ? { key: project.key, name: project.name } : null,
			},
		};
	});
	send(invitation, details);
	const [view] = (await list({ db })).filter((each) => each.id === invitation.id);
	if (!view) throw notFound("Invitation");
	return view;
}

/** Sends it again, good for another INVITATION_DAYS. */
export async function resend({ db, actor }: Services, { id }: { id: string }): Promise<void> {
	await enforceRateLimit(db, `taskline-invite:${actor.id}`, SEND_LIMIT);
	const { invitation, details } = await withAudit(db, actor, async (tx, audit) => {
		const { workspace } = await team(tx);
		const [row] = await tx
			.update(tlInvitation)
			.set({ expiresAt: new Date(Date.now() + INVITATION_DAYS * DAY_MS) })
			.where(and(pending(workspace.id), eq(tlInvitation.id, id)))
			.returning();
		if (!row) throw notFound("Invitation");
		const project = row.projectId ? await teamProject(tx, workspace.id, row.projectId) : null;
		audit({ action: "taskline.invite.resend", target: { type: "taskline-invitation", id: row.id, label: row.email } });
		return {
			invitation: row,
			details: {
				inviter: await inviterName(tx, actor.id),
				team: workspace.name,
				ws: workspace.slug,
				project: project ? { key: project.key, name: project.name } : null,
			},
		};
	});
	send(invitation, details);
}

export async function revoke({ db, actor }: Services, { id }: { id: string }): Promise<void> {
	await withAudit(db, actor, async (tx, audit) => {
		const { workspace } = await team(tx);
		const [row] = await tx
			.update(tlInvitation)
			.set({ revokedAt: new Date() })
			.where(and(pending(workspace.id), eq(tlInvitation.id, id)))
			.returning();
		if (!row) throw notFound("Invitation");
		audit({ action: "taskline.invite.revoke", target: { type: "taskline-invitation", id: row.id, label: row.email } });
	});
}

/**
 * Accepts the team's invitations for an account's address: called when a session
 * starts. Only a verified, non-guest account counts (the address is then its
 * owner's); expired and revoked invitations are skipped. The account becomes a
 * member (a deactivated one is reactivated) with the invitation's role, and joins the
 * project it names: a viewer's invitation as a viewer there too. Returns how many it accepted.
 */
export async function acceptInvitations(db: Db, userId: string): Promise<number> {
	const [account] = await db
		.select({ id: user.id, name: user.name, email: user.email, verified: user.emailVerified, guest: user.isAnonymous })
		.from(user)
		.where(eq(user.id, userId));
	if (!account || !account.verified || account.guest === true) return 0;
	const workspace = await members.teamWorkspace(db);
	if (!workspace) return 0;
	const email = account.email.toLowerCase();
	return db.transaction(async (tx) => {
		const open = await tx
			.select()
			.from(tlInvitation)
			.where(and(pending(workspace.id), eq(tlInvitation.email, email), gt(tlInvitation.expiresAt, new Date())))
			.orderBy(desc(tlInvitation.createdAt))
			.for("update");
		const [latest] = open;
		if (!latest) return 0;
		const member = await joinTeam(tx, workspace.id, account, latest.role);
		// The newest invitation naming a project says the role there (`open` is newest first).
		const invitedTo = new Map<string, "member" | "viewer">();
		for (const invitation of open) {
			if (invitation.projectId && !invitedTo.has(invitation.projectId)) {
				invitedTo.set(invitation.projectId, invitation.role);
			}
		}
		const joined: Array<{ projectId: string; role: "member" | "viewer" }> = [];
		for (const [projectId, role] of invitedTo) {
			const [project] = await tx.select().from(tlProject).where(eq(tlProject.id, projectId));
			if (!project || project.archivedAt) continue;
			const roles = await projectRepo.rolesOf(tx, member.id, [project.id]);
			if (roles.has(project.id)) continue;
			await projectRepo.upsertProjectMember(tx, project.id, member.id, role);
			joined.push({ projectId: project.id, role });
		}
		await recordTeamActivity(
			tx,
			joined.map(({ projectId, role }) => ({
				workspaceId: workspace.id,
				projectId,
				actorId: member.id,
				kind: "project.member_added" as const,
				data: { memberId: member.id, role, invited: true },
			})),
		);
		await bumpRevs(
			tx,
			joined.map(({ projectId }) => projectId),
		);
		await tx
			.update(tlInvitation)
			.set({ acceptedAt: new Date() })
			.where(and(pending(workspace.id), eq(tlInvitation.email, email), gt(tlInvitation.expiresAt, new Date())));
		return open.length;
	});
}

async function joinTeam(
	tx: Tx,
	workspaceId: string,
	account: { id: string; name: string },
	role: TlInvitationRow["role"],
) {
	const existing = await members.memberOf(tx, workspaceId, account.id);
	if (existing) {
		if (!existing.deactivatedAt) return existing;
		const [row] = await tx
			.update(tlMember)
			.set({ deactivatedAt: null, role })
			.where(eq(tlMember.id, existing.id))
			.returning();
		return row ?? existing;
	}
	const [row] = await members.insertMembers(tx, [{ workspaceId, userId: account.id, displayName: account.name, role }]);
	if (!row) throw new Error("Member insert returned no row");
	return row;
}

/** Better Auth's session hook (src/server/auth/auth.ts): never fails a sign-in; a failure is logged. */
export async function acceptOnSignIn(
	db: Db,
	session: { userId: string; impersonatedBy?: string | null | undefined },
): Promise<void> {
	// An admin looking as someone else doesn't accept on their behalf.
	if (session.impersonatedBy) return;
	try {
		const accepted = await acceptInvitations(db, session.userId);
		if (accepted > 0) log("info", "taskline invitation accepted", { userId: session.userId, accepted });
	} catch (error) {
		log("error", "taskline invitation accept failed", { userId: session.userId, ...errorFields(error) });
	}
}
