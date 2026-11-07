-- Part 1 stored Test CRUD images in Postgres; they are Cloudinary attachments now (decision 0098).
-- Dropped in this order: the foreign key, the column, then the table it pointed to.
ALTER TABLE "test_crud" DROP CONSTRAINT "test_crud_image_test_crud_image_id_fk";--> statement-breakpoint
ALTER TABLE "test_crud" DROP COLUMN "image";--> statement-breakpoint
DROP TABLE "test_crud_image";
