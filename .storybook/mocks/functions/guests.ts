import { fn } from "storybook/test";

// Stand-in for src/functions/guests.ts.
export const claimGuestData = fn(async (): Promise<{ claimed: boolean }> => ({ claimed: false })).mockName(
	"claimGuestData",
);
