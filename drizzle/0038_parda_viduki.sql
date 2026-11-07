ALTER TABLE "pd_source" DROP CONSTRAINT "pd_source_adapter_valid";--> statement-breakpoint
ALTER TABLE "pd_source" ADD CONSTRAINT "pd_source_adapter_valid" CHECK ("pd_source"."adapter" in ('parda', 'viduki', 'none'));--> statement-breakpoint
-- Servers 1 to 4 follow the Viduki embed contract (decision 0248): no start or language
-- parameter, an accent color, and the viduki adapter. Only rows the admin hasn't edited.
UPDATE "pd_source" SET
	"movie_template" = regexp_replace("movie_template", '^/([1-4])/movie/\{id\}\?start=\{start\}&lang=\{lang\}$', '/\1/movie/{id}?color={color}'),
	"tv_template" = regexp_replace("tv_template", '^/([1-4])/tv/\{id\}/\{season\}/\{episode\}\?start=\{start\}&lang=\{lang\}$', '/\1/tv/{id}/{season}/{episode}?color={color}'),
	"adapter" = 'viduki'
WHERE "adapter" = 'parda'
	AND "movie_template" ~ '^/[1-4]/movie/\{id\}\?start=\{start\}&lang=\{lang\}$'
	AND "tv_template" ~ '^/[1-4]/tv/\{id\}/\{season\}/\{episode\}\?start=\{start\}&lang=\{lang\}$';
