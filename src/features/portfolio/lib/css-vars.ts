import type { CSSProperties } from "react";

/** Custom properties for an inline style (`--i`, `--n`…), typed so React accepts them. */
export const cssVars = (vars: Record<`--${string}`, string | number>): CSSProperties => vars as CSSProperties;
