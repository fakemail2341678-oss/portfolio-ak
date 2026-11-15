import { useMatches } from "@tanstack/react-router";
import { skipsSession } from "@/lib/session-scope";

/** For components that read the session with useQuery: pass `enabled: !useSessionSkipped()`. */
export const useSessionSkipped = () => useMatches({ select: skipsSession });
