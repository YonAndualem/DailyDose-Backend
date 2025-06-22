import { pgTable, serial, text, varchar, timestamp } from 'drizzle-orm/pg-core';

export const quotes = pgTable('quotes', {
    id: serial('id').primaryKey(),
    quote: text('quote').notNull(),
    author: varchar('author', { length: 100 }).notNull(),
    category: varchar('category', { length: 50 }).notNull(),
    type: varchar('type', { length: 20 }).notNull(), // "daily" or "on-demand"
    date: timestamp('date', { withTimezone: true }).notNull(),
});