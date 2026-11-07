-- PARDA_PLAYER_BASE holds the whole prefix, so a relative template no longer repeats it (decision 0246).
UPDATE "pd_source" SET
	"movie_template" = regexp_replace("movie_template", '^/parda/api/', '/'),
	"tv_template" = regexp_replace("tv_template", '^/parda/api/', '/');
