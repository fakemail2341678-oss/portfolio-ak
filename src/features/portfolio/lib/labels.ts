import { m } from "@/paraglide/messages";
import type { Discipline } from "../schema";

/** Discipline names. Message functions, called at render time so they follow the locale. */
export const DISCIPLINE_LABELS: Record<Discipline, () => string> = {
	product: m.portfolio_discipline_product,
	frontend: m.portfolio_discipline_frontend,
	backend: m.portfolio_discipline_backend,
	platform: m.portfolio_discipline_platform,
	ai: m.portfolio_discipline_ai,
};
