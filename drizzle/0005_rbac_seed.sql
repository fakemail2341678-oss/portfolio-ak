-- System roles (docs/decisions.md 0094). `admin` holds every permission implicitly
-- and is assigned through Better Auth's user.role; `user` is everyone's baseline and
-- starts with no permissions. Names here are fallbacks: the UI shows localized names.
INSERT INTO "role" ("key", "name", "description", "system")
VALUES
	('admin', 'Admin', 'Every permission.', true),
	('user', 'User', 'Every signed-in user.', true)
ON CONFLICT ("key") DO NOTHING;
