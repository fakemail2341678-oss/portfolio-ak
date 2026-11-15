import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { sessionQueryOptions } from "@/features/auth/queries";
import { getLocale } from "@/paraglide/runtime";
import { EMPTY, localProgress, type TitleRef } from "../components/title-progress-button";
import type { SeriesShape } from "../lib/progress";
import { pardaTitleProgressQueryOptions } from "../queries";
import type { TitleProgressData } from "../types";

export function useTitleProgress(ref: TitleRef, shape?: SeriesShape): TitleProgressData {
	const { data: session } = useQuery(sessionQueryOptions());
	const { data } = useQuery({
		...pardaTitleProgressQueryOptions(getLocale(), ref.media, ref.id),
		enabled: Boolean(session),
	});
	const [local, setLocal] = useState<TitleProgressData>(EMPTY);
	// biome-ignore lint/correctness/useExhaustiveDependencies: ref and shape come with the page.
	useEffect(() => {
		if (!session) setLocal(localProgress(ref, shape));
		// The browser's progress is read once per page.
	}, [session]);
	return session ? (data ?? EMPTY) : local;
}
