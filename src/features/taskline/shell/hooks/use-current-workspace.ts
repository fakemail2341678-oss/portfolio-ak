import { useParams } from "@tanstack/react-router";
import type { NavWorkspace } from "../../types";

/** The workspace the page is in (its `$ws`), else the first one the caller has. */
export function useCurrentWorkspace(workspaces: ReadonlyArray<NavWorkspace>): NavWorkspace | undefined {
	const params = useParams({ strict: false });
	return workspaces.find((workspace) => workspace.segment === params.ws) ?? workspaces[0];
}
