import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { GroupPlate } from "../kit/group-plate";
import { GROUP_ICONS, type GroupIcon, type KharchaColor } from "../types";
import { GROUP_ICON_LABELS } from "./labels";

const choice =
	"kh-ease grid cursor-pointer place-items-center rounded-md border border-transparent outline-none has-[:checked]:border-kh-ink has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50";

/** A group's icon (Task 90): native radios (arrow keys move between them), each plate named, in the colour picked. */
export function GroupIconPicker({
	name,
	value,
	color,
	onChange,
}: {
	name: string;
	value: GroupIcon;
	color: KharchaColor;
	onChange: (value: GroupIcon) => void;
}) {
	return (
		<fieldset className="flex flex-col gap-2">
			<legend className="mb-2 font-medium text-sm">{m.kharcha_field_icon()}</legend>
			<div className="flex flex-wrap gap-1.5">
				{GROUP_ICONS.map((icon) => (
					<label key={icon} className={cn(choice, "size-10")} title={GROUP_ICON_LABELS[icon]()}>
						<input
							type="radio"
							name={name}
							value={icon}
							checked={value === icon}
							onChange={() => onChange(icon)}
							className="sr-only"
						/>
						<GroupPlate icon={icon} color={color} />
						<span className="sr-only">{GROUP_ICON_LABELS[icon]()}</span>
					</label>
				))}
			</div>
		</fieldset>
	);
}
