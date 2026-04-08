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
const supabaseKey = getEnvOrThrow('VITE_SUPABASE_KEY');

export const supabase = createClient(supabaseUrl, supabaseKey);
