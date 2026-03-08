import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = "https://fhryfzkhjkeikechzadq.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZocnlmemtoamtlaWtlY2h6YWRxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5NTAzODAsImV4cCI6MjA4ODUyNjM4MH0.Vl9gMGc5Mv09Pl9fAoPdhcO1MA6AF-x6C4uefTzPnZs";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY);
