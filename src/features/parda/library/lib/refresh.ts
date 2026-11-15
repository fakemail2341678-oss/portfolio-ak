import type { QueryClient } from "@tanstack/react-query";
import { pardaLibraryKeys } from "../../keys";

/** After a save, a mark or a Remove: the rail and the title's progress read again. */
export const refreshLibrary = (queryClient: QueryClient) =>
	queryClient.invalidateQueries({ queryKey: pardaLibraryKeys.all, refetchType: "active" });
