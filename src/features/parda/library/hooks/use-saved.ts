import { useQuery } from "@tanstack/react-query";
import { sessionQueryOptions } from "@/features/auth/queries";
import { EMPTY } from "../components/save-button";
import { pardaSavedQueryOptions } from "../queries";
import type { SavedState } from "../types";

export function useSaved(): SavedState {
	const { data: session } = useQuery(sessionQueryOptions());
	const { data } = useQuery({ ...pardaSavedQueryOptions(), enabled: Boolean(session) });
	return session ? (data ?? EMPTY) : EMPTY;
}
