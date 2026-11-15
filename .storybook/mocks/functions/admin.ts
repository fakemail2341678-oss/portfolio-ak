import { fn } from "storybook/test";
import type { Dashboard } from "../../../src/features/admin/lib/dashboard";
import { sampleDashboard } from "../data";

// Stand-in for src/functions/admin.ts.
export const getDashboard = fn(async (): Promise<Dashboard> => sampleDashboard).mockName("getDashboard");
