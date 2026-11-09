import "@tanstack/react-start/server-only";
import { serverEnv } from "@/server/env";
import type { Services } from "@/server/services";
import type { ConnectDeps } from "../connect/service";
import type { ChaalControls } from "../controls";
import { chaalConnectDeps, chaalControls } from "../store";

/**
 * What Chaal's admin services work with (Task 79, decision 0268): the call's services, the
 * controls (cleared after every write, so this process sees the change at once; others
 * within 5 s), the connection service's dependencies (revoking a token at Lichess) and
 * whether CHAAL_TOKEN_KEY is set. Tests pass their own.
 */
export type ChaalAdminServices = Services & {
	controls: Pick<ChaalControls, "invalidate">;
	connect: () => Promise<ConnectDeps>;
	connectConfigured: boolean;
};

export const chaalAdmin = (services: Services): ChaalAdminServices => ({
	...services,
	controls: chaalControls,
	connect: chaalConnectDeps,
	connectConfigured: Boolean(serverEnv.CHAAL_TOKEN_KEY),
});
