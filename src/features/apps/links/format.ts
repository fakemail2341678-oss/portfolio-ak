import { absoluteUrl } from "@/lib/seo";
import { SHORT_LINK_PREFIX } from "./types";

/** A link's short URL on this site. */
export const shortUrl = (slug: string) => absoluteUrl(`${SHORT_LINK_PREFIX}${slug}`);

/** The target without its scheme, for display ("example.com/path"). */
export const displayTarget = (target: string) => target.replace(/^https?:\/\//, "");
