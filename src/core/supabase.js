import { createClient } from '@supabase/supabase-js';

function getEnvOrThrow(name) {
  const value = import.meta.env[name];

  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(
      `[Supabase] Missing required environment variable: ${name}. ` +
        `Ensure it is defined in your environment configuration.`,
    );
  }

  return value.trim();
}

function getUrlEnvOrThrow(name) {
  const value = getEnvOrThrow(name);

  try {
    new URL(value);
  } catch {
    throw new Error(`[Supabase] Invalid URL format for environment variable: ${name}.`);
  }

  return value;
}

const supabaseUrl = getUrlEnvOrThrow('VITE_SUPABASE_URL');
// SECURITY: usar apenas a chave pública/anon no cliente (VITE_SUPABASE_KEY), nunca service_role.
const supabaseKey = getEnvOrThrow('VITE_SUPABASE_KEY');

export const supabase = createClient(supabaseUrl, supabaseKey);
