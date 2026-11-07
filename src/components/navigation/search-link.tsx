import { Link } from "@tanstack/react-router";
import type { ComponentProps } from "react";

export type SearchPatch = Record<string, unknown>;

/**
 * A link to the CURRENT page with some search params changed (pagination,
 * sorting, filters). It's a real <a href>, so it works before hydration and
 * without JavaScript; the route's validateSearch and search middlewares still
 * apply (defaults are stripped from the URL).
 */
export function SearchLink({
	patch,
	...props
}: Omit<ComponentProps<typeof Link>, "to" | "search" | "params"> & { patch: SearchPatch }) {
	return <Link to="." search={(prev: SearchPatch) => ({ ...prev, ...patch })} {...props} />;
}
