CREATE TABLE "image_upload_links" (
	"id" serial PRIMARY KEY NOT NULL,
	"token_hash" text NOT NULL,
	"created_by" text,
	"thumbnail_post_id" integer,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"filename" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "image_upload_links_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "image_upload_links" ADD CONSTRAINT "image_upload_links_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "image_upload_links" ADD CONSTRAINT "image_upload_links_thumbnail_post_id_posts_id_fk" FOREIGN KEY ("thumbnail_post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;