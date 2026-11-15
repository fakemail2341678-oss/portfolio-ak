import { createIsomorphicFn } from "@tanstack/react-start";
import { getCookie } from "@tanstack/react-start/server";
import { LOCAL_COOKIE } from "./local";

/**
 * Whether this browser keeps progress of its own (the `pd_local` cookie), on the server
 * during SSR and in the browser after: the home keeps the rail's space for it. Its own
 * module, because a server import has no place in the frame's code (or Storybook's).
 */
export const keepsLocalProgress = createIsomorphicFn()
	.server(() => getCookie(LOCAL_COOKIE) === "1")
	.client(() => document.cookie.split("; ").includes(`${LOCAL_COOKIE}=1`));
