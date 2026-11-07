import { queryOptions } from "@tanstack/react-query";
import { getChaalPreferences } from "@/functions/chaal/preferences";
import { chaalKeys } from "../keys";

/** A session's saved preferences (null: none saved yet). The `_chaal` layout's loader reads it for a session. */
export const chaalPreferencesQueryOptions = () =>
	queryOptions({ queryKey: chaalKeys.preferences(), queryFn: () => getChaalPreferences() });
