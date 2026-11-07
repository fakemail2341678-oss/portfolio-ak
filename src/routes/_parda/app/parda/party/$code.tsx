import { createFileRoute, notFound } from "@tanstack/react-router";
import { pardaHead } from "@/features/parda/brand";
import { PardaPartyPage } from "@/features/parda/party/party-page";
import { getLocale } from "@/paraglide/runtime";

/**
 * /app/parda/party/{code}: a watch party (PLAN Task 69a, decision 0243). Private (noindex) and
 * never listed; the code is the invitation. Anyone holding it sees what's playing, and
 * joining starts a guest if needed. A wrong code, or a party that ended, is Parda's 404.
 */
export const Route = createFileRoute("/_parda/app/parda/party/$code")({
	loader: async ({ context, params }) => {
		if (!/^[\w-]{16}$/.test(params.code)) throw notFound();
		const { loadPartyPage } = await import("@/features/parda/party/load");
		return loadPartyPage(context.queryClient, getLocale(), params.code);
	},
	head: ({ loaderData }) => pardaHead(loaderData?.title),
	component: PardaPartyPage,
});
