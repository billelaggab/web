import { drizzle } from "drizzle-orm/node-postgres";
import { pool } from "@/db/pool";

/**
 * عميل Drizzle فوق تجمّع اتصالات PostgreSQL.
 * كل استعلام يمر عبر بوابة المخطط الذاتية في `src/db/pool.ts`
 * (تُنشئ الجداول تلقائياً إن كانت قاعدة البيانات فارغة).
 */
export { pool } from "@/db/pool";

export const db = drizzle(pool);
