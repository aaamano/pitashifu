import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(url && anonKey)

if (!isSupabaseConfigured) {
  // 本番で白画面にならないよう、import時にはthrowせず警告のみ。
  // 画面側で isSupabaseConfigured を見て案内を出す。
  // eslint-disable-next-line no-console
  console.error(
    '[ピタシフ] Supabase の環境変数が未設定です。\n' +
    'Vercel または .env に VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY を設定してください。'
  )
}

export const supabase = createClient(
  url ?? 'http://localhost:54321',
  anonKey ?? 'public-anon-key-placeholder',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
)
