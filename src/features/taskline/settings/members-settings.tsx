import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { UserMinusIcon, UserPlusIcon } from "lucide-react";
import { type FormEvent, useId } from "react";
import { toast } from "sonner";
import { UserAvatar } from "@/components/data-display/user-avatar";
import { useConfirm } from "@/components/dialogs/confirm";
import { errorMessage } from "@/components/errors/error-page";
import { FormSection } from "@/components/page/form-layout";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { m } from "@/paraglide/messages";
import { PROJECT_ROLE_LABELS } from "../labels";
import { projectMembersQueryOptions, tasklineMutations, workspaceMembersQueryOptions } from "../queries";
import { PROJECT_ROLES, type ProjectRole } from "../types";

const route = getRouteApi("/_taskline/app/taskline/_shell/$ws/p/$key/settings/members");

/** Members: who is on the project and in which role; add a workspace member, change or remove one. */
export function MembersSettings() {
	const { session } = route.useRouteContext();
	const { ws, key } = route.useParams();
	const userId = session.user.id;
	const queryClient = useQueryClient();
	const confirm = useConfirm();
	const formId = useId();
	const { data: people } = useSuspenseQuery(projectMembersQueryOptions(userId, ws, key));
	const { data: everyone } = useSuspenseQuery(workspaceMembersQueryOptions(userId, ws));
	const set = useMutation(tasklineMutations.setProjectMember(queryClient, userId));
	const remove = useMutation(tasklineMutations.removeProjectMember(queryClient, userId));
	const fail = (error: Error) => toast.error(errorMessage(error));
	const candidates = everyone.filter(
		(member) => !member.deactivated && !people.some((person) => person.memberId === member.id),
	);

	const add = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const data = new FormData(event.currentTarget);
		const memberId = String(data.get("member") ?? "");
		const role = String(data.get("role") ?? "member") as ProjectRole;
		if (!memberId) return;
		set.mutate(
			{ ws, key, memberId, role },
			{ onSuccess: () => toast.success(m.taskline_member_added()), onError: fail },
		);
	};

	const removeMember = async (memberId: string, name: string) => {
		const confirmed = await confirm({
			title: m.taskline_member_remove_title({ name }),
			description: m.taskline_member_remove_body(),
			confirmLabel: m.taskline_member_remove(),
			destructive: true,
		});
		if (confirmed) remove.mutate({ ws, key, memberId }, { onError: fail });
	};

	return (
		<FormSection title={m.taskline_settings_members()} description={m.taskline_settings_members_description()}>
			<ul className="flex flex-col divide-y rounded-md border" data-testid="project-members">
				{people.map((person) => (
					<li key={person.memberId} className="flex flex-wrap items-center gap-3 px-3 py-2">
						<UserAvatar name={person.name} size="sm" />
						<span className="min-w-0 flex-1 truncate text-body">{person.name}</span>
						<NativeSelect
							value={person.role}
							aria-label={m.taskline_member_role_of({ name: person.name })}
							className="h-8 w-auto"
							onChange={(event) =>
								set.mutate(
									{ ws, key, memberId: person.memberId, role: event.target.value as ProjectRole },
									{ onError: fail },
								)
							}
						>
							{PROJECT_ROLES.map((role) => (
								<option key={role} value={role}>
									{PROJECT_ROLE_LABELS[role]()}
								</option>
							))}
						</NativeSelect>
						<Button variant="ghost" size="icon" onClick={() => void removeMember(person.memberId, person.name)}>
							<UserMinusIcon aria-hidden />
							<span className="sr-only">{m.taskline_member_remove_name({ name: person.name })}</span>
						</Button>
					</li>
				))}
			</ul>
			{candidates.length > 0 ? (
				<form method="post" onSubmit={add} className="flex flex-wrap items-end gap-3" data-testid="add-project-member">
					<label htmlFor={`${formId}-member`} className="flex flex-col gap-1.5 text-body">
						<span className="font-medium">{m.taskline_member_add_who()}</span>
						<NativeSelect id={`${formId}-member`} name="member" className="w-56">
							{candidates.map((member) => (
								<option key={member.id} value={member.id}>
									{member.name}
								</option>
							))}
						</NativeSelect>
					</label>
					<label htmlFor={`${formId}-role`} className="flex flex-col gap-1.5 text-body">
						<span className="font-medium">{m.taskline_member_role()}</span>
						<NativeSelect id={`${formId}-role`} name="role" defaultValue="member" className="w-36">
							{PROJECT_ROLES.map((role) => (
								<option key={role} value={role}>
									{PROJECT_ROLE_LABELS[role]()}
								</option>
							))}
						</NativeSelect>
					</label>
					<Button type="submit" variant="outline" disabled={set.isPending}>
						<UserPlusIcon aria-hidden />
						{m.taskline_member_add()}
					</Button>
				</form>
			) : (
				<p className="text-muted-foreground text-sm">{m.taskline_member_everyone()}</p>
			)}
		</FormSection>
	);
}
