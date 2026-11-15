import { useEffect } from "react";
import { type RecentlyViewed, rememberViewed } from "../lib/recent";

/** Remembers the page's title or person for the overlay once it's shown (Task 66). */
export function useRememberViewed({ media, id, slug, name, picture, imageBase }: RecentlyViewed) {
	useEffect(() => {
		rememberViewed({ media, id, slug, name, picture, imageBase });
	}, [media, id, slug, name, picture, imageBase]);
}
