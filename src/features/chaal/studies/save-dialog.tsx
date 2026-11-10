import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { ExternalLinkIcon } from "lucide-react";
import { type FormEvent, useId } from "react";
import { toast } from "sonner";
import { errorMessage } from "@/components/errors/error-page";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import { m } from "@/paraglide/messages";
import { LichessPrompt, useLichessFor } from "../community/header";
import { chaalLinks } from "../links";
import type { ChaalColor } from "../live/events";
import { myStudiesQueryOptions, studyCalls } from "./queries";
import { STUDY_CHAPTER_NAME_MAX } from "./schema";

/**
 * "Save to study" (PLAN Task 83, decision 0273): the analysis board's PGN as a new chapter of
 * one of the player's studies on Lichess, with their token (`study:write`). Lichess makes
 * studies on its own site only, so a player without one is sent there; it refuses a study
 * the player can't write to, and the dialog says so.
 */
export function SaveToStudyDialog({
	open,
	onOpenChange,
	pgn,
	orientation,
	defaultName,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	pgn: string;
	orientation: ChaalColor;
	defaultName: string;
}) {
	const field = useId();
	const navigate = useNavigate();
	const use = useLichessFor("studies");
	const studies = useQuery({ ...myStudiesQueryOptions(), enabled: open && use === "ok" });
	const save = useMutation({
		mutationFn: (input: { study: string; name: string }) => studyCalls.save({ ...input, pgn, orientation }),
		onSuccess: (saved) => {
			onOpenChange(false);
			toast.success(m.ch_study_saved(), {
				action: {
					label: m.ch_study_saved_open(),
					onClick: () => void navigate(chaalLinks.study(saved.study, saved.chapter ? { chapter: saved.chapter } : {})),
				},
			});
		},
		onError: (error) => toast.error(errorMessage(error)),
	});
	const submit = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const data = new FormData(event.currentTarget);
		const study = String(data.get("study") ?? "");
		const name = String(data.get("name") ?? "").trim();
		if (study && name) save.mutate({ study, name });
	};
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent data-testid="chaal-save-study-dialog">
				<DialogHeader>
					<DialogTitle>{m.ch_study_save_title()}</DialogTitle>
					<DialogDescription>{m.ch_study_save_description()}</DialogDescription>
				</DialogHeader>
				{use !== "ok" ? (
					<LichessPrompt use={use} text={m.ch_study_save_connect()} testId="chaal-save-study-connect" />
				) : !studies.data ? (
					studies.isError ? (
						<p className="text-ch-muted text-sm">{errorMessage(studies.error)}</p>
					) : (
						<Skeleton className="h-32 w-full rounded-none" />
					)
				) : studies.data.length === 0 ? (
					<div className="flex flex-col items-start gap-2 text-sm" data-testid="chaal-save-study-none">
						<p>{m.ch_study_save_none()}</p>
						<a
							href="https://lichess.org/study"
							rel="noopener"
							target="_blank"
							className="inline-flex items-center gap-1 underline"
						>
							<ExternalLinkIcon aria-hidden className="size-3.5" />
							{m.ch_study_save_create()}
						</a>
					</div>
				) : (
					<form method="post" onSubmit={submit} className="flex flex-col gap-4" data-testid="chaal-save-study-form">
						<div className="flex flex-col gap-1.5">
							<Label htmlFor={`${field}-study`}>{m.ch_study_save_study()}</Label>
							<NativeSelect id={`${field}-study`} name="study" required data-testid="chaal-save-study-pick">
								{studies.data.map((study) => (
									<option key={study.id} value={study.id}>
										{study.name}
									</option>
								))}
							</NativeSelect>
						</div>
						<div className="flex flex-col gap-1.5">
							<Label htmlFor={`${field}-name`}>{m.ch_study_save_name()}</Label>
							<Input
								id={`${field}-name`}
								name="name"
								required
								maxLength={STUDY_CHAPTER_NAME_MAX}
								defaultValue={defaultName.slice(0, STUDY_CHAPTER_NAME_MAX)}
								data-testid="chaal-save-study-name"
							/>
						</div>
						<DialogFooter>
							<Button type="submit" disabled={save.isPending} data-testid="chaal-save-study-submit">
								{m.ch_study_save()}
							</Button>
						</DialogFooter>
					</form>
				)}
			</DialogContent>
		</Dialog>
	);
}
