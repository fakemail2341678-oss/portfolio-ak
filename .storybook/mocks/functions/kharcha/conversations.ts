import { fn } from "storybook/test";
import type { CreateCommentInput } from "../../../../src/features/kharcha/schema";
import type { CommentView } from "../../../../src/features/kharcha/types";
import { sampleKharchaComment } from "../../kharcha";

// Stand-ins for src/functions/kharcha/conversations.ts.
export const createKharchaComment = fn(
	async (_input: { data: CreateCommentInput }): Promise<CommentView> => sampleKharchaComment,
).mockName("createKharchaComment");
export const updateKharchaComment = fn(async (): Promise<CommentView> => sampleKharchaComment).mockName(
	"updateKharchaComment",
);
export const deleteKharchaComment = fn(async (): Promise<void> => undefined).mockName("deleteKharchaComment");
export const reactKharchaComment = fn(async (): Promise<CommentView> => sampleKharchaComment).mockName(
	"reactKharchaComment",
);
export const setKharchaThreadRead = fn(async (): Promise<void> => undefined).mockName("setKharchaThreadRead");
export const setKharchaNotificationsRead = fn(async (): Promise<void> => undefined).mockName(
	"setKharchaNotificationsRead",
);
export const updateKharchaNotifySettings = fn(async (): Promise<void> => undefined).mockName(
	"updateKharchaNotifySettings",
);
export const setKharchaFocus = fn(async (): Promise<void> => undefined).mockName("setKharchaFocus");
