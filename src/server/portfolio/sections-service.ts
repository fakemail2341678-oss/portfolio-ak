import "@tanstack/react-start/server-only";
import {
	type ExperienceInput,
	type ExperienceItem,
	experienceItem,
	type ProcessStepInput,
	type ProcessStepItem,
	processStepItem,
	type SkillInput,
	type SkillItem,
	skillItem,
	type TestimonialInput,
	type TestimonialItem,
	testimonialItem,
} from "@/features/portfolio/schema";
import { localizedValue } from "@/lib/i18n/localized";
import { changes } from "@/server/audit/record";
import { withAudit } from "@/server/db/crud";
import type { Services } from "@/server/services";
import type { SectionKind, SectionRow } from "./sections-repository";
import * as repo from "./sections-repository";

/**
 * The ordered sections' rules (experience, skills, process, testimonials): one
 * factory, four services, each with its own input, row mapping and audit label.
 * Every change is audited (0173); reordering is one row.
 */

type Config<K extends SectionKind, Input, Item> = {
	/** The input as table values. */
	values: (input: Input) => Record<string, unknown>;
	/** A row as the DTO (and the audit's before/after: its JSON). */
	item: (row: SectionRow<K>) => Item;
	/** The entry's name in the audit log. */
	label: (row: SectionRow<K>) => string;
};

function sectionService<K extends SectionKind, Input, Item extends { id: string }>(
	kind: K,
	config: Config<K, Input, Item>,
) {
	const target = (row: SectionRow<K>) => ({ type: kind, id: row.id, label: config.label(row) });
	const snapshot = (row: SectionRow<K>) => {
		const {
			id: _id,
			sortOrder: _order,
			updatedAt: _updated,
			...content
		} = config.item(row) as Item & {
			sortOrder: number;
			updatedAt: string;
		};
		return { label: config.label(row), content: JSON.stringify(content) };
	};
	return {
		list: async ({ db }: Pick<Services, "db">): Promise<Item[]> => (await repo.listSection(db, kind)).map(config.item),

		create: ({ db, actor }: Services, input: Input): Promise<Item> =>
			withAudit(db, actor, async (tx, audit) => {
				const row = await repo.createSection(tx, kind, config.values(input) as never);
				audit({ action: "portfolio-section.create", target: target(row), after: { name: config.label(row) } });
				return config.item(row);
			}),

		update: ({ db, actor }: Services, { id, updatedAt, ...input }: Input & { id: string; updatedAt: string }) =>
			withAudit(db, actor, async (tx, audit): Promise<Item> => {
				const { before, row } = await repo.updateSection(tx, kind, {
					id,
					version: updatedAt,
					set: config.values(input as Input),
				});
				const changed = changes(snapshot(before), snapshot(row), ["label", "content"], ["label"]);
				if (changed) audit({ action: "portfolio-section.update", target: target(row), ...changed });
				return config.item(row);
			}),

		remove: async ({ db, actor }: Services, ids: ReadonlyArray<string>): Promise<{ deleted: number }> => {
			const rows = await withAudit(db, actor, async (tx, audit) => {
				const deleted = await repo.deleteSection(tx, kind, ids);
				audit(
					...deleted.map((row) => ({
						action: "portfolio-section.delete" as const,
						target: target(row),
						before: { name: config.label(row) },
					})),
				);
				return deleted;
			});
			return { deleted: rows.length };
		},

		reorder: ({ db, actor }: Services, ids: ReadonlyArray<string>): Promise<{ moved: number }> =>
			withAudit(db, actor, async (tx, audit) => {
				const moved = await repo.reorderSection(tx, kind, ids);
				if (moved > 0) {
					audit({ action: "portfolio-section.reorder", target: { type: kind, id: "order" }, after: { moved } });
				}
				return { moved };
			}),
	};
}

export const experience = sectionService<"experience", ExperienceInput, ExperienceItem>("experience", {
	values: (input) => ({ ...input, end: input.end || null }),
	item: (row) => experienceItem.parse({ ...row, end: row.end ?? "" }),
	label: (row) => row.company,
});

export const skills = sectionService<"skill", SkillInput, SkillItem>("skill", {
	values: (input) => ({ ...input }),
	item: (row) => skillItem.parse(row),
	label: (row) => localizedValue(row.title, "en"),
});

export const process = sectionService<"process-step", ProcessStepInput, ProcessStepItem>("process-step", {
	values: (input) => ({ ...input }),
	item: (row) => processStepItem.parse(row),
	label: (row) => localizedValue(row.title, "en"),
});

export const testimonials = sectionService<"testimonial", TestimonialInput, TestimonialItem>("testimonial", {
	values: (input) => ({ ...input }),
	item: (row) => testimonialItem.parse(row),
	label: (row) => row.name,
});
