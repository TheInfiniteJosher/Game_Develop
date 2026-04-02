/**
 * Supabase Client Configuration
 * 
 * This client is used throughout the game to interact with the Supabase backend
 * for levels, music tracks, sound effects, and other persistent data.
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://mhfvggmlnwvssuwxvzaf.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1oZnZnZ21sbnd2c3N1d3h2emFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5NjU5NzMsImV4cCI6MjA4NjU0MTk3M30.F1Lx_jwug1Tfi8U3QgIPKaTY2VzPt1oBFheYiUhX2v0'

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Automatically detect OAuth tokens in the URL hash after redirect
    detectSessionInUrl: true,
    // Persist session in localStorage
    persistSession: true,
    // Use localStorage for session storage (works in iframes)
    storage: window.localStorage,
    // Automatically refresh tokens
    autoRefreshToken: true,
    // Flow type for OAuth
    flowType: 'implicit'
  }
})

export default supabase
