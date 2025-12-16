import { createClient } from '@supabase/supabase-js';

const STORAGE_URL_KEY = 'mediguard_sb_url';
const STORAGE_KEY_KEY = 'mediguard_sb_key';

// 1. Try Environment Variables first
let supabaseUrl = process.env.SUPABASE_URL;
let supabaseKey = process.env.SUPABASE_KEY;

// 2. Fallback to LocalStorage (User entered via UI)
if (!supabaseUrl || !supabaseKey) {
  supabaseUrl = localStorage.getItem(STORAGE_URL_KEY) || '';
  supabaseKey = localStorage.getItem(STORAGE_KEY_KEY) || '';
}

export const isCloudConfigured = !!(supabaseUrl && supabaseKey);

// Helper to create a safe mock client if credentials are missing
const createMockClient = () => {
  const mockResponse = Promise.resolve({ 
    data: null, 
    error: { message: 'Supabase credentials missing - running in local mode' } 
  });

  return {
    from: (table: string) => ({
      select: () => mockResponse,
      upsert: () => mockResponse,
      delete: () => ({
        eq: () => mockResponse
      })
    })
  } as any;
};

// Only initialize the real client if keys are present
export const supabase = isCloudConfigured
  ? createClient(supabaseUrl, supabaseKey)
  : createMockClient();

export const updateSupabaseConfig = (url: string, key: string) => {
  localStorage.setItem(STORAGE_URL_KEY, url);
  localStorage.setItem(STORAGE_KEY_KEY, key);
  window.location.reload(); // Reload to re-initialize client
};

export const clearSupabaseConfig = () => {
  localStorage.removeItem(STORAGE_URL_KEY);
  localStorage.removeItem(STORAGE_KEY_KEY);
  window.location.reload();
};

if (!isCloudConfigured) {
  console.warn("Supabase URL or Key is missing. App will run in Offline/Local Storage mode only.");
}