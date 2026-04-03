import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    return { from: () => ({ select: () => ({ error: { message: 'Supabase URL/Key missing' } }) }) } as any
  }

  return createBrowserClient(url, key)
}
