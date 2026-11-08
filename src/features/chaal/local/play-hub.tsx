import { useQuery } from "@tanstack/react-query";
import { CpuIcon, UsersIcon } from "lucide-react";
import { type ReactNode, useState } from "react";
import { MAIN_CONTENT } from "@/components/layout/skip-link";
import { Button } from "@/components/ui/button";
import { sessionQueryOptions } from "@/features/auth/queries";
import { m } from "@/paraglide/messages";
import { formatTimeControl } from "../chess/clock";
import { chaalStatusQueryOptions } from "../queries";
import { Choice } from "./choice";
import { GameHistory } from "./game-history";
import { type BoardLayout, LOCAL_LEVELS, LOCAL_TIME_CONTROLS, type LocalSetup } from "./types";
import { useStartLocalGame } from "./use-start";

/** A clock choice's value: "none", or "300+3". */
type ClockValue = "none" | `${number}+${number}`;

const clockOptions = () => [
	{ value: "none" as ClockValue, label: m.ch_local_no_clock() },
	...LOCAL_TIME_CONTROLS.map((control) => ({
		value: `${control.initial}+${control.increment}` as ClockValue,
		label: formatTimeControl(control),
	})),
];

const clockOf = (value: ClockValue) => {
	if (value === "none") return null;
	const [initial, increment] = value.split("+").map(Number);
	return { initial: initial ?? 0, increment: increment ?? 0 };
};

/**
 * /app/chaal/play (PLAN Task 76): the play hub, first version. Against the computer
 * (Stockfish at a level 1–8, a side, an optional clock) or over the board (two people at
 * this screen, a clock with increment, the board flipping or face to face), then the games
 * played here. Online play joins it with Task 77.
 */
export function ChaalPlayHub() {
	const { data: session } = useQuery(sessionQueryOptions());
	const { data: status } = useQuery(chaalStatusQueryOptions());
	const off = status?.features.local === false;
	return (
		<main {...MAIN_CONTENT} className="flex flex-1 flex-col outline-none" data-testid="chaal-play">
			<div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
				<header className="flex flex-col gap-2">
					<h1 className="ch-display text-ch-title">{m.ch_play_title()}</h1>
					<p className="max-w-prose text-ch-muted">{session ? m.ch_play_lead_account() : m.ch_play_lead_device()}</p>
				</header>
				{off ? (
					<p className="ch-rule py-4" data-testid="chaal-play-off">
						{m.ch_play_local_off()}
					</p>
				) : (
					<div className="grid gap-8 lg:grid-cols-2 lg:gap-10">
						<ComputerSetup />
						<BoardSetup />
					</div>
				)}
				<GameHistory signedIn={Boolean(session)} />
			</div>
		</main>
	);
}

/** One way to play: a ruled panel with its icon, name and line, the choices, and Start. */
function SetupPanel({
	icon,
	title,
	body,
	children,
	onStart,
	starting,
	testId,
}: {
	icon: ReactNode;
	title: string;
	body: string;
	children: ReactNode;
	onStart: () => void;
	starting: boolean;
	testId: string;
}) {
	return (
		<section className="ch-rule flex flex-col gap-5 pt-4" aria-labelledby={`${testId}-title`} data-testid={testId}>
			<div className="flex items-start gap-3">
				<span className="mt-1 text-ch-ink" aria-hidden>
					{icon}
				</span>
				<div className="flex flex-col gap-1">
					<h2 id={`${testId}-title`} className="ch-display text-ch-head">
						{title}
					</h2>
					<p className="text-ch-muted text-sm">{body}</p>
				</div>
			</div>
			{children}
			<Button
				type="button"
				onClick={onStart}
				disabled={starting}
				size="lg"
				className="ch-press self-start px-6"
				data-testid={`${testId}-start`}
			>
				{m.ch_play_start()}
			</Button>
		</section>
	);
}

function ComputerSetup() {
	const start = useStartLocalGame();
	const [level, setLevel] = useState("3");
	const [color, setColor] = useState<"white" | "random" | "black">("random");
	const [clock, setClock] = useState<ClockValue>("none");
	const [starting, setStarting] = useState(false);
	const onStart = async () => {
		setStarting(true);
		const setup: LocalSetup = { mode: "engine", level: Number(level), color, clock: clockOf(clock) };
		await start(setup).finally(() => setStarting(false));
	};
	return (
		<SetupPanel
			icon={<CpuIcon className="size-6" />}
			title={m.ch_local_vs_computer()}
			body={m.ch_play_computer_body()}
			onStart={() => void onStart()}
			starting={starting}
			testId="chaal-play-computer"
		>
			<Choice
				legend={m.ch_play_level()}
				name="level"
				value={level}
				onChange={setLevel}
				columns={4}
				options={LOCAL_LEVELS.map((value) => ({ value: String(value), label: String(value) }))}
				testId="chaal-play-level"
			/>
			<Choice
				legend={m.ch_play_side()}
				name="side"
				value={color}
				onChange={setColor}
				columns={3}
				options={[
					{ value: "white", label: m.ch_white() },
					{ value: "random", label: m.ch_play_side_random() },
					{ value: "black", label: m.ch_black() },
				]}
				testId="chaal-play-side"
			/>
			<Choice
				legend={m.ch_play_clock()}
				name="computer-clock"
				value={clock}
				onChange={setClock}
				columns={4}
				options={clockOptions()}
				testId="chaal-play-computer-clock"
			/>
		</SetupPanel>
	);
}

function BoardSetup() {
	const start = useStartLocalGame();
	const [clock, setClock] = useState<ClockValue>("600+5");
	const [layout, setLayout] = useState<BoardLayout>("flip");
	const [starting, setStarting] = useState(false);
	const onStart = async () => {
		setStarting(true);
		await start({ mode: "board", clock: clockOf(clock), layout }).finally(() => setStarting(false));
	};
	return (
		<SetupPanel
			icon={<UsersIcon className="size-6" />}
			title={m.ch_local_over_board()}
			body={m.ch_play_board_body()}
			onStart={() => void onStart()}
			starting={starting}
			testId="chaal-play-board"
		>
			<Choice
				legend={m.ch_play_clock()}
				name="board-clock"
				value={clock}
				onChange={setClock}
				columns={4}
				options={clockOptions()}
				testId="chaal-play-board-clock"
			/>
			<Choice
				legend={m.ch_play_layout()}
				name="layout"
				value={layout}
				onChange={setLayout}
				columns={2}
				options={[
					{ value: "flip", label: m.ch_play_layout_flip(), hint: m.ch_play_layout_flip_hint() },
					{ value: "tablet", label: m.ch_play_layout_tablet(), hint: m.ch_play_layout_tablet_hint() },
				]}
				testId="chaal-play-layout"
			/>
		</SetupPanel>
	);
}
