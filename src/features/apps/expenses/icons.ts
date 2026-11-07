import {
	BusIcon,
	CoffeeIcon,
	FilmIcon,
	GiftIcon,
	GraduationCapIcon,
	HeartPulseIcon,
	HouseIcon,
	type LucideIcon,
	PlaneIcon,
	ShoppingBagIcon,
	TagIcon,
	UtensilsIcon,
	ZapIcon,
} from "lucide-react";
import { m } from "@/paraglide/messages";
import type { CategoryIcon } from "./types";

/** Each category icon's component and name (decision 0192). */
export const CATEGORY_ICON_COMPONENTS: Record<CategoryIcon, LucideIcon> = {
	tag: TagIcon,
	utensils: UtensilsIcon,
	coffee: CoffeeIcon,
	bus: BusIcon,
	plane: PlaneIcon,
	house: HouseIcon,
	zap: ZapIcon,
	"shopping-bag": ShoppingBagIcon,
	"heart-pulse": HeartPulseIcon,
	"graduation-cap": GraduationCapIcon,
	film: FilmIcon,
	gift: GiftIcon,
};

export const CATEGORY_ICON_LABELS: Record<CategoryIcon, () => string> = {
	tag: m.expenses_icon_tag,
	utensils: m.expenses_icon_utensils,
	coffee: m.expenses_icon_coffee,
	bus: m.expenses_icon_bus,
	plane: m.expenses_icon_plane,
	house: m.expenses_icon_house,
	zap: m.expenses_icon_zap,
	"shopping-bag": m.expenses_icon_shopping,
	"heart-pulse": m.expenses_icon_health,
	"graduation-cap": m.expenses_icon_education,
	film: m.expenses_icon_film,
	gift: m.expenses_icon_gift,
};
