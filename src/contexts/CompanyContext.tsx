import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import pb from '@/lib/pocketbase/client'
import { useAuth } from './AuthContext'
import type { Empresa, EmpresaMembro, UserRole } from '@/types/erp'

interface CompanyContextType {
  currentEmpresa: Empresa | null
  currentRole: UserRole
  empresas: Empresa[]
  membros: EmpresaMembro[]
  loadingEmpresas: boolean
  selectEmpresa: (empresaId: string) => void
  reloadEmpresas: () => Promise<void>
  isAdmin: boolean
  canEdit: boolean // admin or financeiro
  isReadOnly: boolean
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined)

const LOCAL_STORAGE_KEY = 'novagest_current_empresa_id'

export const CompanyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth()
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [membros, setMembros] = useState<EmpresaMembro[]>([])
  const [currentEmpresa, setCurrentEmpresa] = useState<Empresa | null>(null)
  const [currentRole, setCurrentRole] = useState<UserRole>('leitura')
  const [loadingEmpresas, setLoadingEmpresas] = useState<boolean>(true)

  const reloadEmpresas = useCallback(async () => {
    if (!user) {
      setEmpresas([])
      setMembros([])
      setCurrentEmpresa(null)
      setLoadingEmpresas(false)
      return
    }

    try {
      setLoadingEmpresas(true)
      // Fetch memberships of current user
      const userMembros = await pb.collection('empresa_membros').getFullList<EmpresaMembro>({
        filter: `usuario_id = '${user.id}'`,
        expand: 'empresa_id',
      })

      setMembros(userMembros)

      const emps: Empresa[] = []
      userMembros.forEach((m) => {
        if (m.expand?.empresa_id) {
          emps.push(m.expand.empresa_id)
        }
      })

      // If user is admin in system or has no specific expand, fetch all companies if list allowed
      if (emps.length === 0) {
        const allEmps = await pb.collection('empresas').getFullList<Empresa>({
          sort: 'nome_fantasia',
        })
        setEmpresas(allEmps)
        if (allEmps.length > 0) {
          const savedId = localStorage.getItem(LOCAL_STORAGE_KEY)
          const matched = allEmps.find((e) => e.id === savedId) || allEmps[0]
          setCurrentEmpresa(matched)
          setCurrentRole('admin')
        }
      } else {
        setEmpresas(emps)
        const savedId = localStorage.getItem(LOCAL_STORAGE_KEY)
        const matched = emps.find((e) => e.id === savedId) || emps[0]
        setCurrentEmpresa(matched)

        const activeMembro = userMembros.find((m) => m.empresa_id === matched.id)
        setCurrentRole(activeMembro?.role || 'leitura')
      }
    } catch (err) {
      console.error('Error fetching companies:', err)
    } finally {
      setLoadingEmpresas(false)
    }
  }, [user])

  useEffect(() => {
    reloadEmpresas()
  }, [reloadEmpresas])

  const selectEmpresa = (empresaId: string) => {
    const found = empresas.find((e) => e.id === empresaId)
    if (found) {
      setCurrentEmpresa(found)
      localStorage.setItem(LOCAL_STORAGE_KEY, found.id)
      const activeMembro = membros.find((m) => m.empresa_id === found.id)
      setCurrentRole(activeMembro?.role || 'admin')
    }
  }

  const isAdmin = currentRole === 'admin'
  const canEdit = currentRole === 'admin' || currentRole === 'financeiro'
  const isReadOnly = currentRole === 'leitura'

  return (
    <CompanyContext.Provider
      value={{
        currentEmpresa,
        currentRole,
        empresas,
        membros,
        loadingEmpresas,
        selectEmpresa,
        reloadEmpresas,
        isAdmin,
        canEdit,
        isReadOnly,
      }}
    >
      {children}
    </CompanyContext.Provider>
  )
}

export const useCompany = () => {
  const ctx = useContext(CompanyContext)
  if (!ctx) throw new Error('useCompany must be used within a CompanyProvider')
  return ctx
}
