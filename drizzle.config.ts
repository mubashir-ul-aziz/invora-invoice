import type { Config } from 'drizzle-kit';

// Used only to generate/inspect SQL migrations for documentation and future
// tooling (`node node_modules/drizzle-kit/bin.cjs generate`). The app itself
// bootstraps its schema at runtime via db/client.ts — see the note there.
export default {
  schema: './src/data/db/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  driver: 'expo',
} satisfies Config;
