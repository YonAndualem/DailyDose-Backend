import { pgTable, serial, text, varchar, timestamp, uuid, integer } from 'drizzle-orm/pg-core';

// Categories table
export const categories = pgTable('categories', {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 50 }).notNull().unique(),
    description: text('description'),
});

// Quotes table with category_id as FK
export const quotes = pgTable('quotes', {
    id: serial('id').primaryKey(),
    uuid: uuid('uuid').defaultRandom().notNull().unique(),
    quote: text('quote').notNull(),
    author: varchar('author', { length: 100 }).notNull(),
    category_id: integer('category_id').notNull().references(() => categories.id),
    type: varchar('type', { length: 20 }).notNull(), // "daily" or "on-demand"
    date: timestamp('date', { withTimezone: true }).notNull(),
});