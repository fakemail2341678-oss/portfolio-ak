import type { PostRecord } from "../types.ts";
import { crdtsWithoutThePhd } from "./crdts-without-the-phd.ts";
import { designingForTwoScripts } from "./designing-for-two-scripts.ts";
import { postgresIsEnough } from "./postgres-is-enough.ts";
import { serverRenderEverything } from "./server-render-everything.ts";
import { shippingForSlowNetworks } from "./shipping-for-slow-networks.ts";
import { theUrlIsTheState } from "./the-url-is-the-state.ts";

/** One file per article; the journal sorts them by date. */
export const posts: PostRecord[] = [
	serverRenderEverything,
	crdtsWithoutThePhd,
	designingForTwoScripts,
	theUrlIsTheState,
	postgresIsEnough,
	shippingForSlowNetworks,
];
