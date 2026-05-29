import { useEffect, useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import type { User, Session } from '@supabase/supabase-js'

export interface Profile {
  id: string
  tenant_id: string | null
  role: 'owner' | 'member' | 'super_admin'
  full_name: string | null
  email: string | null
}

export interface Subscription {
  id: string
  status: 'active' | 'trialing' | 'past_due' | 'canceled' | 'incomplete'
  current_period_end: string
  plan_name: string
}

export interface AuthState {
  user: User | null
  session: Session | null
  profile: Profile | null
  subscription: Subscription | null
  isLoading: boolean
  isAuthenticated: boolean
  hasAccess: boolean
  isSuperAdmin: boolean
}

function raceTimeout<T>(p: PromiseLike<{ data: T | null }>, ms: number) {
  return Promise.race([p, new Promise<{ data: null }>(r => setTimeout(() => r({ data: null }), ms))])
}

export function useAuth(): AuthState {
  const [user, setUser]               = useState<User | null>(null)
  const [session, setSession]         = useState<Session | null>(null)
  const [profile, setProfile]         = useState<Profile | null>(null)
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [isLoading, setIsLoading]     = useState(true)

  useEffect(() => {
    let mounted = true
    let loadedFor: string | null = null  // prevent double-load for same userId

    async function loadProfile(userId: string) {
      if (loadedFor === userId) return   // already in-flight or done
      loadedFor = userId

      try {
        const { data: prof } = await raceTimeout(
          supabase.from('profiles')
            .select('id, tenant_id, role, full_name, email')
            .eq('id', userId)
            .single(),
          5000
        )
        if (!mounted) return
        setProfile(prof as Profile | null)

        if ((prof as Profile | null)?.tenant_id) {
          const { data: sub } = await raceTimeout(
            supabase.from('subscriptions')
              .select('id, status, current_period_end, plans(name)')
              .eq('tenant_id', (prof as Profile).tenant_id!)
              .in('status', ['active', 'trialing'])
              .order('created_at', { ascending: false })
              .limit(1)
              .single(),
            5000
          )
          if (!mounted) return
          if (sub) {
            setSubscription({
              id: (sub as any).id,
              status: (sub as any).status,
              current_period_end: (sub as any).current_period_end,
              plan_name: (sub as any).plans?.name ?? 'Anual',
            })
          }
        }
      } catch {
        // graceful fallback — tables may not exist yet (migration pending)
      } finally {
        if (mounted) setIsLoading(false)
      }
    }

    // Initial session (needed when onAuthStateChange already fired before mount)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) loadProfile(session.user.id)
      else setIsLoading(false)
    })

    // Subsequent changes: login elsewhere, sign-out, token refresh
    const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        loadProfile(session.user.id)
      } else {
        loadedFor = null
        setProfile(null)
        setSubscription(null)
        setIsLoading(false)
      }
    })

    return () => {
      mounted = false
      authSub.unsubscribe()
    }
  }, [])

  const isSuperAdmin = profile?.role === 'super_admin'
  const hasAccess    = isSuperAdmin
    || subscription?.status === 'active'
    || subscription?.status === 'trialing'

  return {
    user, session, profile, subscription,
    isLoading,
    isAuthenticated: !!user,
    hasAccess: !!hasAccess,
    isSuperAdmin,
  }
}
