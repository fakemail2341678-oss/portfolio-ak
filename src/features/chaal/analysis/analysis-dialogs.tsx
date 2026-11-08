import { DownloadIcon } from "lucide-react";
import { type ChangeEvent, type FormEvent, useId, useState } from "react";
import { CopyButton } from "@/components/data-display/copy-button";
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
import { Textarea } from "@/components/ui/textarea";
import { m } from "@/paraglide/messages";
import { PGN_MAX_BYTES, type PgnRead, readPgn } from "../chess/pgn";
import type { ChaalImportedGame } from "../schema";
import { readImport } from "./import";
import type { LoadedGame } from "./use-analysis";

/** Why an import was refused, in words. */
function importError(
	read: PgnRead | ChaalImportedGame | { ok: false; reason: "bad-fen"; detail: "format" | "kings" | "check" },
): string {
	if (read.ok) return "";
	switch (read.reason) {
		case "empty":
			return m.ch_import_error_empty();
		case "too-large":
			return m.ch_import_error_too_large();
		case "too-long":
			return m.ch_import_error_too_long();
		case "variant":
			return m.ch_import_error_variant();
		case "fen":
			return m.ch_import_error_fen();
		case "move":
			return m.ch_import_error_move({ move: "move" in read ? (read.move ?? "?") : "?" });
		case "not-found":
			return m.ch_import_error_not_found();
		case "in-progress":
			return m.ch_import_error_in_progress();
		case "bad-fen":
			return read.detail === "kings"
				? m.ch_import_error_fen_kings()
				: read.detail === "check"
					? m.ch_import_error_fen_check()
					: m.ch_import_error_fen();
	}
}

/**
 * "Import" (PLAN Task 75): PGN (pasted or from a file), a FEN, or a Lichess game's address
 * or id (a finished game only: fair play). PGN and Lichess games open at their last move.
 */
