/**
 * Puzzle themes (PLAN Task 80; decision 0269): Lichess's keys, grouped for choosing. Their
 * names are our own messages (./themes.ts), kept apart so the browser's store, the schema
 * and the server read the keys without the names. A theme Lichess adds later isn't offered
 * or shown until it has a name.
 */
export const PUZZLE_THEME_GROUPS = {
	motifs: [
		"fork",
		"pin",
		"skewer",
		"discoveredAttack",
		"discoveredCheck",
		"doubleCheck",
		"sacrifice",
		"deflection",
		"attraction",
		"clearance",
		"interference",
		"intermezzo",
		"xRayAttack",
		"capturingDefender",
		"hangingPiece",
		"trappedPiece",
		"exposedKing",
		"kingsideAttack",
		"queensideAttack",
		"attackingF2F7",
		"advancedPawn",
		"defensiveMove",
		"quietMove",
		"zugzwang",
		"collinearMove",
	],
	special: ["castling", "enPassant", "promotion", "underPromotion"],
	mates: [
		"mate",
		"mateIn1",
		"mateIn2",
		"mateIn3",
		"mateIn4",
		"mateIn5",
		"backRankMate",
		"smotheredMate",
		"anastasiaMate",
		"arabianMate",
		"balestraMate",
		"blindSwineMate",
		"bodenMate",
		"cornerMate",
		"doubleBishopMate",
		"dovetailMate",
		"epauletteMate",
		"hookMate",
		"killBoxMate",
		"morphysMate",
		"operaMate",
		"pillsburysMate",
		"swallowstailMate",
		"triangleMate",
		"vukovicMate",
	],
	phases: [
		"opening",
		"middlegame",
		"endgame",
		"pawnEndgame",
		"knightEndgame",
		"bishopEndgame",
		"rookEndgame",
		"queenEndgame",
		"queenRookEndgame",
	],
	goals: ["equality", "advantage", "crushing"],
	lengths: ["oneMove", "short", "long", "veryLong"],
	origins: ["master", "masterVsMaster", "superGM"],
} as const;

export type PuzzleThemeGroup = keyof typeof PUZZLE_THEME_GROUPS;
export type PuzzleTheme = (typeof PUZZLE_THEME_GROUPS)[PuzzleThemeGroup][number];

/** What training may ask Lichess for: a mix of everything, or one theme. */
export const PUZZLE_ANGLES = ["mix", ...Object.values(PUZZLE_THEME_GROUPS).flat()] as ["mix", ...PuzzleTheme[]];
export type PuzzleAngle = (typeof PUZZLE_ANGLES)[number];

export const isPuzzleAngle = (value: string): value is PuzzleAngle =>
	(PUZZLE_ANGLES as ReadonlyArray<string>).includes(value);
