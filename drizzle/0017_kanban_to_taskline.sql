-- Kanban's boards become Taskline projects (decision 0210). For each Kanban owner, a
-- guest included: their sandbox (created if they have none) and their member row in
-- it; each board a project with the same id (keys KB1, KB2… skipping keys taken),
-- led by them; each column a status with the same id and order (the first "unstarted",
-- the last "completed", the rest "started"); each card a task with the same id,
-- numbered by creation, its colour labels as project labels, its checklist and due
-- date kept. Quotas don't apply: nothing is lost. The next migration drops kanban_*.
DO $$
DECLARE
	owner_row record;
	board record;
	column_row record;
	v_sandbox uuid;
	v_member uuid;
	v_key text;
	v_number integer;
	v_columns integer;
	v_index integer;
	v_cards integer;
BEGIN
	FOR owner_row IN
		SELECT DISTINCT b.owner_id, u.name FROM kanban_board b JOIN "user" u ON u.id = b.owner_id
	LOOP
		SELECT id INTO v_sandbox FROM tl_workspace WHERE kind = 'sandbox' AND owner_id = owner_row.owner_id;
		IF v_sandbox IS NULL THEN
			INSERT INTO tl_workspace (kind, slug, name, owner_id)
			VALUES ('sandbox', 'sandbox', 'Sandbox', owner_row.owner_id)
			RETURNING id INTO v_sandbox;
		END IF;
		SELECT id INTO v_member FROM tl_member WHERE workspace_id = v_sandbox AND user_id = owner_row.owner_id;
		IF v_member IS NULL THEN
			INSERT INTO tl_member (workspace_id, user_id, display_name)
			VALUES (v_sandbox, owner_row.owner_id, owner_row.name)
			RETURNING id INTO v_member;
		END IF;
		v_number := 0;

		FOR board IN
			SELECT * FROM kanban_board WHERE owner_id = owner_row.owner_id ORDER BY created_at, id
		LOOP
			LOOP
				v_number := v_number + 1;
				v_key := 'KB' || v_number;
				EXIT WHEN NOT EXISTS (SELECT 1 FROM tl_project WHERE workspace_id = v_sandbox AND key = v_key);
			END LOOP;
			SELECT count(*) INTO v_cards FROM kanban_card WHERE board_id = board.id;
			INSERT INTO tl_project (id, workspace_id, key, name, color, lead_id, task_seq, rev, created_at, updated_at)
			VALUES (board.id, v_sandbox, v_key, left(board.name, 80), 'blue', v_member, v_cards, 1, board.created_at, board.updated_at);
			INSERT INTO tl_project_member (project_id, member_id, role) VALUES (board.id, v_member, 'lead');
			INSERT INTO tl_activity (workspace_id, project_id, actor_id, kind, data, at)
			VALUES (v_sandbox, board.id, v_member, 'project.created',
				jsonb_build_object('key', v_key, 'name', left(board.name, 80), 'from', 'kanban'), board.created_at);

			SELECT count(*) INTO v_columns FROM kanban_column WHERE board_id = board.id;
			v_index := 0;
			FOR column_row IN
				SELECT * FROM kanban_column WHERE board_id = board.id ORDER BY position COLLATE "C", id
			LOOP
				v_index := v_index + 1;
				INSERT INTO tl_status (id, project_id, name, category, color, position, created_at, updated_at)
				VALUES (
					column_row.id, board.id, left(column_row.name, 40),
					CASE WHEN v_index = 1 THEN 'unstarted' WHEN v_index = v_columns THEN 'completed' ELSE 'started' END,
					CASE WHEN v_index = 1 THEN 'blue' WHEN v_index = v_columns THEN 'green' ELSE 'amber' END,
					column_row.position, column_row.created_at, column_row.updated_at
				);
			END LOOP;
			-- A board with no columns had no cards either; its project still needs a status.
			IF v_columns = 0 THEN
				INSERT INTO tl_status (project_id, name, category, color, position)
				VALUES (board.id, 'To do', 'unstarted', 'blue', 'a0');
			END IF;

			-- The colour labels the board's cards use, named after their colour.
			INSERT INTO tl_label (workspace_id, project_id, name, color)
			SELECT v_sandbox, board.id, initcap(colour), colour
			FROM (SELECT DISTINCT unnest(labels) AS colour FROM kanban_card WHERE board_id = board.id) used
			WHERE colour IN ('red', 'amber', 'green', 'blue', 'violet');

			INSERT INTO tl_task (
				id, workspace_id, project_id, number, title, description_html, description_text, status_id,
				position, checklist, due_on, reporter_id, completed_at, created_at, updated_at
			)
			SELECT
				c.id, v_sandbox, board.id,
				row_number() OVER (ORDER BY c.created_at, c.id),
				left(c.title, 240),
				-- Plain text as HTML: escaped, a blank line between paragraphs, a line break within one.
				CASE WHEN btrim(c.description) = '' THEN '' ELSE
					'<p>' || replace(replace(
						replace(replace(replace(replace(c.description, '&', '&amp;'), '<', '&lt;'), '>', '&gt;'), '"', '&quot;'),
						E'\n\n', '</p><p>'), E'\n', '<br>') || '</p>'
				END,
				c.description,
				c.column_id, c.position, c.checklist, c.due_on, v_member,
				CASE WHEN s.category = 'completed' THEN c.updated_at END,
				c.created_at, c.updated_at
			FROM kanban_card c JOIN tl_status s ON s.id = c.column_id
			WHERE c.board_id = board.id;

			INSERT INTO tl_task_label (task_id, label_id)
			SELECT c.id, l.id
			FROM kanban_card c
			CROSS JOIN LATERAL unnest(c.labels) AS colour
			JOIN tl_label l ON l.project_id = board.id AND l.color = colour
			WHERE c.board_id = board.id
			ON CONFLICT DO NOTHING;

			INSERT INTO tl_task_watcher (task_id, member_id)
			SELECT id, v_member FROM tl_task WHERE project_id = board.id;
			INSERT INTO tl_activity (workspace_id, project_id, task_id, actor_id, kind, data, at)
			SELECT v_sandbox, board.id, id, v_member, 'task.created', jsonb_build_object('title', title), created_at
			FROM tl_task WHERE project_id = board.id;
		END LOOP;
	END LOOP;
END $$;
--> statement-breakpoint
UPDATE "portfolio_project" SET "app_slug" = 'taskline' WHERE "app_slug" = 'kanban';
