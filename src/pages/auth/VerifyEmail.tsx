import React, { useState, useEffect } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import pb from '@/lib/pocketbase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react'

export default function VerifyEmail() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''
  const navigate = useNavigate()

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    if (!token) {
      setStatus('error')
      setErrorMessage('Token de verificação ausente na requisição')
      return
    }

    const verify = async () => {
      try {
        await pb.collection('users').confirmVerification(token)
        setStatus('success')
      } catch (err: any) {
        setStatus('error')
        setErrorMessage(err.message || 'Token expirado ou inválido')
      }
    }

    verify()
  }, [token])

  return (
    <div className="min-h-screen w-screen flex items-center justify-center bg-[#FAF9F7] p-4">
      <Card className="w-full max-w-md bg-white border-[#ECEAE4] shadow-xl rounded-2xl overflow-hidden">
        <div className="h-2 bg-gradient-to-r from-teal-700 to-amber-500" />
        <CardContent className="p-8 text-center">
          {status === 'loading' && (
            <div className="py-8 space-y-3">
              <Loader2 className="w-8 h-8 animate-spin text-teal-700 mx-auto" />
              <p className="text-sm text-gray-600 font-medium">
                Validando confirmação de e-mail...
              </p>
            </div>
          )}

          {status === 'success' && (
            <div className="py-4 space-y-4">
              <div className="w-14 h-14 bg-green-100 text-green-700 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">Email confirmado com sucesso!</h2>
              <p className="text-xs text-gray-500">
                Sua conta está verificada e pronta para uso corporativo.
              </p>
              <Button
                onClick={() => navigate('/login')}
                className="w-full bg-teal-700 hover:bg-teal-800 text-white rounded-xl"
              >
                Ir para o login
              </Button>
            </div>
          )}

          {status === 'error' && (
            <div className="py-4 space-y-4">
              <div className="w-14 h-14 bg-red-100 text-red-700 rounded-full flex items-center justify-center mx-auto">
                <AlertTriangle className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">Falha na verificação</h2>
              <p className="text-xs text-red-600">{errorMessage}</p>
              <Link to="/login">
                <Button variant="outline" className="w-full border-[#ECEAE4] rounded-xl mt-2">
                  Voltar ao login
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
