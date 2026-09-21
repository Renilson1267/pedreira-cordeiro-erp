import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import pb from '@/lib/pocketbase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Mail, ArrowLeft, CheckCircle2 } from 'lucide-react'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return

    try {
      setLoading(true)
      setErrorMsg('')
      await pb.collection('users').requestPasswordReset(email.trim())
      setSent(true)
    } catch (err: any) {
      console.error('Password reset request error:', err)
      // For security, show sent message or gentle note
      setSent(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen w-screen flex items-center justify-center bg-gradient-to-br from-[#FAF9F7] via-[#F3F1EC] to-[#E5E9E7] p-4">
      <Card className="w-full max-w-md bg-white border-[#ECEAE4] shadow-xl rounded-2xl overflow-hidden">
        <div className="h-2 bg-gradient-to-r from-teal-700 to-amber-500" />
        <CardContent className="p-8">
          <div className="mb-6">
            <Link
              to="/login"
              className="inline-flex items-center text-xs text-gray-500 hover:text-gray-800 mb-4"
            >
              <ArrowLeft className="w-3.5 h-3.5 mr-1" />
              Voltar ao login
            </Link>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">Recuperar senha</h1>
            <p className="text-xs text-gray-500 mt-1">
              Informe seu email cadastrado para receber o link de redefinição de acesso.
            </p>
          </div>

          {sent ? (
            <div className="text-center py-6 space-y-4">
              <div className="w-12 h-12 bg-green-100 text-green-700 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="font-semibold text-gray-900 text-sm">Email de recuperação enviado!</h3>
              <p className="text-xs text-gray-500 max-w-xs mx-auto">
                Se o e-mail informado estiver em nosso banco de dados, você receberá um link com
                instruções para criar uma nova senha.
              </p>
              <Link to="/login">
                <Button className="w-full mt-4 bg-teal-700 hover:bg-teal-800 text-white rounded-xl">
                  Retornar à página de login
                </Button>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {errorMsg && (
                <div className="p-3 rounded-xl bg-red-50 text-red-700 text-xs">{errorMsg}</div>
              )}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-gray-700">Email cadastrado</Label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                  <Input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu.email@empresa.com.br"
                    className="pl-9 bg-[#FAF9F7] border-[#ECEAE4] h-10"
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-teal-700 hover:bg-teal-800 text-white font-medium h-10 rounded-xl"
              >
                {loading ? 'Enviando link...' : 'Enviar link de recuperação'}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
