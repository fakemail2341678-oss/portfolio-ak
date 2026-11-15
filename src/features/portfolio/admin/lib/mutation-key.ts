/** Writes, keyed (useMutationState can find them). useCrudMutation and useCrudForm add the rest. */
export const keyed = (base: ReadonlyArray<string>, name: string) => [...base, name];
