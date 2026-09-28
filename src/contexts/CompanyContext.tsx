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

const LOCAL_STORAGE_KEY = 'pedreira_cordeiro_current_empresa_id'

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

      // Também garantir que todas as empresas autorizadas (incluindo Treinamento) sejam exibidas se o usuário for admin ou tiver acesso
      const allEmps = await pb.collection('empresas').getFullList<Empresa>({
        sort: 'nome_fantasia',
      })

      // Se o usuário tem papel admin em qualquer empresa, ele pode ver e navegar em todas as empresas cadastradas (matriz, filiais e treinamento)
      const userIsAdminSomewhere = userMembros.some((m) => m.role === 'admin')
      const empresasParaExibir = userIsAdminSomewhere || emps.length === 0 ? allEmps : emps

      setEmpresas(empresasParaExibir)

      if (empresasParaExibir.length > 0) {
        const savedId = localStorage.getItem(LOCAL_STORAGE_KEY)
        // Priorizar: 1º escolha salva em localStorage (se pertencer à lista de autorizadas),
        // 2º empresa padrão configurada no perfil do usuário (empresa_padrao_id),
        // 3º primeira empresa autorizada.
        const userEmpresaPadraoId = (user as any)?.empresa_padrao_id
        const matched =
          (savedId ? empresasParaExibir.find((e) => e.id === savedId) : null) ||
          (userEmpresaPadraoId
            ? empresasParaExibir.find((e) => e.id === userEmpresaPadraoId)
            : null) ||
          empresasParaExibir[0]

        setCurrentEmpresa(matched)

        const activeMembro = userMembros.find((m) => m.empresa_id === matched.id)
        if (activeMembro) {
          setCurrentRole(activeMembro.role)
        } else if (userIsAdminSomewhere) {
          // Se é admin no sistema e entrou em uma filial/treinamento sem membro explícito ainda
          setCurrentRole('admin')
        } else {
          setCurrentRole('leitura')
        }
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
      if (activeMembro) {
        setCurrentRole(activeMembro.role)
      } else {
        const userIsAdmin = membros.some((m) => m.role === 'admin')
        setCurrentRole(userIsAdmin ? 'admin' : 'leitura')
      }
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
