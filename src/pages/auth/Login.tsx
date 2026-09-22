import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { toast } from '@/hooks/use-toast'
import { Eye, EyeOff, Lock, Mail, ShieldAlert } from 'lucide-react'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('gcmixsje@gmail.com')
  const [password, setPassword] = useState('Skip@Pass')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')

    if (!email.trim() || !password.trim()) {
      setErrorMsg('Informe seu email e senha de acesso')
      return
    }

    try {
      setLoading(true)
      await login(email.trim(), password)
      toast({
        title: 'Bem-vindo ao Grupo Pedreira Cordeiro!',
        description: 'Login realizado com sucesso.',
      })
      navigate('/')
    } catch (err: any) {
      console.error('Login error:', err)
      setErrorMsg('Credenciais incorretas ou conta não encontrada.')
      toast({
        title: 'Erro de autenticação',
        description: 'Verifique seu e-mail e senha.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen w-screen flex items-center justify-center bg-gradient-to-br from-[#FAF9F7] via-[#F3F1EC] to-[#E5E9E7] relative overflow-hidden p-4">
      {/* Decorative floating shapes */}
      <div className="absolute top-10 left-10 w-72 h-72 bg-teal-200/30 rounded-full blur-3xl pointer-events-none animate-float" />
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-amber-200/25 rounded-full blur-3xl pointer-events-none" />

      <Card className="w-full max-w-md bg-white/95 backdrop-blur-md border-[#ECEAE4] shadow-2xl rounded-2xl relative z-10 overflow-hidden">
        <div className="h-2 bg-gradient-to-r from-teal-700 via-teal-600 to-amber-500" />
        <CardContent className="p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-teal-700 text-white shadow-lg shadow-teal-700/20 mb-3">
              <svg
                className="w-8 h-8"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">
              Pedreira Cordeiro ERP
            </h1>
            <p className="text-xs text-gray-500 mt-1">
              Grupo Pedreira Cordeiro • Gestão Inteligente e Integrada
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {errorMsg && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center space-x-2">
                <ShieldAlert className="w-4 h-4 shrink-0 text-red-600" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-700">Email corporativo</Label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                <Input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="colaborador@empresa.com.br"
                  className="pl-9 bg-[#FAF9F7] border-[#ECEAE4] h-10"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <Label className="text-xs font-semibold text-gray-700">Senha de acesso</Label>
                <Link to="/forgot-password" className="text-xs text-teal-700 hover:underline">
                  Esqueci minha senha
                </Link>
              </div>
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

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-teal-700 hover:bg-teal-800 text-white font-medium h-10 rounded-xl transition-all shadow-md shadow-teal-700/10 active:scale-[0.99] mt-2"
            >
              {loading ? 'Entrando no sistema...' : 'Entrar no ERP'}
            </Button>

            <div className="pt-4 text-center">
              <span className="text-[11px] text-gray-400 bg-gray-50 border border-gray-100 px-3 py-1 rounded-full">
                🔒 Acesso restrito a colaboradores autorizados
              </span>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
