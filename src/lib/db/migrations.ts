import { schemaMigrations } from '@nozbe/watermelondb/Schema/migrations';

// Append-only. Never edit a migration that has shipped; add a new one and bump schema.version.
export const migrations = schemaMigrations({ migrations: [] });
