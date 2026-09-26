import React, { createContext, useContext, useEffect, useState } from 'react'
import pb from '@/lib/pocketbase/client'
import type { User } from '@/types/erp'

interface AuthContextType {
  user: User | null
  loading: boolean
  login: (email: string, pass: string) => Promise<void>
  logout: () => void
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState<boolean>(true)

  const syncUser = () => {
    if (pb.authStore.isValid && pb.authStore.record) {
      setUser({
        id: pb.authStore.record.id,
        email: pb.authStore.record.email || '',
        name: pb.authStore.record.name || 'Usuário',
        avatar: pb.authStore.record.avatar,
        verified: pb.authStore.record.verified,
      })
    } else {
      setUser(null)
    }
  }

  useEffect(() => {
    syncUser()
    setLoading(false)

    const unsubscribe = pb.authStore.onChange(() => {
      syncUser()
    })

    return () => {
      unsubscribe()
    }
  }, [])

  const login = async (email: string, pass: string) => {
    const authData = await pb.collection('users').authWithPassword(email, pass)
    // Se o usuário estiver marcado como inativo no banco, desloga imediatamente e impede acesso
    const recordAtivo = authData?.record?.ativo
    if (recordAtivo === false) {
      pb.authStore.clear()
      setUser(null)
      const err = new Error('Usuário inativo. Entre em contato com o administrador do sistema.')
      ;(err as any).isInativo = true
      throw err
    }
    syncUser()
  }

  const logout = () => {
    pb.authStore.clear()
    setUser(null)
  }

  const refreshUser = async () => {
    if (pb.authStore.isValid) {
      try {
        await pb.collection('users').authRefresh()
        syncUser()
      } catch {
        logout()
      }
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