export function ImportDialog({
	open,
	onOpenChange,
	onLoad,
	onPosition,
	fetchLichessGame,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onLoad: (game: LoadedGame) => void;
	onPosition: (fen: string) => void;
	fetchLichessGame: (id: string) => Promise<ChaalImportedGame>;
}) {
	const [text, setText] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [pending, setPending] = useState(false);
	const id = useId();

	const loadPgn = (pgn: string) => {
		const read = readPgn(pgn);
		if (!read.ok) {
			setError(importError(read));
			return false;
		}
		onLoad({ tree: read.game.tree, tags: read.game.tags, at: "end" });
		return true;
	};

	const submit = async (event: FormEvent) => {
		event.preventDefault();
		setError(null);
		const kind = readImport(text);
		if (kind.kind === "empty") {
			setError(m.ch_import_error_empty());
			return;
		}
		if (kind.kind === "bad-fen") {
			setError(importError({ ok: false, reason: "bad-fen", detail: kind.reason }));
			return;
		}
		if (kind.kind === "fen") {
			onPosition(kind.fen);
			finish();
			return;
		}
		if (kind.kind === "pgn") {
			if (loadPgn(kind.text)) finish();
			return;
		}
		setPending(true);
		try {
			const game = await fetchLichessGame(kind.id);
			if (!game.ok) setError(importError(game));
			else if (loadPgn(game.pgn)) finish();
		} catch (failure) {
			setError(errorMessage(failure));
		} finally {
			setPending(false);
		}
	};

	const finish = () => {
		setText("");
		onOpenChange(false);
	};

	const readFile = async (event: ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		event.target.value = "";
		if (!file) return;
		if (file.size > PGN_MAX_BYTES) {
			setError(m.ch_import_error_too_large());
			return;
		}
		setText(await file.text());
		setError(null);
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>{m.ch_import_title()}</DialogTitle>
					<DialogDescription>{m.ch_import_description()}</DialogDescription>
				</DialogHeader>
				<form method="post" onSubmit={submit} className="flex flex-col gap-3" data-testid="chaal-import-form">
					<label htmlFor={id} className="sr-only">
						{m.ch_import_label()}
					</label>
					<Textarea
						id={id}
						value={text}
						onChange={(event) => setText(event.target.value)}
						rows={8}
						spellCheck={false}
						className="font-mono text-xs"
						placeholder={m.ch_import_placeholder()}
						aria-invalid={error ? true : undefined}
						aria-describedby={error ? `${id}-error` : undefined}
						data-testid="chaal-import-text"
					/>
					{error ? (
						<p id={`${id}-error`} className="text-destructive text-sm" role="alert">
							{error}
						</p>
					) : null}
					<DialogFooter className="items-center gap-2 sm:justify-between">
						<label className="cursor-pointer text-sm underline underline-offset-4">
							{m.ch_import_file()}
							<input
								type="file"
								accept=".pgn,text/plain,application/x-chess-pgn"
								onChange={readFile}
								className="sr-only"
							/>
						</label>
						<Button type="submit" disabled={pending} data-testid="chaal-import-submit">
							{pending ? m.ch_import_loading() : m.ch_import_submit()}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

/** "Export" (PLAN Task 75): the PGN (copy or download), the FEN shown, and a link to this board. */
export function ExportDialog({
	open,
	onOpenChange,
	pgn,
	fen,
	link,
	fileName,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	pgn: string;
	fen: string;
	link: string;
	fileName: string;
}) {
	const pgnId = useId();
	const fenId = useId();
	const linkId = useId();
	const download = () => {
		const url = URL.createObjectURL(new Blob([pgn], { type: "application/x-chess-pgn" }));
		const anchor = document.createElement("a");
		anchor.href = url;
		anchor.download = fileName;
		anchor.click();
		URL.revokeObjectURL(url);
	};
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>{m.ch_export_title()}</DialogTitle>
					<DialogDescription>{m.ch_export_description()}</DialogDescription>
				</DialogHeader>
				<div className="flex flex-col gap-4" data-testid="chaal-export">
					<div className="flex flex-col gap-1.5">
						<div className="flex items-center justify-between gap-2">
							<label htmlFor={pgnId} className="font-medium text-sm">
								PGN
							</label>
							<div className="flex gap-1">
								<CopyButton value={pgn} label={m.ch_export_copy_pgn()} showLabel />
								<Button type="button" variant="outline" size="sm" onClick={download}>
									<DownloadIcon aria-hidden />
									{m.ch_export_download()}
								</Button>
							</div>
						</div>
						<Textarea
							id={pgnId}
							value={pgn}
							readOnly
							rows={8}
							className="font-mono text-xs"
							data-testid="chaal-export-pgn"
						/>
					</div>
					<div className="flex flex-col gap-1.5">
						<label htmlFor={fenId} className="font-medium text-sm">
							FEN
						</label>
						<div className="flex gap-1">
							<Input id={fenId} value={fen} readOnly className="font-mono text-xs" data-testid="chaal-export-fen" />
							<CopyButton value={fen} label={m.ch_export_copy_fen()} />
						</div>
					</div>
					<div className="flex flex-col gap-1.5">
						<label htmlFor={linkId} className="font-medium text-sm">
							{m.ch_export_link()}
						</label>
						<div className="flex gap-1">
							<Input id={linkId} value={link} readOnly className="text-xs" data-testid="chaal-export-link" />
							<CopyButton value={link} label={m.ch_export_copy_link()} />
						</div>
						<p className="text-ch-muted text-xs">{m.ch_export_link_hint()}</p>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}

/** "Save" the first time (PLAN Task 75): a title, then it's in "My analyses". */
export function SaveDialog({
	open,
	onOpenChange,
	defaultTitle,
	onSave,
	pending,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	defaultTitle: string;
	onSave: (title: string) => void;
	pending: boolean;
}) {
	const [title, setTitle] = useState(defaultTitle);
	const id = useId();
	return (
		<Dialog
			open={open}
			onOpenChange={(next) => {
				if (next) setTitle(defaultTitle);
				onOpenChange(next);
			}}
		>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>{m.ch_save_title()}</DialogTitle>
					<DialogDescription>{m.ch_save_description()}</DialogDescription>
				</DialogHeader>
				<form
					method="post"
					className="flex flex-col gap-3"
					onSubmit={(event) => {
						event.preventDefault();
						if (title.trim()) onSave(title.trim());
					}}
					data-testid="chaal-save-form"
				>
					<label htmlFor={id} className="font-medium text-sm">
						{m.ch_save_name()}
					</label>
					<Input
						id={id}
						value={title}
						onChange={(event) => setTitle(event.target.value)}
						maxLength={120}
						required
						data-testid="chaal-save-name"
					/>
					<DialogFooter>
						<Button type="submit" disabled={pending || !title.trim()} data-testid="chaal-save-submit">
							{m.ch_save_submit()}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
