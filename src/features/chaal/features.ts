/**
 * Chaal's feature switches and the Lichess scopes they need (PLAN 13.5, "Scopes by
 * feature"; decision 0254). The switches live in `ch_settings.features` (on unless the
 * admin turns one off, so a feature added later needs no migration), each feature's
 * server check arrives with the feature, and their admin UI with Task 79.
 */
export const CHAAL_FEATURES = [
	"play",
	"puzzles",
	"analysis",
	"engine",
	"explorer",
	"watch",
	"players",
	"social",
	"tournaments",
	"teams",
	"studies",
	"preferences",
] as const;
export type ChaalFeature = (typeof CHAAL_FEATURES)[number];

export type ChaalFeatureSwitches = Readonly<Partial<Record<ChaalFeature, boolean>>>;

/** Every Lichess scope Chaal may ask for (PLAN 13.4). */
export const LICHESS_SCOPES = [
	"board:play",
	"challenge:read",
	"challenge:write",
	"puzzle:read",
	"puzzle:write",
	"follow:read",
	"follow:write",
	"study:read",
	"study:write",
	"team:read",
	"team:write",
	"tournament:write",
	"preference:read",
] as const;
export type LichessScope = (typeof LICHESS_SCOPES)[number];

/** What each feature needs from a connected account. Features missing here need no scope. */
export const FEATURE_SCOPES: Readonly<Partial<Record<ChaalFeature, ReadonlyArray<LichessScope>>>> = {
	play: ["board:play", "challenge:read", "challenge:write"],
	puzzles: ["puzzle:read", "puzzle:write"],
	social: ["follow:read", "follow:write"],
	studies: ["study:read", "study:write"],
	teams: ["team:read", "team:write"],
	tournaments: ["tournament:write"],
	preferences: ["preference:read"],
};

export const isLichessScope = (value: string): value is LichessScope =>
	(LICHESS_SCOPES as ReadonlyArray<string>).includes(value);

/** Whether a feature is on: the admin's switch, else on. */
export const featureOn = (switches: ChaalFeatureSwitches, feature: ChaalFeature): boolean => switches[feature] ?? true;

/** The scopes connecting asks for: every enabled feature's, plus the admin's extras, in catalogue order. */
export function scopesFor(switches: ChaalFeatureSwitches, extra: ReadonlyArray<string> = []): LichessScope[] {
	const wanted = new Set<string>(extra.filter(isLichessScope));
	for (const feature of CHAAL_FEATURES) {
		if (featureOn(switches, feature)) for (const scope of FEATURE_SCOPES[feature] ?? []) wanted.add(scope);
	}
	return LICHESS_SCOPES.filter((scope) => wanted.has(scope));
}

/** The scopes a feature needs that a connection lacks: "Reconnect to allow …" when not empty. */
export const missingScopes = (feature: ChaalFeature, granted: ReadonlyArray<string>): LichessScope[] =>
	(FEATURE_SCOPES[feature] ?? []).filter((scope) => !granted.includes(scope));
