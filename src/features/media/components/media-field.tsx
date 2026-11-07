import { ImagesIcon, Trash2Icon } from "lucide-react";
import { lazy, Suspense, useState } from "react";
import { useFieldContext } from "@/components/forms/contexts";
import { FieldLabelText, FieldMessages, useFieldA11y } from "@/components/forms/field-shell";
import { moveItem, SortableList } from "@/components/forms/fields/sortable-list";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ImageAsset } from "@/features/attachments/schema";
import { useCan } from "@/features/rbac/can";
import { formatNumber } from "@/lib/i18n/intl";
import { localizedValue } from "@/lib/i18n/localized";
import { m } from "@/paraglide/messages";
import type { MediaKind } from "../constants";
import { MediaThumb } from "./media-tile";

// The picker opens on click: its queries and grid load then, not with every form (0168).
const MediaPicker = lazy(() => import("./media-picker").then((module) => ({ default: module.MediaPicker })));

/** One picked library item in a form's value. */
export type PickedMedia = { id: string; preview: ImageAsset };

/**
 * Media-library items for a form (decision 0177): "Choose from the library"
 * opens a picker that also uploads into the library. The value is
 * PickedMedia[] (one for a single image: `max={1}`); the form sends the ids.
 * Alt text belongs to the library item (edited at /admin/media), so it is shown
 * here, not edited. Several items reorder by drag or Alt + ↑/↓.
 *
 * Render it inside `form.AppField` (not registered on useAppForm, 0168).
 */
export function MediaField({
	label,
	description,
	max,
	kind = "image",
}: {
	label: string;
	description?: string;
	max: number;
	/** What the picker offers: images (default) or documents (a résumé PDF). */
	kind?: Exclude<MediaKind, "all">;
}) {
	const field = useFieldContext<PickedMedia[]>();
	const a11y = useFieldA11y(label, { focusId: (id) => `${id}-choose` });
	const canBrowse = useCan("media:read");
	const [picking, setPicking] = useState(false);
	const items = field.state.value ?? [];
	const room = max - items.length;

	const set = (next: PickedMedia[]) => {
		field.handleChange(next);
		field.handleBlur();
	};
	const itemLabel = (index: number) => m.media_field_item({ n: formatNumber(index + 1) });

	const tile = (item: PickedMedia, index: number, handle?: React.ReactNode) => {
		const alt = localizedValue(item.preview.alt);
		return (
			<div className="flex items-center gap-3 rounded-md border bg-card p-2">
				{handle}
				<MediaThumb image={item.preview} className="size-14 shrink-0" />
				<div className="flex min-w-0 flex-1 flex-col gap-1">
					{alt ? (
						<span className="truncate text-sm">{alt}</span>
					) : (
						<Badge variant="outline" className="self-start border-warning/40 text-warning">
							{m.media_no_alt()}
						</Badge>
					)}
					{max > 1 && index === 0 ? (
						<Badge variant="secondary" className="self-start">
							{m.attachments_field_cover()}
						</Badge>
					) : null}
				</div>
				<Button
					type="button"
					variant="ghost"
					size="icon"
					aria-label={m.media_field_remove({ item: itemLabel(index) })}
					onClick={() => set(items.filter((_, position) => position !== index))}
				>
					<Trash2Icon aria-hidden />
				</Button>
			</div>
		);
	};

	return (
		<fieldset
			className="flex min-w-0 flex-col gap-3"
			aria-describedby={a11y.describedBy(Boolean(description))}
			aria-invalid={a11y.invalid || undefined}
		>
			<legend className="mb-1 font-medium text-sm">
				<FieldLabelText label={label} optional />
			</legend>
			{items.length === 0 ? <p className="text-muted-foreground text-sm">{m.media_field_empty()}</p> : null}
			{max > 1 && items.length > 0 ? (
				<SortableList
					items={items}
					getId={(item) => item.id}
					getLabel={(_, index) => itemLabel(index)}
					onMove={(from, to) => set(moveItem(items, from, to))}
					renderItem={(item, index, handle) => tile(item, index, handle)}
				/>
			) : (
				items.map((item, index) => <div key={item.id}>{tile(item, index)}</div>)
			)}
			{canBrowse ? (
				<Button
					id={`${a11y.id}-choose`}
					type="button"
					variant="outline"
					className="self-start"
					disabled={room <= 0}
					onClick={() => setPicking(true)}
				>
					<ImagesIcon aria-hidden />
					{max === 1 && items.length === 1 ? m.media_field_replace() : m.media_field_choose()}
				</Button>
			) : null}
			<FieldMessages
				descriptionId={a11y.descriptionId}
				description={description}
				errorId={a11y.errorId}
				errors={a11y.errors}
			/>
			{picking ? (
				<Suspense fallback={null}>
					<MediaPicker
						kind={kind}
						// A single image is replaced; a list gets what still fits.
						room={max === 1 ? 1 : room}
						exclude={items.map((item) => item.id)}
						onClose={() => setPicking(false)}
						onPick={(picked) => {
							set(max === 1 ? picked.slice(0, 1) : [...items, ...picked].slice(0, max));
							setPicking(false);
						}}
					/>
				</Suspense>
			) : null}
		</fieldset>
	);
}
