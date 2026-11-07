/**
 * Whether the `/dev` pages and their server functions exist: always under
 * `vite dev`, and in a build only when it was made with VITE_DEV_ROUTES=true
 * (the e2e harness does, to review them). Read from `import.meta.env` directly
 * so Vite inlines both values and a plain build folds this to the constant
 * `false`, dropping the dev-only code; `clientEnv` wouldn't fold. A production
 * deploy with the flag on fails at build and at boot (decision 0162).
 */
export const DEV_ROUTES: boolean = import.meta.env.DEV || import.meta.env.VITE_DEV_ROUTES === "true";
