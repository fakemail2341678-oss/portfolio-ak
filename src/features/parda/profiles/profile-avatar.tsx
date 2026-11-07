import {
	CloudIcon,
	FlameIcon,
	LeafIcon,
	type LucideIcon,
	MoonIcon,
	StarIcon,
	SunIcon,
	WavesIcon,
	ZapIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { type ProfileAvatar as AvatarId, isProfileAvatar } from "./options";

/** Each picture's drawing: an icon on the mask, in the action colour (decision 0240). */
export const AVATAR_ICONS: Readonly<Record<AvatarId, LucideIcon>> = {
	sun: SunIcon,
	moon: MoonIcon,
	star: StarIcon,
	leaf: LeafIcon,
	wave: WavesIcon,
	flame: FlameIcon,
	cloud: CloudIcon,
	bolt: ZapIcon,
};

const SIZES = {
	sm: "size-8 text-sm [&_svg]:size-4",
	md: "size-12 text-lg [&_svg]:size-6",
	lg: "size-24 text-3xl [&_svg]:size-12",
};

/** A profile's picture: its icon, or the name's first letter on the same tile when it chose none. */
export function ProfileAvatar({
	avatar,
	name,
	size = "md",
	className,
}: {
	avatar: string | null;
	name: string;
	size?: keyof typeof SIZES;
	className?: string;
}) {
	const Icon = isProfileAvatar(avatar) ? AVATAR_ICONS[avatar] : null;
	return (
		<span
			aria-hidden
			className={cn(
				"inline-flex shrink-0 items-center justify-center bg-pd-ground-2 font-semibold text-pd-ink",
				SIZES[size],
				className,
			)}
		>
			{Icon ? <Icon /> : (name.trim()[0] ?? "?").toLocaleUpperCase()}
		</span>
	);
}
