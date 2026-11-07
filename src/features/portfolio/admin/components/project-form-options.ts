import { formOptions } from "@tanstack/react-form";
import { formValidators } from "@/components/forms";
import { type ProjectDetail, type ProjectFormValues, projectFormSchema } from "../../schema";

const EMPTY = { en: "", ne: "" };
const picked = (image: ProjectDetail["cover"]) => (image ? [{ id: image.id, preview: image }] : []);

/** The project form's values for a project (or a new one) and its validation, shared by the form and its sections. */
export const projectFormOptions = (item?: ProjectDetail) =>
	formOptions({
		defaultValues: {
			title: item?.title ?? "",
			slug: item?.slug ?? "",
			client: item?.client ?? EMPTY,
			year: item?.year ?? new Date().getFullYear(),
			disciplines: item?.disciplines ?? [],
			role: item?.role ?? EMPTY,
			duration: item?.duration ?? EMPTY,
			summary: item?.summary ?? EMPTY,
			stack: item?.stack ?? [],
			links: item?.links ?? [],
			metrics: item?.metrics ?? [],
			blocks: item?.blocks ?? [],
			artSeed: item?.artSeed ?? "",
			motif: item?.motif ?? "grid",
			glyph: item?.glyph ?? "",
			appSlug: item?.appSlug ?? "", // @apps
			featured: item?.featured ?? false,
			status: item?.status ?? "draft",
			cover: picked(item?.cover ?? null),
			gallery: (item?.gallery ?? []).map((image) => ({ id: image.id, preview: image })),
		} as ProjectFormValues,
		validators: formValidators(projectFormSchema),
	});
