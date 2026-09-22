import React, { useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import pb from '@/lib/pocketbase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Lock, Eye, EyeOff, CheckCircle2 } from 'lucide-react'

export default function ResetPassword() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''
  const navigate = useNavigate()

  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== passwordConfirm) {
      setErrorMsg('As senhas não coincidem')
      return
    }
    if (password.length < 8) {
      setErrorMsg('A senha deve conter no mínimo 8 caracteres')
      return
    }

    try {
      setLoading(true)
      setErrorMsg('')
      await pb.collection('users').confirmPasswordReset(token, password, passwordConfirm)
      setSuccess(true)
    } catch (err: any) {
      setErrorMsg(err.message || 'Token de redefinição inválido ou expirado')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen w-screen flex items-center justify-center bg-[#FAF9F7] p-4">
      <Card className="w-full max-w-md bg-white border-[#ECEAE4] shadow-xl rounded-2xl overflow-hidden">
        <div className="h-2 bg-gradient-to-r from-teal-700 to-amber-500" />
        <CardContent className="p-8">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 mb-1">
            Definir nova senha
          </h1>
          <p className="text-xs text-gray-500 mb-6">
            Crie uma nova senha segura para acessar sua conta no Pedreira Cordeiro ERP.
          </p>

          {success ? (
            <div className="text-center py-6 space-y-4">
              <div className="w-12 h-12 bg-green-100 text-green-700 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="font-semibold text-gray-900 text-sm">Senha redefinida com sucesso!</h3>
              <p className="text-xs text-gray-500">
                Você já pode fazer login com sua nova credencial.
              </p>
              <Button
                onClick={() => navigate('/login')}
                className="w-full bg-teal-700 hover:bg-teal-800 text-white rounded-xl"
              >
                Ir para o login
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {errorMsg && (
                <div className="p-3 rounded-xl bg-red-50 text-red-700 text-xs">{errorMsg}</div>
              )}

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-gray-700">
                  Nova senha (mínimo 8 caracteres)
                </Label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="pl-9 pr-10 bg-[#FAF9F7] border-[#ECEAE4] h-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-gray-700">
                  Confirmação da nova senha
                </Label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={passwordConfirm}
                    onChange={(e) => setPasswordConfirm(e.target.value)}
                    placeholder="••••••••"
                    className="pl-9 bg-[#FAF9F7] border-[#ECEAE4] h-10"
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-teal-700 hover:bg-teal-800 text-white font-medium h-10 rounded-xl"
              >
                {loading ? 'Salvando...' : 'Salvar nova senha'}
              </Button>

              <div className="text-center pt-2">
                <Link to="/login" className="text-xs text-gray-500 hover:text-gray-900">
                  Cancelar e voltar ao login
                </Link>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
