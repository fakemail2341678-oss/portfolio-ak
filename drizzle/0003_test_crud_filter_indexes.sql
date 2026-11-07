CREATE INDEX "test_crud_tags_idx" ON "test_crud" USING gin ("tags");--> statement-breakpoint
CREATE INDEX "test_crud_price_idx" ON "test_crud" USING btree ("price");