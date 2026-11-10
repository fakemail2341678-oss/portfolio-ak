import "@tanstack/react-start/server-only";
import { readCommunityLimits } from "@/features/chaal/community/limits";
import { type ReadStudy, readStudy } from "@/features/chaal/studies/chapters";
import {
	type ChaalStudy,
	type ChaalStudyChapter,
	type ChaalStudyList,
	type SavedToStudy,
	type SaveToStudyInput,
	STUDIES_SHOWN,
	type StudySummary,
} from "@/features/chaal/studies/schema";
import { AppError } from "@/lib/errors";
import type { Session } from "@/lib/session";
import { type ConnectDeps, requireFeature, withToken } from "../connect/service";
import type { ChaalPublic } from "../context";
import { userLane } from "../lichess/lanes";
import { studyImportAnswer, studyLineAnswer } from "../lichess/schemas";
import { readAsViewer, viewerOf } from "../viewer";

/**
 * Studies (PLAN Task 83, decision 0273). Lichess exports a study as one PGN, a game per
 * chapter (src/features/chaal/studies/chapters.ts); the server keeps it read (five minutes
 * public; a minute for a viewer who reads with their own token, which also opens their
 * private studies, kept apart by `owner`) and sends a page the chapters' list and the chapter
 * shown. An account's studies are public; the player's own (with private ones) and "Save to
 * study" use their token (`study:read`, `study:write`). The `studies` switch.
 */

const MINUTE = 60_000;

const TTL = { list: 5 * MINUTE, study: 5 * MINUTE, own: MINUTE } as const;

/** A whole study, at most: Lichess allows 64 chapters. */
const STUDY_MAX_BYTES = 4_000_000;

type Public = Pick<ChaalPublic, "cache" | "lichess" | "settings">;

/** An account's public studies (the first `STUDIES_SHOWN`, as Lichess lists them). */
export async function studiesBy(chaal: Public, username: string): Promise<ChaalStudyList> {
	requireFeature(chaal.settings, "studies");
	const by = username.toLowerCase();
	const path = `/api/study/by/${by}`;
	const studies = await chaal.cache.read(
		{ endpoint: "studies-by", path, epoch: chaal.settings.cacheEpoch },
		TTL.list,
		() => chaal.lichess.lines({ endpoint: "studies-by", path, lane: "public" }, studyLineAnswer, STUDIES_SHOWN),
	);
	return { by, studies };
}

/** A study read whole: with the viewer's token when it may be used (private studies too), else the public one. */
async function readWhole(chaal: ChaalPublic, session: Session | null, id: string): Promise<ReadStudy> {
	requireFeature(chaal.settings, "studies");
	const path = `/api/study/${id}.pgn`;
	const epoch = chaal.settings.cacheEpoch;
	const viewer = await viewerOf(chaal, session);
	const own = await readAsViewer(chaal, viewer, "studies", (token, row) =>
		chaal.cache.read({ endpoint: "study", path, epoch, owner: row.userId }, TTL.own, async () =>
			readStudy(
				await chaal.lichess.pgn({ endpoint: "study", path, token, lane: userLane(row.userId) }, STUDY_MAX_BYTES),
			),
		),
	);
	const study =
		own ??
		(await chaal.cache.read({ endpoint: "study", path, epoch }, TTL.study, async () =>
			readStudy(await chaal.lichess.pgn({ endpoint: "study", path, lane: "public" }, STUDY_MAX_BYTES)),
		));
	if (study.chapters.length === 0) throw new AppError("NOT_FOUND", "Study not found");
	return study;
}

/** A study's name and chapters. NOT_FOUND when Lichess has no such study, or it isn't the viewer's to read. */
export async function study(chaal: ChaalPublic, session: Session | null, id: string): Promise<ChaalStudy> {
	const whole = await readWhole(chaal, session, id);
	return {
		id,
		name: whole.name || id,
		chapters: whole.chapters.map(({ pgn: _pgn, ...chapter }) => chapter),
		url: `https://lichess.org/study/${id}`,
	};
}

/** One chapter's PGN. NOT_FOUND when the study has no such chapter. */
export async function studyChapter(
	chaal: ChaalPublic,
	session: Session | null,
	id: string,
	chapter: string,
): Promise<ChaalStudyChapter> {
	const whole = await readWhole(chaal, session, id);
	const found = whole.chapters.find((each) => each.id === chapter);
	if (!found) throw new AppError("NOT_FOUND", "Chapter not found");
	return { id, chapter, pgn: found.pgn };
}

/** The player's own studies, private ones too. */
export function myStudies(deps: ConnectDeps, userId: string): Promise<StudySummary[]> {
	return withToken(deps, userId, "studies", (token, row) =>
		deps.lichess.lines(
			{ endpoint: "studies-mine", path: `/api/study/by/${row.lichessId}`, token, lane: userLane(userId) },
			studyLineAnswer,
			STUDIES_SHOWN,
		),
	);
}

/** "Save to study": the PGN as a new chapter of one of the player's studies (Lichess refuses one they can't write to). */
export async function saveToStudy(deps: ConnectDeps, userId: string, input: SaveToStudyInput): Promise<SavedToStudy> {
	if (!readCommunityLimits((await deps.controls.settings()).community).saveToStudy)
		throw new AppError("FORBIDDEN", "Saving to a study is off");
	const saved = await withToken(deps, userId, "studies", (token) =>
		deps.lichess.json(
			{
				endpoint: "study-import",
				path: `/api/study/${input.study}/import-pgn`,
				method: "POST",
				form: { pgn: input.pgn, name: input.name, orientation: input.orientation, variant: "standard" },
				token,
				lane: userLane(userId),
			},
			studyImportAnswer,
		),
	);
	return { study: input.study, chapter: saved.chapter };
}
