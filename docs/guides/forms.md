# Forms

TanStack Form with the app's field library: one Zod schema for the browser and the server, localized messages, accessible fields and server errors on the right field. Examples: `/dev/examples/forms`, and every field at `/dev/forms` (`pnpm dev`).

## A form

```tsx
const schema = z.object({ name: required({ max: 80 }), price: currency({ max: 10_000_000 }) }); // src/lib/validation.ts

function ThingForm() {
	const form = useAppForm({
		defaultValues: { name: "", price: undefined as number | undefined },
		validators: formValidators(schema),          // on change, blur and submit; an edit clears the field's stale errors (0196)
		onSubmit: async ({ value, formApi }) => {
			try {
				await saveThing({ data: value });
				toast.success(m.things_saved());
			} catch (error) {
				handleSaveError(formApi, error);       // field errors on their fields, the rest a toast
			}
		},
	});
	return (
		<form.AppForm>
			<form.Form>
				<form.FormErrorSummary />
				<form.AppField name="name">{(field) => <field.TextField label={m.things_name()} />}</form.AppField>
				<form.AppField name="price">{(field) => <field.CurrencyField label={m.things_price()} />}</form.AppField>
				<form.SubmitButton pendingLabel={m.things_saving()}>{m.things_save()}</form.SubmitButton>
			</form.Form>
		</form.AppForm>
	);
}
```

