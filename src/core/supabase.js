import { createClient } from '@supabase/supabase-js';

function getEnvOrThrow(name) {
  const value = import.meta.env[name];

  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(
      `[Supabase] Missing required environment variable: ${name}. ` +
        'Configure it in .env for local development.',
    );
  }

  return value;
}

const supabaseUrl = getEnvOrThrow('VITE_SUPABASE_URL');
const supabaseKey = getEnvOrThrow('VITE_SUPABASE_KEY');

export const supabase = createClient(supabaseUrl, supabaseKey);
