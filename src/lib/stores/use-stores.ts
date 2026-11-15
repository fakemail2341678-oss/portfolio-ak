import { useRouter } from "@tanstack/react-router";
import { useSelector } from "@tanstack/react-store";
import type { Preferences, TablePreferences } from "./preferences";

/** The router's preferences store (one per request on the server, one per tab in the browser). */
export const usePreferencesStore = () => useRouter().options.context.preferences;

/** Subscribes to a slice of the preferences; re-renders only when that slice changes. */
export const usePreferences = <T>(selector: (preferences: Preferences) => T) =>
	useSelector(usePreferencesStore(), selector);

export const useTheme = () => {
	const store = usePreferencesStore();
	return { theme: usePreferences((state) => state.theme), setTheme: store.actions.setTheme };
};

/** The theme and the Graphite presets (accent, radius, density), with their setters. */
export const useAppearance = () => {
	const { actions } = usePreferencesStore();
	return {
		theme: usePreferences((state) => state.theme),
		accent: usePreferences((state) => state.accent),
		radius: usePreferences((state) => state.radius),
		density: usePreferences((state) => state.density),
		setTheme: actions.setTheme,
		setAccent: actions.setAccent,
		setRadius: actions.setRadius,
		setDensity: actions.setDensity,
	};
};

export const useSidebar = () => {
	const store = usePreferencesStore();
	const collapsed = usePreferences((state) => state.sidebarCollapsed);
	return {
		collapsed,
		setCollapsed: store.actions.setSidebarCollapsed,
		toggle: () => store.actions.setSidebarCollapsed(!collapsed),
	};
};

const NO_TABLE: TablePreferences = {};

/**
 * Persisted settings for one table (Test CRUD admin list and future tables).
 * `defaults.pageSize` applies until the user picks one.
 */
export const useTablePreferences = (tableId: string, defaults: { pageSize: number } = { pageSize: 20 }) => {
	const store = usePreferencesStore();
	const table = usePreferences((state) => state.tables[tableId] ?? NO_TABLE);
	const hiddenColumns = table.hiddenColumns ?? [];
	const shownColumns = table.shownColumns ?? [];
	return {
		pageSize: table.pageSize ?? defaults.pageSize,
		hiddenColumns,
		/** A column the user hid is hidden, one they showed is shown; otherwise it's visible unless `defaultHidden`. */
		isColumnVisible: (column: string, defaultHidden = false) =>
			hiddenColumns.includes(column) ? false : shownColumns.includes(column) ? true : !defaultHidden,
		setPageSize: (pageSize: number) => store.actions.setTablePageSize(tableId, pageSize),
		setColumnVisible: (column: string, visible: boolean, defaultHidden = false) =>
			store.actions.setColumnVisible(tableId, column, visible, defaultHidden),
	};
};
