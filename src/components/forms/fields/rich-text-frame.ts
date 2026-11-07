// Shared by the server placeholder and the client editor so both occupy exactly
// the same space (no layout shift when the editor chunk mounts).
// The toolbar scrolls sideways on narrow screens; its height never changes.
export const RICH_TEXT_TOOLBAR = "flex h-10 items-center gap-0.5 overflow-x-auto border-b px-1";
export const RICH_TEXT_SURFACE = "min-h-40 px-3 py-2";
