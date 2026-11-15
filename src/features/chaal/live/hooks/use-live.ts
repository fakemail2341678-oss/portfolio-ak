import { useSyncExternalStore } from "react";
import { IDLE, type LiveState, type LiveStore, liveStore } from "../store";

export function useLive(store: LiveStore = liveStore): LiveState {
	return useSyncExternalStore(store.subscribe, store.get, () => IDLE);
}
