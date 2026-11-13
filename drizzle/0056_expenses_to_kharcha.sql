-- The Expenses app's rows move into Kharcha (decision 0289, PLAN Task 95), as Kanban's moved into
-- Taskline (0210). For each Expenses owner, a guest included:
-- - their person, as `ensurePerson` makes it (a verified, non-guest address takes over the person
--   somebody made for it; the colour is `colorFor(user id)`), and their profile;
-- - each category with the same id: `slate` becomes `gray`, the `tag` icon (Kharcha has none)
--   becomes `receipt`, ahead of the defaults Kharcha adds on their first visit (negative
--   positions). A name they already have in Kharcha is that category instead (names are unique);
-- - each expense with the same id: a personal expense (one payer, one share, `full` split), the
--   note as its title, its import key kept, `expense.created` in its history;
-- - per category and currency, the latest month's budget becomes a monthly budget (its id kept)
--   from the first month; an earlier month of another amount becomes that month's own amount;
-- - their import keys.
-- Quotas don't apply: nothing is lost. The next migration drops expense_*.
DO $$
DECLARE
	owner_row record;
	budget_row record;
	v_person uuid;
	v_address text;
	v_hash bigint;
	v_index integer;
	v_start integer;
	v_budget uuid;
	v_colors text[] := ARRAY['gray', 'red', 'orange', 'amber', 'green', 'teal', 'blue', 'indigo', 'violet', 'pink'];
	v_icons text[] := ARRAY[
		'utensils', 'coffee', 'shopping-basket', 'shopping-bag', 'bus', 'car', 'fuel', 'plane', 'house',
		'zap', 'wifi', 'smartphone', 'film', 'heart-pulse', 'shirt', 'gift', 'graduation-cap', 'receipt'
	];
