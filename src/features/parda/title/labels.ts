import { m } from "@/paraglide/messages";
import type { ProviderKind } from "./types";

/**
 * Names for TMDB's English values (statuses, departments, key jobs, video kinds), in
 * the page's language. One we don't know is shown as TMDB sends it.
 */

type Labels = Readonly<Record<string, () => string>>;

const STATUS: Labels = {
	Released: m.pd_status_released,
	"Post Production": m.pd_status_post_production,
	"In Production": m.pd_status_in_production,
	Planned: m.pd_status_planned,
	Rumored: m.pd_status_rumored,
	Canceled: m.pd_status_canceled,
	"Returning Series": m.pd_status_returning,
	Ended: m.pd_status_ended,
	Pilot: m.pd_status_pilot,
};

const DEPARTMENTS: Labels = {
	Acting: m.pd_department_acting,
	Directing: m.pd_department_directing,
	Writing: m.pd_department_writing,
	Production: m.pd_department_production,
	Creator: m.pd_department_creator,
	Sound: m.pd_department_sound,
	Camera: m.pd_department_camera,
	Editing: m.pd_department_editing,
	Art: m.pd_department_art,
	"Costume & Make-Up": m.pd_department_costume,
	"Visual Effects": m.pd_department_visual_effects,
	Lighting: m.pd_department_lighting,
	Crew: m.pd_department_crew,
};

const JOBS: Labels = {
	Director: m.pd_job_director,
	Creator: m.pd_job_creator,
	Screenplay: m.pd_job_screenplay,
	Writer: m.pd_job_writer,
	Story: m.pd_job_story,
	Novel: m.pd_job_novel,
	Characters: m.pd_job_characters,
	"Original Music Composer": m.pd_job_composer,
	"Director of Photography": m.pd_job_photography,
	Editor: m.pd_job_editor,
	Producer: m.pd_job_producer,
};

const VIDEOS: Labels = {
	Trailer: m.pd_video_trailer,
	Teaser: m.pd_video_teaser,
	Clip: m.pd_video_clip,
	Featurette: m.pd_video_featurette,
	"Behind the Scenes": m.pd_video_behind,
	Bloopers: m.pd_video_bloopers,
	"Opening Credits": m.pd_video_opening,
};

const PROVIDER_KINDS: Readonly<Record<ProviderKind, () => string>> = {
	stream: m.pd_watch_stream,
	free: m.pd_watch_free,
	ads: m.pd_watch_ads,
	rent: m.pd_watch_rent,
	buy: m.pd_watch_buy,
};

const named = (labels: Labels) => (value: string) => labels[value]?.() ?? value;

export const statusLabel = named(STATUS);
export const departmentLabel = named(DEPARTMENTS);
export const jobLabel = named(JOBS);
export const videoLabel = named(VIDEOS);
export const providerKindLabel = (kind: ProviderKind) => PROVIDER_KINDS[kind]();
export const PROVIDER_ORDER: ReadonlyArray<ProviderKind> = ["stream", "free", "ads", "rent", "buy"];
