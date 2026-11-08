import type { HTMLAttributes, ReactNode } from "react";
import type { CHAAL_BOARD_THEMES } from "../look/board-themes";
import { FILES, RANKS } from "./fen";
import type { Orientation } from "./geometry";

/**
 * The diagram's plate (decision 0258): the heavy double frame with the coordinates set
 * outside it, in a board theme. `MiniBoard` and `Board` draw their squares inside; the
 * inner box is square (`aspect-ratio: 1`) and takes its width from the container, so a
 * board never shifts the layout.
 */
export function BoardPlate({
	theme = "diagram",
	orientation = "white",
	coordinates = true,
	innerClassName,
	className,
	children,
	...rest
}: {
	theme?: (typeof CHAAL_BOARD_THEMES)[number];
	orientation?: Orientation;
	coordinates?: boolean;
	innerClassName?: string;
	className?: string;
	children: ReactNode;
} & Omit<HTMLAttributes<HTMLDivElement>, "children" | "className">) {
	const files = orientation === "white" ? FILES : [...FILES].reverse();
	const ranks = orientation === "white" ? RANKS : [...RANKS].reverse();
	return (
		<div
			{...rest}
			data-ch-board={theme === "diagram" ? undefined : theme}
			className={`grid ${coordinates ? "grid-cols-[0.875rem_1fr] grid-rows-[1fr_0.875rem] gap-x-2.5 gap-y-1.5" : ""} ${className ?? ""}`}
		>
			{coordinates ? (
				<div aria-hidden className="grid grid-rows-8 py-[10px] text-ch-muted text-xs leading-none">
					{ranks.map((rank) => (
						<span key={rank} className="flex items-center justify-center ch-figures">
							{rank}
						</span>
					))}
				</div>
			) : null}
			<div className="p-[5px]">
				<div className={`ch-frame aspect-square ${innerClassName ?? ""}`}>{children}</div>
			</div>
			{coordinates ? (
				<>
					<span aria-hidden />
					<div aria-hidden className="grid grid-cols-8 px-[10px] text-ch-muted text-xs leading-none">
						{files.map((file) => (
							<span key={file} className="text-center">
								{file}
							</span>
						))}
					</div>
				</>
			) : null}
		</div>
	);
}
