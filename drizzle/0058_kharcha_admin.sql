CREATE TABLE "kh_daily_stat" (
	"day" date PRIMARY KEY NOT NULL,
	"people" integer DEFAULT 0 NOT NULL,
	"guests" integer DEFAULT 0 NOT NULL,
	"active" integer DEFAULT 0 NOT NULL,
	"expenses" integer DEFAULT 0 NOT NULL,
	"groups" integer DEFAULT 0 NOT NULL,
	"payments" integer DEFAULT 0 NOT NULL,
	"receipts" integer DEFAULT 0 NOT NULL,
	"invites_sent" integer DEFAULT 0 NOT NULL,
	"invites_accepted" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
