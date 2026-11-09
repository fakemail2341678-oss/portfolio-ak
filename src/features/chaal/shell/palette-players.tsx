import { useQuery } from "@tanstack/react-query";
import { UserIcon } from "lucide-react";
import { CommandGroup, CommandItem } from "@/components/ui/command";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { m } from "@/paraglide/messages";
import { playerSearchQueryOptions } from "../players/queries";

const NAME = /^[A-Za-z0-9][A-Za-z0-9_-]{1,29}$/;

/**
 * The palette's players (Task 81, decision 0271): Lichess's names that start with what's
 * typed (three letters or more, after a pause), each opening the player's page. Loaded with
 * the first search, so the frame doesn't carry the players' functions.
 */
export default function PalettePlayers({ term, onPick }: { term: string; onPick: (username: string) => void }) {
	const typed = term.trim();
	const settled = useDebouncedValue(typed, 250);
	const searchable = NAME.test(settled) && settled.length >= 3;
	const { data } = useQuery({ ...playerSearchQueryOptions(settled), enabled: searchable });
	if (!NAME.test(typed)) return null;
	const found = (searchable ? data : undefined) ?? [];
	return (
		<CommandGroup heading={m.ch_palette_players()} data-testid="chaal-palette-players">
			{found.map((player) => (
				<CommandItem
					key={player.id}
					value={`player ${player.username}`}
					keywords={[typed]}
					onSelect={() => onPick(player.username)}
				>
					<UserIcon aria-hidden />
					<span>
						{player.title ? <span className="font-bold text-xs">{player.title} </span> : null}
						{player.username}
					</span>
				</CommandItem>
			))}
			{found.some((player) => player.id === typed.toLowerCase()) ? null : (
				<CommandItem value={`player open ${typed}`} keywords={[typed]} onSelect={() => onPick(typed)}>
					<UserIcon aria-hidden />
					<span>{m.ch_palette_open_player({ name: typed })}</span>
				</CommandItem>
			)}
		</CommandGroup>
	);
}
