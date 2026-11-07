import {
	AtSignIcon,
	CalendarIcon,
	CircleDotIcon,
	HashIcon,
	ListChecksIcon,
	type LucideIcon,
	SquareCheckIcon,
	StarIcon,
	TextCursorInputIcon,
	TextIcon,
} from "lucide-react";
import { defineStatuses } from "@/components/data-display/status-badge";
import { m } from "@/paraglide/messages";
import type { FieldType } from "./fields";
import type { FormStatus } from "./types";

/** Forms' statuses (decision 0195): a draft is visible to its owner only; a published form is at /f/<slug>. */
export const FORM_STATUS = defineStatuses<FormStatus>({
	draft: { tone: "neutral", label: m.forms_status_draft },
	published: { tone: "success", label: m.forms_status_published },
});

/** Each field type's name, line of help and icon: the builder's palette and its cards. */
export const FIELD_TYPE_INFO: Readonly<
	Record<FieldType, { label: () => string; hint: () => string; icon: LucideIcon }>
> = {
	short_text: { label: m.forms_type_short_text, hint: m.forms_type_short_text_hint, icon: TextCursorInputIcon },
	long_text: { label: m.forms_type_long_text, hint: m.forms_type_long_text_hint, icon: TextIcon },
	email: { label: m.forms_type_email, hint: m.forms_type_email_hint, icon: AtSignIcon },
	number: { label: m.forms_type_number, hint: m.forms_type_number_hint, icon: HashIcon },
	single_select: { label: m.forms_type_single_select, hint: m.forms_type_single_select_hint, icon: CircleDotIcon },
	multi_select: { label: m.forms_type_multi_select, hint: m.forms_type_multi_select_hint, icon: ListChecksIcon },
	rating: { label: m.forms_type_rating, hint: m.forms_type_rating_hint, icon: StarIcon },
	date: { label: m.forms_type_date, hint: m.forms_type_date_hint, icon: CalendarIcon },
	consent: { label: m.forms_type_consent, hint: m.forms_type_consent_hint, icon: SquareCheckIcon },
};

/** The public page's path. */
export const publicFormPath = (slug: string) => `/f/${slug}`;
