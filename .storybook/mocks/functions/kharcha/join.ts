import { fn } from "storybook/test";
import type { JoinInvite } from "../../../../src/features/kharcha/types";
import { sampleKharchaInvite } from "../../kharcha";

// Stand-ins for src/functions/kharcha/join.ts.
export const getKharchaInvite = fn(async (): Promise<JoinInvite> => sampleKharchaInvite).mockName("getKharchaInvite");
