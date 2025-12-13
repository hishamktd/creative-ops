import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

export const supabase = createClientComponentClient()

// Auth configuration
export const authConfig = {
  // Disable email verification in development
  skipEmailVerification: process.env.NEXT_PUBLIC_SKIP_EMAIL_VERIFICATION === 'true',
  // Disable auth entirely for demo purposes
  disableAuth: process.env.NEXT_PUBLIC_DISABLE_AUTH === 'true',
}

// Sign up without email verification
export async function signUpWithoutVerification(email: string, password: string) {
  if (authConfig.disableAuth) {
    // Return mock success for demo
    return {
      data: {
        user: {
          id: 'demo-user',
          email,
          email_confirmed_at: new Date().toISOString(),
        },
        session: {
          access_token: 'demo-token',
          user: {
            id: 'demo-user',
            email,
          }
        }
      },
      error: null
    }
  }

  // Use Supabase signup
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // Skip email verification if configured
      emailRedirectTo: authConfig.skipEmailVerification 
        ? undefined 
        : `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`
    }
  })

  return { data, error }
}

// Sign in function
export async function signIn(email: string, password: string) {
  if (authConfig.disableAuth) {
    // Return mock success for demo
    return {
      data: {
        user: {
          id: 'demo-user',
          email,
          email_confirmed_at: new Date().toISOString(),
        },
        session: {
          access_token: 'demo-token',
          user: {
            id: 'demo-user',
            email,
          }
        }
      },
      error: null
    }
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  return { data, error }
}

// Get current session
export async function getSession() {
  if (authConfig.disableAuth) {
    return {
      data: {
        session: {
          access_token: 'demo-token',
          user: {
            id: 'demo-user',
            email: 'demo@example.com',
          }
        }
      },
      error: null
    }
  }

  return await supabase.auth.getSession()
}

// Sign out
export async function signOut() {
  if (authConfig.disableAuth) {
    return { error: null }
  }

  return await supabase.auth.signOut()
}