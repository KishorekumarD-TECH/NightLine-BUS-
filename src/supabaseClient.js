import { createClient } from '@supabase/supabase-js'
const url = import.meta.env.VITE_SUPABASE_URL || 'https://lvajupbineiwdgdtnkpq.supabase.co'
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_WOeZ8NYm-uMjmDoQc9Y1qQ_k7qbNofe'
export const supabase = createClient(url, anon)
