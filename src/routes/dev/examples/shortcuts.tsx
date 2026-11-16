import { createFileRoute } from "@tanstack/react-router";
import { useId, useState } from "react";
import { DescriptionList } from "@/components/data-display/description-list";
import { ShortcutsList } from "@/components/dialogs/shortcuts-list";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Demo, ExamplePage } from "@/features/dev/examples/components/example-page";
import { useShortcuts } from "@/hooks/use-shortcuts";
import { staticCrumb } from "@/lib/breadcrumbs";
import { formatNumber } from "@/lib/i18n/intl";
import { privateHead } from "@/lib/seo";
import { m } from "@/paraglide/messages";

/**
 * TanStack Hotkeys (decision 0299) is the one way to bind a shortcut:
 * `useShortcuts(group, [{ keys, name, run }])` (src/hooks/use-shortcuts.ts) registers each
 * with a name and a group, and `<ShortcutsList />` (src/components/dialogs/shortcuts-list.tsx)
 * shows what is bound right now, so a shortcuts dialog cannot name a key that does nothing.
 * `keys` is "Mod+K" (⌘ on Apple devices, Ctrl elsewhere), a single key, or a sequence
 * `["G", "C"]`. A single key is skipped while a field has the focus. `useShortcutLabel(keys)`
 * gives the label for a `Kbd` beside a control: the server renders the "Ctrl" form, so the
 * `Kbd` has a fixed width and the swap to "⌘" shifts nothing.
 * A widget's own keys (arrows in a grid, Enter in a field) are not shortcuts: they stay an
 * `onKeyDown` with a `// keys: <reason>` comment.
 */
export const Route = createFileRoute("/dev/examples/shortcuts")({
	staticData: { breadcrumb: staticCrumb(m.examples_shortcuts_title) },
	head: () => privateHead(m.examples_shortcuts_title()),
	component: ShortcutsExample,
});

function ShortcutsExample() {
	const fieldId = useId();
	const switchId = useId();
	const [count, setCount] = useState(0);
	const [resettable, setResettable] = useState(true);
	useShortcuts(m.examples_shortcuts_group(), [
		{ keys: "C", name: m.examples_shortcuts_add(), run: () => setCount((value) => value + 1) },
		{ keys: ["G", "C"], name: m.examples_shortcuts_ten(), run: () => setCount((value) => value + 10) },
		{ keys: "Shift+R", name: m.examples_shortcuts_reset(), run: () => setCount(0), enabled: resettable },
	]);
	return (
		<ExamplePage slug="shortcuts">
			<Demo title={m.examples_shortcuts_try()} note={m.examples_shortcuts_try_note()}>
				<DescriptionList
					items={[{ label: m.examples_shortcuts_count(), value: formatNumber(count), testId: "shortcuts-count" }]}
				/>
				<div className="flex flex-col gap-2">
					<Label htmlFor={fieldId}>{m.examples_shortcuts_field()}</Label>
					<Input id={fieldId} className="max-w-sm" />
				</div>
				<div className="flex items-center gap-3">
					<Switch id={switchId} checked={resettable} onCheckedChange={setResettable} />
					<Label htmlFor={switchId}>{m.examples_shortcuts_allow_reset()}</Label>
				</div>
			</Demo>
			<Demo title={m.examples_shortcuts_bound()} note={m.examples_shortcuts_bound_note()}>
				<ShortcutsList className="max-w-md" />
			</Demo>
		</ExamplePage>
	);
}
