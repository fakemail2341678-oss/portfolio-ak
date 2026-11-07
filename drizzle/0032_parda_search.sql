CREATE TABLE "pd_search_stat" (
	"day" date NOT NULL,
	"query" text NOT NULL,
	"count" integer DEFAULT 1 NOT NULL,
	"zero_results" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pd_search_stat_pk" PRIMARY KEY("day","query")
);
