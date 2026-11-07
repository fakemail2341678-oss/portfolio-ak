import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { PlayIcon, SquareIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { errorMessage } from "@/components/errors/error-page";
import { Button } from "@/components/ui/button";
import { m } from "@/paraglide/messages";
import { tasklineLinks } from "../links";
import { tasklineKeys, tasklineMutations, tasklineNavQueryOptions } from "../queries";
import type { RunningTimer, TasklineNav } from "../types";
import { elapsedClock, formatDuration } from "./duration";

/**
 * The timer (Task 53, decision 0218): one runs per person, started from a task and
 * stopped from it or from the topbar's pill. The server stamps the start; the page
 * only counts from it, so a reload (or another tab) shows the same time.
 */

/**
 * Now, ticking every second after hydration. It starts at `from` (when the server
 * read the timer), so the server's render and the browser's first one agree.
 */
function useSecondClock(from: number): number {
	const [now, setNow] = useState(from);
	useEffect(() => {
		setNow(Date.now());
		const id = window.setInterval(() => setNow(Date.now()), 1000);
		return () => window.clearInterval(id);
	}, []);
	return now;
}

/** Stops the caller's timer; says what it logged (or that it ran under a minute and was dropped). */
function useStopTimer(userId: string) {
	const queryClient = useQueryClient();
	// On the mutation, not on `mutate()`: the refresh after it unmounts the pill, and a
	// `mutate()` callback doesn't run once its component is gone.
	const stop = useMutation({
		...tasklineMutations.stopTimer(queryClient, userId),
		onSuccess: (result) => {
			queryClient.setQueryData<TasklineNav>(tasklineKeys.nav(userId), (nav) => (nav ? { ...nav, timer: null } : nav));
			toast.success(
				result ? m.taskline_timer_stopped({ duration: formatDuration(result.minutes) }) : m.taskline_timer_discarded(),
			);
		},
		onError: (error) => toast.error(errorMessage(error)),
	});
	return { pending: stop.isPending, stop: () => stop.mutate(undefined) };
}

/** The topbar's pill while a timer runs: the task, the time so far, and Stop. */
export function TimerPill({ timer, readAt, userId }: { timer: RunningTimer; readAt: string; userId: string }) {
	const now = useSecondClock(Date.parse(readAt) || Date.parse(timer.startedAt));
	const { stop, pending } = useStopTimer(userId);
	const label = timer.ref ?? timer.projectKey;
	return (
		<div
			className="flex h-8 max-w-56 items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 ps-2.5 pe-0.5"
			data-testid="timer-pill"
		>
			<span className="size-2 shrink-0 animate-pulse rounded-full bg-primary motion-reduce:animate-none" aria-hidden />
			{timer.ref ? (
				<Link
					{...tasklineLinks.task(timer.ws, timer.ref)}
					className="min-w-0 truncate font-mono text-caption hover:underline"
					title={timer.title}
				>
					{label}
				</Link>
			) : (
				<span className="min-w-0 truncate font-mono text-caption">{label}</span>
			)}
			<span role="timer" className="text-caption tabular-nums" data-testid="timer-elapsed">
				{elapsedClock(timer.startedAt, now)}
			</span>
			<Button
				variant="ghost"
				size="icon"
				className="size-7 rounded-full"
				disabled={pending}
				onClick={stop}
				data-testid="timer-pill-stop"
			>
				<SquareIcon className="fill-current" aria-hidden />
				<span className="sr-only">{m.taskline_timer_stop_on({ task: label })}</span>
			</Button>
		</div>
	);
}

/** Start or Stop on a task: Stop while the caller's timer runs on this task, else Start (which stops any other). */
export function TimerButton({ ws, taskRef, userId }: { ws: string; taskRef: string; userId: string }) {
	const queryClient = useQueryClient();
	const { data: nav } = useQuery({ ...tasklineNavQueryOptions(userId), enabled: userId !== "" });
	const start = useMutation(tasklineMutations.startTimer(queryClient, userId));
	const { stop, pending } = useStopTimer(userId);
	const running = nav?.timer && nav.timer.ws === ws && nav.timer.ref === taskRef;
	if (running) {
		return (
			<Button variant="outline" size="sm" disabled={pending} onClick={stop} data-testid="task-timer-stop">
				<SquareIcon className="fill-current text-primary" aria-hidden />
				{m.taskline_timer_stop()}
			</Button>
		);
	}
	return (
		<Button
			variant="outline"
			size="sm"
			disabled={start.isPending}
			onClick={() =>
				start.mutate(
					{ ws, ref: taskRef },
					{
						onSuccess: (timer) => {
							queryClient.setQueryData<TasklineNav>(tasklineKeys.nav(userId), (current) =>
								current ? { ...current, timer, readAt: new Date().toISOString() } : current,
							);
							toast.success(m.taskline_timer_started({ task: taskRef }));
						},
						onError: (error) => toast.error(errorMessage(error)),
					},
				)
			}
			data-testid="task-timer-start"
		>
			<PlayIcon aria-hidden />
			{m.taskline_timer_start()}
		</Button>
	);
}
