import { queryOptions } from "@tanstack/react-query";
import { getChaalHome } from "@/functions/chaal/home";
import { chaalKeys } from "../keys";

/** The home's curated sections (Task 84): its loader `ensureQuery`s this, the page reads it. */
export const chaalHomeQueryOptions = () => queryOptions({ queryKey: chaalKeys.home(), queryFn: () => getChaalHome() });
