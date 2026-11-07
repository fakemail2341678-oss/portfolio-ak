import { useMutation } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { DescriptionList } from "@/components/data-display/description-list";
import { errorMessage } from "@/components/errors/error-page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Demo, ExamplePage } from "@/features/dev/examples/example-page";
import { Can, useActor, useCan } from "@/features/rbac/can";
import { exampleManageRoles, exampleReadItems } from "@/functions/examples-permissions";
import { staticCrumb } from "@/lib/breadcrumbs";
import { privateHead } from "@/lib/seo";
import { m } from "@/paraglide/messages";

/**
 * Permissions: the server is the authority. Each server function runs
 * requirePermission (src/functions/examples-permissions.ts); the UI only hides
 * what the server would refuse (useCan, <Can>). The buttons below call both
 * functions whatever the UI thinks, so the server's answer is visible.
 * Routes guard with assertRoutePermission in beforeLoad (see docs/guides/rbac.md).
 */
export const Route = createFileRoute("/dev/examples/permissions")({
	staticData: { breadcrumb: staticCrumb(m.examples_permissions_title) },
	head: () => privateHead(m.examples_permissions_title()),
	component: PermissionsExample,
});

function PermissionsExample() {
	const actor = useActor();
	const canManageRoles = useCan("roles:manage");
	return (
		<ExamplePage slug="permissions">
			<Demo title={m.examples_permissions_you()} note={m.examples_permissions_you_note()}>
				<DescriptionList
					items={[
						{
							label: m.examples_permissions_signed_in(),
							value: actor ? m.examples_yes() : m.examples_no(),
							testId: "perm-signed-in",
						},
						{ label: m.examples_permissions_can_manage(), value: canManageRoles ? m.examples_yes() : m.examples_no() },
						{
							label: m.examples_permissions_list(),
							value:
								actor && actor.permissions.length > 0 ? (
									<span className="flex flex-wrap gap-1">
										{actor.permissions.map((permission) => (
											<Badge key={permission} variant="secondary" className="font-mono">
												{permission}
											</Badge>
										))}
									</span>
								) : (
									m.examples_none()
								),
						},
					]}
				/>
				<Can permission="test-crud:read" fallback={<p className="text-sm">{m.examples_permissions_hidden()}</p>}>
					<p className="text-sm" data-testid="can-read">
						{m.examples_permissions_shown()}
					</p>
				</Can>
			</Demo>
			<Demo title={m.examples_permissions_server()} note={m.examples_permissions_server_note()}>
				<ServerCall label="test-crud:read" call={() => exampleReadItems()} />
				<ServerCall label="roles:manage" call={() => exampleManageRoles()} />
			</Demo>
		</ExamplePage>
	);
}

function ServerCall({ label, call }: { label: string; call: () => Promise<{ ok: boolean }> }) {
	const mutation = useMutation({ mutationFn: call });
	return (
		<div className="flex flex-wrap items-center gap-3">
			<Button variant="outline" size="sm" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
				{m.examples_permissions_call({ permission: label })}
			</Button>
			<output className="text-sm" data-testid={`call-${label}`}>
				{mutation.isSuccess
					? m.examples_permissions_allowed()
					: mutation.isError
						? errorMessage(mutation.error)
						: mutation.isPending
							? m.examples_working()
							: null}
			</output>
		</div>
	);
}
