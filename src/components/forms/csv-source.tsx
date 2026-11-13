import { AlertCircleIcon } from "lucide-react";
import { useId, useState } from "react";
import { errorMessage } from "@/components/errors/error-page";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CsvParseError, parseCsv } from "@/lib/csv";
import { formatNumber } from "@/lib/i18n/intl";
import { m } from "@/paraglide/messages";

/**
 * The first step of a CSV import (Taskline's and Kharcha's; Expenses' first, decision 0192): a file
 * (at most 1 MB) or pasted text, parsed into rows of cells. A file that can't be read
 * says why (too big, a quote never closed, on which line); a table it read is
 * reported to `onLoad` with its name, and a failure clears it (`onLoad(null)`).
 */

/** The largest file read: a thousand rows of CSV fit easily. */
const MAX_FILE_BYTES = 1024 * 1024;

export type CsvSource = { name: string; table: string[][] };

export function CsvSourcePicker({
	hint,
	placeholder,
	onLoad,
}: {
	/** Under the file input: what one line holds. */
	hint: string;
	/** An example for the paste box. */
	placeholder: string;
	onLoad: (source: CsvSource | null) => void;
}) {
	const fileId = useId();
	const pasteId = useId();
	const [text, setText] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [loaded, setLoaded] = useState<CsvSource | null>(null);

	const report = (source: CsvSource | null, problem: string | null) => {
		setLoaded(source);
		setError(problem);
		onLoad(source);
	};
	const load = (name: string, content: string) => {
		try {
			report({ name, table: parseCsv(content) }, null);
		} catch (problem) {
			report(
				null,
				problem instanceof CsvParseError
					? m.csv_error_parse({ line: formatNumber(problem.line) })
					: errorMessage(problem),
			);
		}
	};
	const readFile = async (file: File | undefined) => {
		if (!file) return;
		if (file.size > MAX_FILE_BYTES) report(null, m.csv_error_size());
		else load(file.name, await file.text());
	};

	return (
		<div className="flex flex-col gap-4">
			<div className="grid gap-4 md:grid-cols-2">
				<div className="flex flex-col gap-2">
					<Label htmlFor={fileId}>{m.csv_file()}</Label>
					<Input
						id={fileId}
						type="file"
						accept=".csv,text/csv"
						onChange={(event) => void readFile(event.target.files?.[0])}
						data-testid="import-file"
					/>
					<p className="text-caption text-muted-foreground">{hint}</p>
				</div>
				<div className="flex flex-col gap-2">
					<Label htmlFor={pasteId}>{m.csv_paste()}</Label>
					<Textarea
						id={pasteId}
						rows={3}
						value={text}
						onChange={(event) => setText(event.target.value)}
						placeholder={placeholder}
						className="font-mono text-caption"
						data-testid="import-paste"
					/>
					<Button
						variant="outline"
						size="sm"
						className="w-fit"
						disabled={text.trim() === ""}
						onClick={() => load(m.csv_pasted(), text)}
						data-testid="import-paste-read"
					>
						{m.csv_paste_read()}
					</Button>
				</div>
			</div>
			{error ? (
				<Alert variant="destructive" data-testid="import-error">
					<AlertCircleIcon aria-hidden />
					<AlertTitle>{m.csv_error_title()}</AlertTitle>
					<AlertDescription>{error}</AlertDescription>
				</Alert>
			) : null}
			{loaded ? (
				<p className="text-muted-foreground text-sm" data-testid="import-source">
					{m.csv_loaded({ name: loaded.name, rows: formatNumber(loaded.table.length) })}
				</p>
			) : null}
		</div>
	);
}

/** Column names for a mapping's selects: the header's, or "Column 3". */
export const csvColumnNames = (table: ReadonlyArray<ReadonlyArray<string>>, header: boolean): string[] => {
	const width = Math.max(0, ...table.map((row) => row.length));
	return Array.from({ length: width }, (_, index) => {
		const fallback = m.csv_column({ number: formatNumber(index + 1) });
		return header ? table[0]?.[index]?.trim() || fallback : fallback;
	});
};
