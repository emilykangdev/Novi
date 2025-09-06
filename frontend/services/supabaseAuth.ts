import { supabase } from '../config/supabase'
import type { User, RegisterForm } from '../types'

export const signUpUser = async (userData: RegisterForm): Promise<User> => {
  console.log('🚀 Supabase signup for:', userData.email)
  
  const { data, error } = await supabase.auth.signUp({
    email: userData.email,
    password: userData.password,
    options: {
      data: {
        name: userData.name,
      }
    }
  })

  if (error) {
    console.error('❌ Signup error:', error)
    throw new Error(error.message)
  }

  if (!data.user) {
    throw new Error('No user returned from signup')
  }

  return {
    id: data.user.id,
    email: data.user.email || userData.email,
    name: userData.name,
    createdAt: data.user.created_at || new Date().toISOString(),
  }
}

export const signInUser = async (email: string, password: string): Promise<User> => {
  console.log('🚀 Supabase signin for:', email)
  
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    console.error('❌ Signin error:', error)
    throw new Error(error.message)
  }

  if (!data.user) {
    throw new Error('No user returned from signin')
  }

  return {
    id: data.user.id,
    email: data.user.email || email,
    name: data.user.user_metadata?.name || 'User',
    createdAt: data.user.created_at || new Date().toISOString(),
  }
}

export const signOutUser = async (): Promise<void> => {
  const { error } = await supabase.auth.signOut()
  if (error) {
    throw new Error(error.message)
  }
}
