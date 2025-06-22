import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import 'dotenv/config';
const sql = neon(process.env.DATABASE_URL!);
const db = drizzle({ client: sql });

export { db };