import { type ChaalPreferences, readPreferences } from "./preferences";

/**
 * What this browser keeps for Chaal without a session (decision 0259): the preferences,
 * under keys that start with `chaal:` so "Delete this device's data" finds them all
 * (local games, Task 76, are under `chaal:game:`). Every access is
 * wrapped: storage can be full, off or refused.
 */
const PREFIX = "chaal:";
const PREFERENCES_KEY = `${PREFIX}preferences`;

const listeners = new Set<() => void>();
/** Tells this tab's readers that something under the prefix changed (other tabs hear the storage event). */
export const notifyLocal = () => {
	for (const listener of listeners) listener();
};
const notify = notifyLocal;

/** For useSyncExternalStore: this tab's writes, and other tabs' through the storage event. */
export function subscribeLocal(listener: () => void): () => void {
	listeners.add(listener);
	const onStorage = (event: StorageEvent) => {
		if (event.key === null || event.key.startsWith(PREFIX)) listener();
	};
	window.addEventListener("storage", onStorage);
	return () => {
		listeners.delete(listener);
		window.removeEventListener("storage", onStorage);
	};
}

const rawPreferences = (): string | null => {
	try {
		return window.localStorage.getItem(PREFERENCES_KEY);
	} catch {
		return null;
	}
};

/** The last value read, so useSyncExternalStore gets the same object until the stored text changes. */
let snapshot: { raw: string | null; value: ChaalPreferences | null } = { raw: null, value: null };

/** This browser's preferences, or null when it has none. */
export function readLocalPreferences(): ChaalPreferences | null {
	const raw = rawPreferences();
	if (raw !== snapshot.raw) {
		let value: ChaalPreferences | null = null;
		if (raw !== null) {
			try {
				value = readPreferences(JSON.parse(raw));
			} catch {
				value = null;
			}
		}
		snapshot = { raw, value };
	}
	return snapshot.value;
}

export function writeLocalPreferences(preferences: ChaalPreferences): void {
	try {
		window.localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
	} catch {
		// Storage is off or full: the choice lasts until the page closes.
	}
	notify();
}

export function clearLocalPreferences(): void {
	try {
		window.localStorage.removeItem(PREFERENCES_KEY);
	} catch {
		// Nothing to clear.
	}
	notify();
}

/** Everything Chaal keeps in this browser: what "Delete this device's data" removes. */
export function chaalLocalKeys(): string[] {
	try {
		return Object.keys(window.localStorage).filter((key) => key.startsWith(PREFIX));
	} catch {
		return [];
	}
}

export function clearChaalLocalData(): void {
	for (const key of chaalLocalKeys()) {
		try {
			window.localStorage.removeItem(key);
		} catch {
			// Keep going: the rest still go.
		}
	}
	notify();
}
