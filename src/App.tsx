import React, { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from '@/contexts/AuthContext'
import { CompanyProvider } from '@/contexts/CompanyContext'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import Layout from '@/components/Layout'
import { Toaster } from '@/components/ui/toaster'
import { PageLoadingFallback } from '@/components/PageLoadingFallback'
import { ErrorBoundary } from '@/components/ErrorBoundary'

// Telas principais com carregamento sob demanda (Code-Splitting por rota)
// Mantemos a rota inicial "/" rápida carregando sob demanda apenas o que o usuário visita.
const Login = lazy(() => import('@/pages/auth/Login'))
const ForgotPassword = lazy(() => import('@/pages/auth/ForgotPassword'))
const ResetPassword = lazy(() => import('@/pages/auth/ResetPassword'))
const VerifyEmail = lazy(() => import('@/pages/auth/VerifyEmail'))
const AcceptInvite = lazy(() => import('@/pages/auth/AcceptInvite'))

const Index = lazy(() => import('@/pages/Index'))
const Vendas = lazy(() => import('@/pages/financeiro/Vendas'))
const EntregaPage = lazy(() => import('@/pages/financeiro/Entrega'))
const ContasPagar = lazy(() => import('@/pages/financeiro/ContasPagar'))
const ContasReceber = lazy(() => import('@/pages/financeiro/ContasReceber'))
const Conciliacao = lazy(() => import('@/pages/financeiro/Conciliacao'))
const DRE = lazy(() => import('@/pages/financeiro/DRE'))

const Clientes = lazy(() => import('@/pages/cadastros/Clientes'))
const Fornecedores = lazy(() => import('@/pages/cadastros/Fornecedores'))
const Produtos = lazy(() => import('@/pages/cadastros/Produtos'))
const PlanoContas = lazy(() => import('@/pages/cadastros/PlanoContas'))
const CentrosCusto = lazy(() => import('@/pages/cadastros/CentrosCusto'))
const FormasRecebimento = lazy(() => import('@/pages/cadastros/FormasRecebimento'))
const Operadores = lazy(() => import('@/pages/cadastros/Operadores'))
const Backups = lazy(() => import('@/pages/cadastros/Backups'))

const Relatorios = lazy(() => import('@/pages/relatorios/Relatorios'))
const Perfil = lazy(() => import('@/pages/perfil/Perfil'))
const NotFound = lazy(() => import('@/pages/NotFound'))

// Frotas & RH
const Veiculos = lazy(() => import('@/pages/frotas/Veiculos'))
const Abastecimentos = lazy(() => import('@/pages/frotas/Abastecimentos'))
const Manutencoes = lazy(() => import('@/pages/frotas/Manutencoes'))
const Entregas = lazy(() => import('@/pages/frotas/Entregas'))
const Funcionarios = lazy(() => import('@/pages/rh/Funcionarios'))
const HorasExtras = lazy(() => import('@/pages/rh/HorasExtras'))
const ManualPage = lazy(() => import('@/pages/Manual'))

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CompanyProvider>
          <ErrorBoundary screenName="Aplicação Geral">
            <Suspense fallback={<PageLoadingFallback />}>
              <Routes>
                {/* Public Auth Routes */}
                <Route path="/login" element={<Login />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/verify-email" element={<VerifyEmail />} />
                <Route path="/convite" element={<AcceptInvite />} />

                {/* Authenticated Application Routes with Main Layout */}
                <Route
                  element={
                    <ProtectedRoute>
                      <Layout />
                    </ProtectedRoute>
                  }
                >
                  <Route path="/" element={<Index />} />
                  <Route path="/manual" element={<ManualPage />} />

                  {/* Financeiro */}
                  <Route path="/financeiro/vendas" element={<Vendas />} />
                  <Route path="/financeiro/entrega" element={<EntregaPage />} />
                  <Route path="/financeiro/pagar" element={<ContasPagar />} />
                  <Route path="/financeiro/receber" element={<ContasReceber />} />
                  <Route path="/financeiro/conciliacao" element={<Conciliacao />} />
                  <Route path="/financeiro/dre" element={<DRE />} />

                  {/* Frotas & Pedreira */}
                  <Route path="/frotas/veiculos" element={<Veiculos />} />
                  <Route path="/frotas/abastecimentos" element={<Abastecimentos />} />
                  <Route path="/frotas/manutencoes" element={<Manutencoes />} />
                  <Route path="/frotas/entregas" element={<Entregas />} />

                  {/* Recursos Humanos (RH) */}
                  <Route path="/rh/funcionarios" element={<Funcionarios />} />
                  <Route path="/rh/horas-extras" element={<HorasExtras />} />

                  {/* Cadastros */}
                  <Route path="/cadastros/clientes" element={<Clientes />} />
                  <Route path="/cadastros/fornecedores" element={<Fornecedores />} />
                  <Route path="/cadastros/produtos" element={<Produtos />} />
                  <Route path="/cadastros/plano-de-contas" element={<PlanoContas />} />
                  <Route path="/cadastros/centros-de-custo" element={<CentrosCusto />} />
                  <Route path="/cadastros/formas-recebimento" element={<FormasRecebimento />} />
                  <Route path="/cadastros/operadores" element={<Operadores />} />
                  <Route path="/cadastros/backups" element={<Backups />} />

                  {/* Relatórios */}
                  <Route path="/relatorios" element={<Relatorios />} />

                  {/* Perfil */}
                  <Route path="/perfil" element={<Perfil />} />
                </Route>

                {/* 404 Route */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
            <Toaster />
          </ErrorBoundary>
        </CompanyProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
