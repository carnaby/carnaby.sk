import { boolean, integer, pgEnum, pgTable, primaryKey, serial, text, timestamp, unique } from 'drizzle-orm/pg-core';
import { user } from './auth';

export const languageEnum = pgEnum('language', ['sk', 'en']);
export const postStatusEnum = pgEnum('post_status', ['draft', 'published', 'archived']);

export const categories = pgTable('categories', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  description: text('description'),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const posts = pgTable('posts', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  status: postStatusEnum('status').notNull().default('draft'),
  isFeatured: boolean('is_featured').notNull().default(false),
  thumbnailPath: text('thumbnail_path'),
  youtubeId: text('youtube_id'),
  soundcloudUrl: text('soundcloud_url'),
  authorId: text('author_id').references(() => user.id, { onDelete: 'set null' }),
  viewCount: integer('view_count').notNull().default(0),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const postTranslations = pgTable('post_translations', {
  id: serial('id').primaryKey(),
  postId: integer('post_id').notNull().references(() => posts.id, { onDelete: 'cascade' }),
  language: languageEnum('language').notNull(),
  title: text('title').notNull(),
  excerpt: text('excerpt'),
  content: text('content').notNull(),
  metaDescription: text('meta_description'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [unique('post_translations_post_language').on(t.postId, t.language)]);

export const postCategories = pgTable('post_categories', {
  postId: integer('post_id').notNull().references(() => posts.id, { onDelete: 'cascade' }),
  categoryId: integer('category_id').notNull().references(() => categories.id, { onDelete: 'cascade' }),
}, (t) => [primaryKey({ columns: [t.postId, t.categoryId] })]);
