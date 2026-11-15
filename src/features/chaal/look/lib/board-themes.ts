/**
 * The board's colour themes (decision 0258). "diagram" is the default: white squares and
 * dark squares hatched in ink, like a printed diagram. The others are flat, for players
 * who find hatching busy. Each is a token set in src/styles/chaal.css, chosen by
 * `data-ch-board` on the board's container ("diagram" needs no attribute); the player
 * picks one in settings (Task 73), and tests/unit/chaal-tokens.test.ts checks every
 * square mark at 3:1 on each.
 */
export const CHAAL_BOARD_THEMES = ["diagram", "print", "stone"] as const;
