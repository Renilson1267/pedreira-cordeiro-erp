import React, { useState, useEffect } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import pb from '@/lib/pocketbase/client'
import { useAuth } from '@/contexts/AuthContext'
import { useCompany } from '@/contexts/CompanyContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { toast } from '@/hooks/use-toast'
import { CheckCircle2, UserCheck, Loader2, AlertCircle } from 'lucide-react'

export default function AcceptInvite() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''
  const { user } = useAuth()
  const { reloadEmpresas } = useCompany()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [companyName, setCompanyName] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  const handleAccept = async () => {
    if (!token) {
      setErrorMsg('Token do convite ausente')
      return
    }

    try {
      setLoading(true)
      setErrorMsg('')
      const res = await pb.send('/backend/v1/convites/aceitar', {
        method: 'POST',
        body: { token },
      })

      if (res?.success) {
        setSuccess(true)
        setCompanyName(res.empresa?.nome_fantasia || 'Empresa')
        await reloadEmpresas()
        toast({ title: 'Convite aceito com sucesso!' })
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao aceitar convite ou convite já expirado')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user && token && !success) {
      handleAccept()
    }
  }, [user, token])

  return (
    <div className="min-h-screen w-screen flex items-center justify-center bg-[#FAF9F7] p-4">
      <Card className="w-full max-w-md bg-white border-[#ECEAE4] shadow-xl rounded-2xl overflow-hidden">
        <div className="h-2 bg-gradient-to-r from-teal-700 to-amber-500" />
        <CardContent className="p-8 text-center">
          <div className="w-12 h-12 bg-teal-100 text-teal-700 rounded-full flex items-center justify-center mx-auto mb-4">
            <UserCheck className="w-6 h-6" />
          </div>

          <h1 className="text-xl font-bold text-gray-900 mb-2">
            Convite para o Pedreira Cordeiro ERP
          </h1>
          <p className="text-xs text-gray-500 mb-6">
            Você foi convidado a participar da gestão empresarial do Grupo Pedreira Cordeiro.
          </p>

          {errorMsg && (
            <div className="p-3 mb-4 rounded-xl bg-red-50 text-red-700 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {success ? (
            <div className="space-y-4">
              <div className="w-12 h-12 bg-green-100 text-green-700 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <p className="text-sm font-semibold text-gray-800">
                Você agora é membro de {companyName || 'sua nova empresa'}!
              </p>
              <Button
                onClick={() => navigate('/dashboard')}
                className="w-full bg-teal-700 hover:bg-teal-800 text-white rounded-xl"
              >
                Acessar o Painel Principal
              </Button>
            </div>
          ) : (
            <div>
              {!user ? (
                <div className="space-y-3">
                  <p className="text-xs text-gray-500">
                    Faça login com sua conta existente para vincular o acesso à empresa.
                  </p>
                  <Link to={`/login?redirect=/convite?token=${token}`}>
                    <Button className="w-full bg-teal-700 hover:bg-teal-800 text-white rounded-xl">
                      Fazer Login para Aceitar
                    </Button>
                  </Link>
                </div>
              ) : (
                <Button
                  onClick={handleAccept}
                  disabled={loading}
                  className="w-full bg-teal-700 hover:bg-teal-800 text-white rounded-xl"
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" /> Aceitando convite...
                    </span>
                  ) : (
                    'Confirmar e Entrar na Empresa'
                  )}
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
