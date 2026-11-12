import {
	BusIcon,
	CarIcon,
	CoffeeIcon,
	FilmIcon,
	FuelIcon,
	GiftIcon,
	GraduationCapIcon,
	HeartPulseIcon,
	HouseIcon,
	type LucideIcon,
	PlaneIcon,
	ReceiptIcon,
	ShirtIcon,
	ShoppingBagIcon,
	ShoppingBasketIcon,
	SmartphoneIcon,
	UtensilsIcon,
	WifiIcon,
	ZapIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { CategoryIconName, KharchaColor } from "../types";

const ICONS: Record<CategoryIconName, LucideIcon> = {
	utensils: UtensilsIcon,
	coffee: CoffeeIcon,
	"shopping-basket": ShoppingBasketIcon,
	"shopping-bag": ShoppingBagIcon,
	bus: BusIcon,
	car: CarIcon,
	fuel: FuelIcon,
	plane: PlaneIcon,
	house: HouseIcon,
	zap: ZapIcon,
	wifi: WifiIcon,
	smartphone: SmartphoneIcon,
	film: FilmIcon,
	"heart-pulse": HeartPulseIcon,
	shirt: ShirtIcon,
	gift: GiftIcon,
	"graduation-cap": GraduationCapIcon,
	receipt: ReceiptIcon,
};

const SIZES = { sm: "size-6 [&>svg]:size-3.5", md: "size-8 [&>svg]:size-4" } as const;

/**
 * A category's icon in its tile, drawn in the category's colour when it has one. An
 * expense without a category gets the plain receipt (and a fix badge says so).
 * Decorative: the category's name is written beside it or in its tooltip.
 */
export function CategoryIcon({
	icon,
	color,
	size = "md",
	className,
}: {
	icon?: CategoryIconName | null;
	color?: KharchaColor;
	size?: keyof typeof SIZES;
	className?: string;
}) {
	const Icon = (icon && ICONS[icon]) || ReceiptIcon;
	return (
		<span
			aria-hidden
			className={cn(
				"inline-grid shrink-0 place-items-center rounded-md border border-kh-hair bg-kh-ground text-kh-muted",
				SIZES[size],
				className,
			)}
			style={color ? { color: `var(--kh-c-${color})` } : undefined}
		>
			<Icon strokeWidth={1.75} />
		</span>
	);
}
