import { useContext } from "react";
import { SectionHomeContext } from "./section-home";

/** The section's home link, or null for the site's own. */
export const useSectionHome = () => useContext(SectionHomeContext);
