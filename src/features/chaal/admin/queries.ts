import { mutationOptions, queryOptions } from "@tanstack/react-query";
import { checkChaalPublicLane, getChaalLab } from "@/functions/chaal-admin/lab";
import { chaalKeys } from "../keys";

/** The admin's Chaal reads and writes (Task 71: the lab). */

export const chaalLabQueryOptions = () => queryOptions({ queryKey: chaalKeys.lab(), queryFn: () => getChaalLab() });

export const checkPublicLaneMutationOptions = () =>
	mutationOptions({ mutationKey: [...chaalKeys.lab(), "lane"], mutationFn: () => checkChaalPublicLane() });