- **One schema:** the server function validates with the same schema (`validator(zodInput(schema))`), so the rules can't drift. Build schemas from `src/lib/validation.ts`: its helpers return localized messages and parse what the fields store.
- **When errors show:** after a field is left or a submit is tried. A failed submit shows `FormErrorSummary`, which takes focus and links to each field.
- **Server errors:** a refusal with `fieldErrors` (e.g. `CONFLICT` on `slug`) appears on that field. Editing the field clears it. Other errors go to a toast (`handleSaveError`).
- **Create and edit forms of a feature use `useCrudForm`** ([crud.md](crud.md), "Forms"): it saves through the feature's mutations, puts server field errors on their fields, handles the version check below, toasts and refreshes the lists. The form stays `useAppForm({ ...thingFormOptions(item), ...crud.formProps })`, so its type is exact and `withForm` sections of it type-check; `CrudForm` (a page) or `FormDialog` (a dialog) renders the guard, the stale alert and the error summary around the fields.
- **Edits of an existing record send its version** (optimistic concurrency, 0122). The update schema adds `updatedAt: versionSchema()`, `useCrudForm` sends `item.updatedAt`, and the repository saves with `updateVersioned` (the check is in the UPDATE's WHERE), else a stale CONFLICT. The form then shows `StaleVersionAlert`; its "Reload" refetches the record's query (`reload: thingKeys.detail(id)`), and the newer version changes `crudFormKey(item)`, the form's React key, which remounts it with fresh defaults. Dialogs read their record from the list's cache by id, so the same works there (`features/rbac/components/role-dialog.tsx`).
- **Checks while typing:** `slugValidators` (a slug that follows its source) and `availabilityValidators` (`components/forms/async-validators.ts`: "is this email free?") run a debounced server check; saving checks again and lands its CONFLICT on the same field.
- **Unsaved changes:** `CrudForm` and `FormDialog` block navigation away from a changed form and ask first (`UnsavedChangesGuard`).
- **Form arrays updated from async work** (uploads): use the field's atomic helpers (`field.pushValue`), never a value read earlier (0099).
- **`method="post"`:** `form.Form` sets it, and every hand-written `<form>` must too (a test checks). A submit before hydration then posts the values instead of putting them in the URL (0104).

## Fields

`TextField`, `TextareaField`, `EmailField`, `PasswordField`, `UrlField`, `NumberField`, `CurrencyField`, `SelectField`, `ComboboxField`, `MultiSelectField`, `RadioGroupField`, `CheckboxField`, `CheckboxGroupField`, `SwitchField`, `PhoneField`, `OtpField`, `DateField`, `DateRangeField`, `TimeField`, `SliderField`, `TagsInputField`, `ColorField`, `FileField`, `ImageField`, `RichTextField`. Each takes `label`, an optional `description` and `optional`, and wires `aria-invalid`, `aria-describedby` and the error text.

| Field | Stores | Validate with |
| --- | --- | --- |
| `NumberField`, `CurrencyField` | `number` (Devanagari digits and separators accepted) | `numberRange()`, `currency()` |
| `PhoneField` | E.164 string (Nepal by default) | `phone()` |
| `DateField`, `DateRangeField`, `TimeField` | `"YYYY-MM-DD"`, `{ from, to }`, `"HH:mm"` | `isoDate()`, `dateRange()`, `time()` |
| `TagsInputField` | `string[]` | `tags()` |
| `FileField`, `ImageField` | `File[]` | `files({ maxBytes, accept })` |
| `RichTextField` | HTML (untrusted) | `richText()`; sanitize on the server |

- **Images for a record** are not `ImageField`: use `ImageGalleryField` (Cloudinary uploads, sortable, alt text in both languages; [attachments.md](attachments.md)).
- **Schema helpers for these fields** (`src/lib/validation.ts`): `localizedText()` and `localizedRichText()` (`{ en, ne }`, Nepali optional), `list(item, { min, max })` for array fields (localized min/max messages).
- **Rich text:** the editor loads only in the browser, and the server renders a same-size placeholder. On the server, pass its HTML through `sanitizeRichText()` before storing it and again before sending it to a page, then render it with `<RichTextContent html={safe} />`. That component only accepts the `SafeHtml` the sanitizer returns.

## Composite fields

The kit's fields for structured content (Task 37, decision 0168). They are **not registered on `useAppForm`**: import them where they are used and render them inside `form.AppField` (`{() => <SlugField … />}`). Registered fields load with every form page (the login page too); these bring dnd-kit, Query searches or Tiptap, so only the pages that use them pay for them. `/dev/examples/fields` uses all of them in one form.

| Field | Stores | Notes |
| --- | --- | --- |
| `AsyncComboboxField` (`fields/async-combobox-field.tsx`) | the option's `value` | `search(query)` is a server function, debounced and cached by Query under `queryKey`; `selected` gives the labels of initial values |
| `RelationField` | a value, or `string[]` with `multiple` | records of another feature: a `Relation` (`{ queryKey, search }`, usually that feature's own list function, so its read permission applies) |
| `SortableListField` (`fields/list-fields.tsx`) | any array | `renderItem({ index, name })` renders the entry's own `form.AppField`s at `name` (`links[2]`); `newItem` for Add |
| `BlocksField` | `Block[]` (`{ id, type, … }`, a discriminated union) | `types`: per type a label, `create()`, an optional `summary` and `render`; blocks collapse and stay mounted |
| `KeyValueField` | `{ key, value }[]` | metadata, headers |
| `LocalizedField`, `LocalizedRichTextField` (`fields/localized-fields.tsx`) | `{ en, ne }` | field groups (`withFieldGroup`): `<LocalizedField form={form} fields="title" label=… />`; en/ne tabs, "Nepali missing", a failed submit opens the tab with the error; Nepali is optional |
| `MediaField` (`features/media/components/media-field.tsx`) | `{ id, preview }[]` | items of the media library (`max={1}` for one image, `kind="document"` for a PDF); a lazily loaded picker searches, selects and uploads; alt text is the item's own (0177) | <!-- @portfolio -->
| `SlugField` (`fields/slug-field.tsx`) | `string` | made from `from` (a dotted path: `title.en`) while linked; pair with `slugValidators({ from, isAvailable })` on the AppField for a debounced server check that re-runs when the source changes (`onChangeListenTo`) |

- **Reordering** (`SortableList`, `fields/sortable-list.tsx`, on `@dnd-kit/react`, decision 0170): drag the handle, or Space + arrow keys + Space from the keyboard, or Alt + ↑/↓ for one step. Moves are announced in the page's language. `moveItem(items, from, to)` for your own lists.
- **Form layout:** `FormSection` (heading and description beside the fields from `lg`), `FormCard` (a card with an optional footer), `StickyFormBar` (Save and Cancel stuck to the bottom of a long form, "Unsaved changes" once edited). All in `components/page/form-layout.tsx`.
- **In a dialog or a sheet:** `FormDialog` and `FormSheet` (`components/dialogs/form-dialog.tsx`), rendered inside `form.AppForm`: the error summary, `stale` for StaleVersionAlert, Submit and Cancel, a "discard changes?" confirm and the unsaved-changes guard.

## Adding a field type

Put it in `src/components/forms/fields/`, render it inside `FieldShell` (label, description, errors, ids), register it in `src/components/forms/index.ts` if it is light (a heavy one is imported where it's used, like the composite fields), add a story wrapped in `FieldStory` with a `play` function, and add a jsdom test next to the others in `tests/components/forms/`.

## Pitfalls already solved

Moved here from CLAUDE.md, which keeps only the ones that apply everywhere. Don't reintroduce them.

- **Form arrays updated from async callbacks:** use the field's atomic helpers (`field.pushValue`), not a value read earlier; concurrent uploads lost images that way (0099).
- **A submit while an async validator runs did nothing:** TanStack Form's `handleSubmit` ignores a first attempt while `canSubmit` is false, and it is false while any field validates (`isFieldsValidating`, already during the debounce). So "type a title, press Save" within a slug check's debounce was silently dropped. The shared `Form` waits for validation to settle, then submits (0172); don't call `form.handleSubmit()` from your own `<form>`.
- **Edits without a version:** an update schema without `updatedAt: versionSchema()` lets the second of two editors overwrite the first. `useCrudForm` catches the stale `CONFLICT` and shows `StaleVersionAlert` (0122).
- **A fixed field kept its error until it lost focus:** a submit's (and a blur's) error stays in the field's `errorMap` after an edit fixes it, and only the next blur cleared it. The message leaving then moved everything below it between the press and the release of the next click, so pressing Send right after fixing a field did nothing. `clearServerErrorOnChange` clears the server's, the submit's and the blur's errors on every change, and the change validator's result is what shows (0195). `useAppForm` runs it on every form, before a form's own `listeners.onChange` (0196); don't add it again.
- **Forms handled in JavaScript set `method="post"`** (the shared `Form` does): without it a submit before hydration puts the fields, passwords included, in the URL. A test checks every `<form>` (0104).
- **Heavy fields aren't on `useAppForm`** (0168): every page with a form loads the registered fields. The composite fields (sortable lists, blocks, slug, localized, relations, the image gallery) are imported where used and rendered inside `form.AppField`. Dialogs that open on click are `React.lazy`, or their forms load with the page.
