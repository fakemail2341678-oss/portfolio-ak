import { m } from "@/paraglide/messages";
import type { ExamplePriority } from "./schema";

export const PRIORITY_LABELS: Readonly<Record<ExamplePriority, () => string>> = {
	low: m.examples_priority_low,
	medium: m.examples_priority_medium,
	high: m.examples_priority_high,
};
