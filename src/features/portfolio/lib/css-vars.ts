// The type is named inline: lib/ imports no React, and this is only the style prop's shape.
type CSSProperties = import("react").CSSProperties;

/** Custom properties for an inline style (`--i`, `--n`…), typed so React accepts them. */
export const cssVars = (vars: Record<`--${string}`, string | number>): CSSProperties => vars as CSSProperties;
