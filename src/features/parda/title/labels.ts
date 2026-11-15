import { m } from "@/paraglide/messages";
import type { ProviderKind } from "./types";

/**
 * Names for TMDB's English values (statuses, departments, key jobs, video kinds), in
 * the page's language. One we don't know is shown as TMDB sends it.
 */

type Labels = Readonly<Record<string, () => string>>;

const STATUS: Labels = {
	Released: m.parda_status_released,
	"Post Production": m.parda_status_post_production,
	"In Production": m.parda_status_in_production,
	Planned: m.parda_status_planned,
	Rumored: m.parda_status_rumored,
	Canceled: m.parda_status_canceled,
	"Returning Series": m.parda_status_returning,
	Ended: m.parda_status_ended,
	Pilot: m.parda_status_pilot,
};

const DEPARTMENTS: Labels = {
	Acting: m.parda_department_acting,
	Directing: m.parda_department_directing,
	Writing: m.parda_department_writing,
	Production: m.parda_department_production,
	Creator: m.parda_department_creator,
	Sound: m.parda_department_sound,
	Camera: m.parda_department_camera,
	Editing: m.parda_department_editing,
	Art: m.parda_department_art,
	"Costume & Make-Up": m.parda_department_costume,
	"Visual Effects": m.parda_department_visual_effects,
	Lighting: m.parda_department_lighting,
	Crew: m.parda_department_crew,
};

const JOBS: Labels = {
	Director: m.parda_job_director,
	Creator: m.parda_job_creator,
	Screenplay: m.parda_job_screenplay,
	Writer: m.parda_job_writer,
	Story: m.parda_job_story,
	Novel: m.parda_job_novel,
	Characters: m.parda_job_characters,
	"Original Music Composer": m.parda_job_composer,
	"Director of Photography": m.parda_job_photography,
	Editor: m.parda_job_editor,
	Producer: m.parda_job_producer,
};

const VIDEOS: Labels = {
	Trailer: m.parda_video_trailer,
	Teaser: m.parda_video_teaser,
	Clip: m.parda_video_clip,
	Featurette: m.parda_video_featurette,
	"Behind the Scenes": m.parda_video_behind,
	Bloopers: m.parda_video_bloopers,
	"Opening Credits": m.parda_video_opening,
};

const PROVIDER_KINDS: Readonly<Record<ProviderKind, () => string>> = {
	stream: m.parda_watch_stream,
	free: m.parda_watch_free,
	ads: m.parda_watch_ads,
	rent: m.parda_watch_rent,
	buy: m.parda_watch_buy,
};

const named = (labels: Labels) => (value: string) => labels[value]?.() ?? value;

export const statusLabel = named(STATUS);
export const departmentLabel = named(DEPARTMENTS);
export const jobLabel = named(JOBS);
export const videoLabel = named(VIDEOS);
export const providerKindLabel = (kind: ProviderKind) => PROVIDER_KINDS[kind]();
export const PROVIDER_ORDER: ReadonlyArray<ProviderKind> = ["stream", "free", "ads", "rent", "buy"];
