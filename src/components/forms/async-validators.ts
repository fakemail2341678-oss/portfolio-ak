/**
 * A debounced server check on one field while the user types ("is this email
 * free?"), for its AppField's `validators`. It runs only on values the field's
 * own schema accepts (`accepts`), so a half-typed address asks nothing; saving
 * still checks on the server, and its CONFLICT lands on the same field.
 *
 *   <form.AppField name="email" validators={availabilityValidators({
 *     isAvailable: (email) => isUserEmailFree({ data: { email } }),
 *     accepts: (email) => emailSchema.safeParse(email).success,
 *     message: m.users_invite_email_taken,
 *   })}>
 *
 * Slugs have their own (`slugValidators`, fields/slug-field.tsx), which also follows the title.
 */
export const availabilityValidators = ({
	isAvailable,
	accepts,
	message,
	debounceMs = 400,
}: {
	isAvailable: (value: string) => Promise<boolean>;
	accepts: (value: string) => boolean;
	message: () => string;
	debounceMs?: number;
}) => ({
	onChangeAsyncDebounceMs: debounceMs,
	onChangeAsync: async ({ value }: { value: string }) => {
		if (!accepts(value)) return undefined;
		return (await isAvailable(value)) ? undefined : message();
	},
});
