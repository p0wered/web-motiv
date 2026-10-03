// Связи для реляционных запросов (db.query.*); дополняются по мере появления экранов.
import { defineRelations } from 'drizzle-orm';
import * as schema from './schema.ts';

export const relations = defineRelations(schema);
