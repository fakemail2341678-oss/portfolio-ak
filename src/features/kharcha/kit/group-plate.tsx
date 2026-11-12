import {
	CarIcon,
	GiftIcon,
	HeartIcon,
	HouseIcon,
	type LucideIcon,
	PartyPopperIcon,
	PlaneIcon,
	UsersIcon,
	UtensilsIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { GroupIcon, KharchaColor } from "../types";

/** Each group icon's drawing (`GROUP_ICONS`, stored by name). */
export const GROUP_ICON_DRAWINGS: Record<GroupIcon, LucideIcon> = {
	users: UsersIcon,
	plane: PlaneIcon,
	house: HouseIcon,
	heart: HeartIcon,
	"party-popper": PartyPopperIcon,
	utensils: UtensilsIcon,
	car: CarIcon,
	gift: GiftIcon,
};

const SIZES = {
	sm: "size-6 rounded-sm [&>svg]:size-3.5",
	md: "size-8 rounded-md [&>svg]:size-4",
	lg: "size-10 rounded-md [&>svg]:size-5",
} as const;

/**
 * A group's square plate (Task 90): its icon in white on its colour, as `PersonAvatar` is a
 * person's. Decorative: the group's name is always written beside it.
 */
export function GroupPlate({
	icon,
	color,
	size = "md",
	className,
}: {
	icon: GroupIcon;
	color: KharchaColor;
	size?: keyof typeof SIZES;
	className?: string;
}) {
	const Icon = GROUP_ICON_DRAWINGS[icon];
	return (
		<span
			aria-hidden
			className={cn("inline-grid shrink-0 place-items-center text-white", SIZES[size], className)}
			style={{ backgroundColor: `var(--kh-c-${color})` }}
			data-color={color}
		>
			<Icon strokeWidth={2} />
		</span>
	);
}
