import { ArrowUpIcon, ChevronsUpIcon, MessageSquareTextIcon, Trash2Icon } from "lucide-react";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { m } from "@/paraglide/messages";
import { nagSymbol, showSan } from "../../chess/lib/notation";
import { type GameTree, isMainline, type TreeNode } from "../../chess/lib/tree";
import { ANALYSIS_COMMENT_MAX } from "../schema";

/** The move symbols, one per move (NAGs 1–6). */
const MOVE_NAGS = [1, 2, 3, 4, 5, 6] as const;
/** The position symbols, one per move (NAGs 10–19, those Chaal shows). */
const POSITION_NAGS = [10, 13, 14, 15, 16, 17, 18, 19] as const;

const NAG_NAMES: Readonly<Record<number, () => string>> = {
	1: m.chaal_nag_good,
	2: m.chaal_nag_mistake,
	3: m.chaal_nag_brilliant,
	4: m.chaal_nag_blunder,
	5: m.chaal_nag_interesting,
	6: m.chaal_nag_dubious,
	10: m.chaal_nag_equal,
	13: m.chaal_nag_unclear,
	14: m.chaal_nag_white_slightly,
	15: m.chaal_nag_black_slightly,
	16: m.chaal_nag_white_better,
	17: m.chaal_nag_black_better,
	18: m.chaal_nag_white_winning,
	19: m.chaal_nag_black_winning,
};

/**
 * Editing the move shown (PLAN Task 75, "Tree editing"): the annotator's move symbols as
 * toggles, the position symbols in a menu, a comment, promoting its line (one step, or to
 * the main line) and deleting it with what follows. Arrows and circles are drawn on the
 * board itself (right-drag, right-click).
 */
export function NodeTools({
	tree,
	node,
	notation,
	onToggleNag,
	onComment,
	onPromote,
	onMakeMain,
	onDelete,
}: {
	tree: GameTree;
	node: TreeNode;
	notation: "figurine" | "letters";
	onToggleNag: (nag: number) => void;
	onComment: (text: string) => void;
	onPromote: () => void;
	onMakeMain: () => void;
	onDelete: () => void;
}) {
	const [editing, setEditing] = useState(false);
	const [draft, setDraft] = useState("");
	const id = useId();
	if (!node.parent || !node.san) return null;
	const main = isMainline(tree, node.id);
	const comment = node.comments.join(" ");
	const startEditing = () => {
		setDraft(comment);
		setEditing(true);
	};
	return (
		<section
			aria-label={m.chaal_tools_label({ move: showSan(node.san, notation) })}
			className="flex flex-col gap-2"
			data-testid="chaal-node-tools"
		>
			<div className="flex flex-wrap items-center gap-1">
				<fieldset className="flex items-center" aria-label={m.chaal_tools_move_symbols()}>
					{MOVE_NAGS.map((nag) => (
						<Button
							key={nag}
							type="button"
							variant="ghost"
							size="sm"
							aria-pressed={node.nags.includes(nag)}
							title={NAG_NAMES[nag]?.()}
							onClick={() => onToggleNag(nag)}
							className="ch-press min-w-8 px-1.5 font-semibold aria-pressed:bg-ch-ink aria-pressed:text-ch-on-ink"
							data-testid={`chaal-nag-${nag}`}
						>
							<span aria-hidden>{nagSymbol(nag)}</span>
							<span className="sr-only">{NAG_NAMES[nag]?.()}</span>
						</Button>
					))}
				</fieldset>
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button type="button" variant="ghost" size="sm" className="ch-press">
							{m.chaal_tools_position()}
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="start">
						{POSITION_NAGS.map((nag) => (
							<DropdownMenuCheckboxItem
								key={nag}
								checked={node.nags.includes(nag)}
								onCheckedChange={() => onToggleNag(nag)}
							>
								<span className="w-6 font-semibold">{nagSymbol(nag)}</span>
								{NAG_NAMES[nag]?.()}
							</DropdownMenuCheckboxItem>
						))}
					</DropdownMenuContent>
				</DropdownMenu>
			</div>
			<div className="flex flex-wrap items-center gap-1">
				<Button
					type="button"
					variant="ghost"
					size="sm"
					onClick={startEditing}
					className="ch-press"
					data-testid="chaal-comment"
				>
					<MessageSquareTextIcon aria-hidden />
					{comment ? m.chaal_tools_edit_comment() : m.chaal_tools_add_comment()}
				</Button>
				{main ? null : (
					<>
						<Button
							type="button"
							variant="ghost"
							size="sm"
							onClick={onPromote}
							className="ch-press"
							data-testid="chaal-promote"
						>
							<ArrowUpIcon aria-hidden />
							{m.chaal_tools_promote()}
						</Button>
						<Button type="button" variant="ghost" size="sm" onClick={onMakeMain} className="ch-press">
							<ChevronsUpIcon aria-hidden />
							{m.chaal_tools_main_line()}
						</Button>
					</>
				)}
				<Button
					type="button"
					variant="ghost"
					size="sm"
					onClick={onDelete}
					className="ch-press ms-auto"
					data-testid="chaal-delete-move"
				>
					<Trash2Icon aria-hidden />
					{m.chaal_tools_delete()}
				</Button>
			</div>
			{editing ? (
				<form
					method="post"
					className="flex flex-col gap-2"
					onSubmit={(event) => {
						event.preventDefault();
						onComment(draft);
						setEditing(false);
					}}
				>
					<label htmlFor={id} className="sr-only">
						{m.chaal_tools_comment_label({ move: showSan(node.san, notation) })}
					</label>
					<Textarea
						id={id}
						value={draft}
						onChange={(event) => setDraft(event.target.value)}
						maxLength={ANALYSIS_COMMENT_MAX}
						rows={3}
						autoFocus
						data-testid="chaal-comment-text"
					/>
					<div className="flex gap-2">
						<Button type="submit" size="sm">
							{m.chaal_tools_save_comment()}
						</Button>
						<Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>
							{m.common_cancel()}
						</Button>
					</div>
				</form>
			) : null}
		</section>
	);
}
