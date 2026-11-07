import { useId } from "react";
import { type IsoDate, isoDateInstant } from "@/lib/i18n/date-only";
import { formatDate, formatMonthShort, formatNumber } from "@/lib/i18n/intl";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { type AppColor, appColor } from "../../colors";
import { weekdayName } from "../format";
import { HEATMAP_WEEKS, type HeatLevel, heatmapCells, monthStarts } from "../heatmap";

const CELL = 10;
const STEP = 13;
const LEFT = 30;
const TOP = 16;
const WIDTH = LEFT + HEATMAP_WEEKS * STEP;
const HEIGHT = TOP + 7 * STEP;

/** How strongly each level shows the habit's colour (level 0 is the empty cell). */
const OPACITY: Record<Exclude<HeatLevel, 0>, number> = { 1: 0.3, 2: 0.5, 3: 0.75, 4: 1 };

/**
 * A year of check-ins, GitHub-style (decision 0193): 53 weeks across, Sunday to
 * Saturday down, each day filled by how much of the target was done. Plain SVG,
 * rendered on the server; screen readers get the summary in its title (each cell's
 * title is a hover tip). Days the habit isn't meant for are outlined only.
 */
export function HabitHeatmap({
	today,
	checkins,
	days,
	target,
	color,
	name,
}: {
	today: IsoDate;
	checkins: ReadonlyArray<{ day: IsoDate; count: number }>;
	days: number;
	target: number;
	color: AppColor;
	name: string;
}) {
	const titleId = useId();
	const counts = new Map(checkins.map((each) => [each.day, each.count]));
	const cells = heatmapCells(today, counts, { days, target });
	const done = cells.filter((cell) => cell.level === 4).length;
	const fill = appColor(color);
	return (
		<figure className="flex flex-col gap-2" data-testid="habit-heatmap">
			<svg
				viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
				className="h-auto w-full"
				role="img"
				aria-labelledby={titleId}
				data-cells={cells.length}
			>
				<title id={titleId}>{m.habits_heatmap_label({ name, done: formatNumber(done) })}</title>
				{monthStarts(cells).map(({ week, month }) => (
					<text key={month} x={LEFT + week * STEP} y={10} className="fill-muted-foreground text-[9px]">
						{formatMonthShort(month)}
					</text>
				))}
				{[1, 3, 5].map((weekday) => (
					<text
						key={weekday}
						x={LEFT - 6}
						y={TOP + weekday * STEP + CELL - 1}
						textAnchor="end"
						className="fill-muted-foreground text-[9px]"
					>
						{weekdayName(weekday)}
					</text>
				))}
				{cells.map((cell) => (
					<rect
						key={cell.day}
						x={LEFT + cell.week * STEP}
						y={TOP + cell.weekday * STEP}
						width={CELL}
						height={CELL}
						rx={2}
						className={cn(
							cell.level === 0 && (cell.scheduled ? "fill-surface-2" : "fill-transparent stroke-border"),
							cell.day === today && "stroke-foreground",
						)}
						style={cell.level === 0 ? undefined : { fill, fillOpacity: OPACITY[cell.level] }}
						strokeWidth={cell.day === today || (cell.level === 0 && !cell.scheduled) ? 1 : 0}
					>
						<title>
							{m.habits_heatmap_cell({
								date: formatDate(isoDateInstant(cell.day), { dateStyle: "medium" }),
								count: formatNumber(cell.count),
								target: formatNumber(target),
							})}
						</title>
					</rect>
				))}
			</svg>
			<figcaption className="flex items-center justify-end gap-1.5 text-caption text-muted-foreground">
				<span>{m.habits_heatmap_less()}</span>
				<span aria-hidden className="size-2.5 rounded-xs bg-surface-2" />
				{([1, 2, 3, 4] as const).map((level) => (
					<span
						key={level}
						aria-hidden
						className="size-2.5 rounded-xs"
						style={{ backgroundColor: fill, opacity: OPACITY[level] }}
					/>
				))}
				<span>{m.habits_heatmap_more()}</span>
			</figcaption>
		</figure>
	);
}
