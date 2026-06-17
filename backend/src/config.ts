import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.join(__dirname, '../.env') });

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
  supabaseJwtSecret: process.env.SUPABASE_JWT_SECRET || '',
};

if (!config.supabaseUrl || !config.supabaseAnonKey) {
  console.warn('WARNING: SUPABASE_URL or SUPABASE_ANON_KEY is not set. Supabase client will not function properly.');
}
