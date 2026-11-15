/**
 * Every rule of the standard (docs/guides/conventions.md, "The standard"; decision 0297), in the
 * guide's order. tests/unit/standard/standard.test.ts runs each one against the list of known
 * deviations; `pnpm standard` does the same from the command line.
 */
import { codeRules } from "./rules/code.ts";
import { functionRules } from "./rules/functions.ts";
import { nameRules } from "./rules/names.ts";
import { structureRules } from "./rules/structure.ts";
import type { Rule } from "./tree.ts";

export const RULES: ReadonlyArray<Rule> = [...structureRules, ...nameRules, ...functionRules, ...codeRules];
