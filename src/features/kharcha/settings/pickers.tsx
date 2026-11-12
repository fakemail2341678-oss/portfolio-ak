import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { CategoryIcon } from "../kit/category-icon";
import { CATEGORY_ICONS, type CategoryIconName, KHARCHA_COLORS, type KharchaColor } from "../types";

/** Each colour's name, for the swatches' labels. */
export const COLOR_LABELS: Record<KharchaColor, () => string> = {
	gray: () => m.kharcha_color_gray(),
	red: () => m.kharcha_color_red(),
	orange: () => m.kharcha_color_orange(),
	amber: () => m.kharcha_color_amber(),
	green: () => m.kharcha_color_green(),
	teal: () => m.kharcha_color_teal(),
	blue: () => m.kharcha_color_blue(),
	indigo: () => m.kharcha_color_indigo(),
	violet: () => m.kharcha_color_violet(),
	pink: () => m.kharcha_color_pink(),
};

/** Each category icon's name, for the picker's labels. */
export const ICON_LABELS: Record<CategoryIconName, () => string> = {
	utensils: () => m.kharcha_icon_utensils(),
	coffee: () => m.kharcha_icon_coffee(),
	"shopping-basket": () => m.kharcha_icon_basket(),
	"shopping-bag": () => m.kharcha_icon_bag(),
	bus: () => m.kharcha_icon_bus(),
	car: () => m.kharcha_icon_car(),
	fuel: () => m.kharcha_icon_fuel(),
	plane: () => m.kharcha_icon_plane(),
	house: () => m.kharcha_icon_house(),
	zap: () => m.kharcha_icon_zap(),
	wifi: () => m.kharcha_icon_wifi(),
	smartphone: () => m.kharcha_icon_phone(),
	film: () => m.kharcha_icon_film(),
	"heart-pulse": () => m.kharcha_icon_health(),
	shirt: () => m.kharcha_icon_shirt(),
	gift: () => m.kharcha_icon_gift(),
	"graduation-cap": () => m.kharcha_icon_school(),
	receipt: () => m.kharcha_icon_receipt(),
};

const choice =
	"kh-ease grid cursor-pointer place-items-center rounded-md border border-transparent outline-none has-[:checked]:border-kh-ink has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50";

/** A category's colour: native radios (arrow keys move between them), each swatch named. */
export function ColorPicker({
	name,
	value,
	onChange,
}: {
	name: string;
	value: KharchaColor;
	onChange: (value: KharchaColor) => void;
}) {
	return (
		<fieldset className="flex flex-col gap-2">
			<legend className="mb-2 font-medium text-sm">{m.kharcha_field_color()}</legend>
			<div className="flex flex-wrap gap-1.5">
				{KHARCHA_COLORS.map((color) => (
					<label key={color} className={cn(choice, "size-9")} title={COLOR_LABELS[color]()}>
						<input
							type="radio"
							name={name}
							value={color}
							checked={value === color}
							onChange={() => onChange(color)}
							className="sr-only"
						/>
						<span className="size-6 rounded-full" style={{ backgroundColor: `var(--kh-c-${color})` }} aria-hidden />
						<span className="sr-only">{COLOR_LABELS[color]()}</span>
					</label>
				))}
			</div>
		</fieldset>
	);
}

/** A category's icon, drawn in the colour picked. */
export function IconPicker({
	name,
	value,
	color,
	onChange,
}: {
	name: string;
	value: CategoryIconName;
	color: KharchaColor;
	onChange: (value: CategoryIconName) => void;
}) {
	return (
		<fieldset className="flex flex-col gap-2">
			<legend className="mb-2 font-medium text-sm">{m.kharcha_field_icon()}</legend>
			<div className="flex flex-wrap gap-1.5">
				{CATEGORY_ICONS.map((icon) => (
					<label key={icon} className={cn(choice, "size-10")} title={ICON_LABELS[icon]()}>
						<input
							type="radio"
							name={name}
							value={icon}
							checked={value === icon}
							onChange={() => onChange(icon)}
							className="sr-only"
						/>
						<CategoryIcon icon={icon} color={color} />
						<span className="sr-only">{ICON_LABELS[icon]()}</span>
					</label>
				))}
			</div>
		</fieldset>
	);
}