BEGIN
	FOR owner_row IN
		SELECT u.id, u.name, u.email, u.email_verified, coalesce(u.is_anonymous, false) AS is_anonymous
		FROM "user" u
		WHERE EXISTS (SELECT 1 FROM expense_category c WHERE c.owner_id = u.id)
			OR EXISTS (SELECT 1 FROM expense_transaction t WHERE t.owner_id = u.id)
			OR EXISTS (SELECT 1 FROM expense_import i WHERE i.owner_id = u.id)
		ORDER BY u.id
	LOOP
		-- Their person (src/server/kharcha/people.ts, ensurePerson).
		SELECT id INTO v_person FROM kh_person WHERE user_id = owner_row.id;
		IF v_person IS NULL THEN
			v_address := CASE WHEN owner_row.email_verified AND NOT owner_row.is_anonymous
				THEN lower(btrim(owner_row.email)) END;
			IF v_address IS NOT NULL THEN
				UPDATE kh_person SET user_id = owner_row.id, display_name = owner_row.name
				WHERE email = v_address AND user_id IS NULL
				RETURNING id INTO v_person;
			END IF;
			IF v_person IS NULL THEN
				v_hash := 0;
				FOR v_index IN 1..char_length(owner_row.id) LOOP
					v_hash := (v_hash * 31 + ascii(substr(owner_row.id, v_index, 1))) % 1000003;
				END LOOP;
				INSERT INTO kh_person (user_id, email, display_name, color)
				VALUES (
					owner_row.id,
					CASE WHEN v_address IS NOT NULL AND NOT EXISTS (SELECT 1 FROM kh_person WHERE email = v_address)
						THEN v_address END,
					owner_row.name,
					v_colors[v_hash % 10 + 1]
				)
				RETURNING id INTO v_person;
			END IF;
		END IF;
		INSERT INTO kh_profile (user_id, person_id) VALUES (owner_row.id, v_person) ON CONFLICT DO NOTHING;

		-- Categories: before those they have (or the defaults to come), in the order they were made.
		SELECT coalesce(min(position), 0) INTO v_start FROM kh_category WHERE owner_id = v_person;
		SELECT v_start - count(*) INTO v_start FROM expense_category WHERE owner_id = owner_row.id;
		INSERT INTO kh_category (id, owner_id, name, color, icon, position, created_at)
		SELECT
			c.id, v_person, left(c.name, 40),
			CASE WHEN c.color = 'slate' THEN 'gray' WHEN c.color = ANY (v_colors) THEN c.color ELSE 'gray' END,
			CASE WHEN c.icon = ANY (v_icons) THEN c.icon ELSE 'receipt' END,
			v_start + (row_number() OVER (ORDER BY c.created_at, c.id))::integer - 1,
			c.created_at
		FROM expense_category c
		WHERE c.owner_id = owner_row.id
		ON CONFLICT DO NOTHING;

		-- Expenses: personal ones, the owner paying and owing all of it.
		INSERT INTO kh_expense (id, created_by, kind, title, amount_minor, currency, spent_on, split, import_key, created_at, updated_at)
		SELECT
			t.id, v_person, 'expense', left(t.note, 200), t.amount_minor, upper(t.currency), t.occurred_on,
			jsonb_build_object('method', 'full', 'person', v_person), t.import_key, t.created_at, t.updated_at
		FROM expense_transaction t
		WHERE t.owner_id = owner_row.id;
		INSERT INTO kh_expense_payer (expense_id, person_id, amount_minor, position)
		SELECT t.id, v_person, t.amount_minor, 0 FROM expense_transaction t WHERE t.owner_id = owner_row.id;
		INSERT INTO kh_expense_share (expense_id, person_id, owed_minor, position, category_id)
		SELECT t.id, v_person, t.amount_minor, 0, k.id
		FROM expense_transaction t
		LEFT JOIN expense_category c ON c.id = t.category_id
		LEFT JOIN kh_category k ON k.owner_id = v_person AND lower(k.name) = lower(left(c.name, 40))
		WHERE t.owner_id = owner_row.id;
		INSERT INTO kh_activity (expense_id, actor_id, kind, data, at)
		SELECT t.id, v_person, 'expense.created', jsonb_build_object('title', left(t.note, 200)), t.created_at
		FROM expense_transaction t
		WHERE t.owner_id = owner_row.id;

		-- Budgets: one monthly budget per category and currency, from its first month.
		FOR budget_row IN
			SELECT DISTINCT ON (b.category_id, b.currency)
				b.id, b.category_id, b.currency, b.month, b.amount_minor, b.created_at, k.id AS kh_category_id,
				min(b.month) OVER (PARTITION BY b.category_id, b.currency) AS first_month
			FROM expense_budget b
			JOIN expense_category c ON c.id = b.category_id
			JOIN kh_category k ON k.owner_id = v_person AND lower(k.name) = lower(left(c.name, 40))
			WHERE b.owner_id = owner_row.id
			ORDER BY b.category_id, b.currency, b.month DESC
		LOOP
			v_budget := NULL;
			-- One they already have on that category and currency stays as it is.
			INSERT INTO kh_budget (id, owner_id, category_id, currency, period, amount_minor, starts_on, created_at)
			VALUES (
				budget_row.id, v_person, budget_row.kh_category_id, upper(budget_row.currency), 'month',
				budget_row.amount_minor, budget_row.first_month, budget_row.created_at
			)
			ON CONFLICT DO NOTHING
			RETURNING id INTO v_budget;
			IF v_budget IS NOT NULL THEN
				INSERT INTO kh_budget_month (budget_id, month, amount_minor)
				SELECT v_budget, b.month, b.amount_minor
				FROM expense_budget b
				WHERE b.category_id = budget_row.category_id AND b.currency = budget_row.currency
					AND b.month < budget_row.month AND b.amount_minor <> budget_row.amount_minor;
			END IF;
		END LOOP;

		-- Import keys: a repeat of an old import still gets its first answer.
		INSERT INTO kh_import (key, owner_id, fingerprint, result, created_at)
		SELECT
			i.key, v_person, i.fingerprint,
			CASE WHEN i.result IS NULL THEN NULL ELSE jsonb_build_object(
				'inserted', coalesce((i.result ->> 'inserted')::integer, 0),
				'categories', coalesce((i.result ->> 'categoriesCreated')::integer, 0),
				'tags', 0,
				'methods', 0
			) END,
			i.created_at
		FROM expense_import i
		WHERE i.owner_id = owner_row.id
		ON CONFLICT DO NOTHING;

		-- An open Kharcha page refetches (PLAN 14.5 "Freshness").
		UPDATE kh_profile SET rev = rev + 1 WHERE user_id = owner_row.id;
	END LOOP;
END $$;
--> statement-breakpoint
UPDATE "portfolio_project" SET "app_slug" = 'kharcha' WHERE "app_slug" = 'expenses';
