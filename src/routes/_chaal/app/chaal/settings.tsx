import { createFileRoute } from "@tanstack/react-router";
import { chaalHead } from "@/features/chaal/lib/brand";
import { connectResultSearch } from "@/features/chaal/search";
import { ChaalSettings } from "@/features/chaal/settings/components/chaal-settings-page";
import { m } from "@/paraglide/messages";

/**
 * /app/chaal/settings: preferences, the Lichess connection and this browser's data (noindex).
 * Open to visitors: without a session the preferences stay in the browser. Connecting
 * returns here with `?lichess=<result>`. The layout's loader read the session's data.
 */
export const Route = createFileRoute("/_chaal/app/chaal/settings")({
	validateSearch: connectResultSearch,
	head: () => chaalHead(m.chaal_settings_title()),
	component: ChaalSettings,
});
