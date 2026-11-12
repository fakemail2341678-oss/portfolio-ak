import { m } from "@/paraglide/messages";
import type { SplitMethod } from "../money/split";
import type { GroupIcon, GroupKind } from "../types";

/** A group's kind in words (the new-group dialog, its header and settings). Call at render time. */
export const GROUP_KIND_LABELS: Record<GroupKind, () => string> = {
	trip: () => m.kharcha_group_kind_trip(),
	home: () => m.kharcha_group_kind_home(),
	couple: () => m.kharcha_group_kind_couple(),
	event: () => m.kharcha_group_kind_event(),
	other: () => m.kharcha_group_kind_other(),
};

/** Each group icon's name, for its radio in the pickers. */
export const GROUP_ICON_LABELS: Record<GroupIcon, () => string> = {
	users: () => m.kharcha_group_icon_users(),
	plane: () => m.kharcha_group_icon_plane(),
	house: () => m.kharcha_group_icon_house(),
	heart: () => m.kharcha_group_icon_heart(),
	"party-popper": () => m.kharcha_group_icon_party(),
	utensils: () => m.kharcha_group_icon_food(),
	car: () => m.kharcha_group_icon_car(),
	gift: () => m.kharcha_group_icon_gift(),
};

/** How a split is entered, in words (the split editor's tabs, a group's default split). */
export const SPLIT_METHOD_LABELS: Record<SplitMethod, () => string> = {
	equal: () => m.kharcha_split_method_equal(),
	exact: () => m.kharcha_split_method_exact(),
	percent: () => m.kharcha_split_method_percent(),
	shares: () => m.kharcha_split_method_shares(),
	adjustment: () => m.kharcha_split_method_adjustment(),
	itemized: () => m.kharcha_split_method_itemized(),
	full: () => m.kharcha_split_method_full(),
};
