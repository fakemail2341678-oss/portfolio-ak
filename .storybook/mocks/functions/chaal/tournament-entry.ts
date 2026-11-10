import { fn } from "storybook/test";

// Stand-ins for src/functions/chaal/tournament-entry.ts: joining and withdrawing answer at once.
export const joinChaalTournament = fn(async (): Promise<void> => {}).mockName("joinChaalTournament");
export const withdrawChaalTournament = fn(async (): Promise<void> => {}).mockName("withdrawChaalTournament");
