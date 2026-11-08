/**
 * The engine's files (PLAN 13.5, "The engine"; decisions 0257 and 0263): the `stockfish`
 * package's lite single-threaded build, copied unmodified into public/chaal/engine/ by
 * `pnpm engine:copy` (scripts/engine-copy.ts, also run by the Vite plugin before dev and
 * build). The names carry a hash of both files, so they're served immutable; the copy
 * refuses files whose hash isn't this one, so a new package version is a change here.
 *
 * The worker loads its .wasm from its own name with ".js" swapped for ".wasm".
 */
export const ENGINE_PACKAGE = { name: "stockfish", version: "19.0.1", build: "stockfish-19-lite-single" } as const;

/** The engine's name on screen: a name, the same in both languages. */
export const ENGINE_NAME = "Stockfish 19";

/** sha256 over the .js then the .wasm, its first 12 hex characters. */
export const ENGINE_HASH = "38f7c90e0576";

/** Where the files are served. */
export const ENGINE_DIR = "/chaal/engine";
export const ENGINE_SCRIPT = `${ENGINE_DIR}/${ENGINE_PACKAGE.build}.${ENGINE_HASH}.js`;
export const ENGINE_WASM = `${ENGINE_DIR}/${ENGINE_PACKAGE.build}.${ENGINE_HASH}.wasm`;
/** The GPL's text, shipped beside the engine (the about page links it). */
export const ENGINE_LICENCE = `${ENGINE_DIR}/COPYING.txt`;
/** The .wasm's size in bytes: the progress bar's total before the worker reports one. */
export const ENGINE_WASM_BYTES = 1_845_971;
