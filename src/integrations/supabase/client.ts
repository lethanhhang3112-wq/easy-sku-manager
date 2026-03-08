import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = "https://d62c243a-d27f-48b9-a3db-21c96f4fdca6.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImQ2MmMyNDNhLWQyN2YtNDhiOS1hM2RiLTIxYzk2ZjRmZGNhNiIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzI1MDAwMDAwLCJleHAiOjIwNDA1NzYwMDB9";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY);
