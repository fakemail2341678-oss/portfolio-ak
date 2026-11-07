import "@tanstack/react-start/server-only";
import { db } from "@/server/db/client";
import { serverEnv } from "@/server/env";
import { createPardaControls } from "../controls";
import { createTmdbCache } from "./cache";
import { createTmdb, type Tmdb } from "./client";

/** The configured TMDB client, or null when TMDB_READ_TOKEN is unset (the catalogue is "not configured"). */
export const pardaTmdb: Tmdb | null = serverEnv.TMDB_READ_TOKEN
	? createTmdb({
			token: serverEnv.TMDB_READ_TOKEN,
			apiBase: serverEnv.TMDB_API_BASE,
			imageBase: serverEnv.TMDB_IMAGE_BASE,
		})
	: null;

export const pardaControls = createPardaControls(db);

/** The process's cache of TMDB answers (decision 0229), shared by every catalogue read. */
export const pardaCache = createTmdbCache();
