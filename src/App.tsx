import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from '@/contexts/AuthContext'
import { CompanyProvider } from '@/contexts/CompanyContext'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import Layout from '@/components/Layout'
import { Toaster } from '@/components/ui/toaster'

// Pages
import Login from '@/pages/auth/Login'
import ForgotPassword from '@/pages/auth/ForgotPassword'
import ResetPassword from '@/pages/auth/ResetPassword'
import VerifyEmail from '@/pages/auth/VerifyEmail'
import AcceptInvite from '@/pages/auth/AcceptInvite'

import Index from '@/pages/Index'
import Vendas from '@/pages/financeiro/Vendas'
import EntregaPage from '@/pages/financeiro/Entrega'
import ContasPagar from '@/pages/financeiro/ContasPagar'
import ContasReceber from '@/pages/financeiro/ContasReceber'
import Conciliacao from '@/pages/financeiro/Conciliacao'
import DRE from '@/pages/financeiro/DRE'

import Clientes from '@/pages/cadastros/Clientes'
import Fornecedores from '@/pages/cadastros/Fornecedores'
import Produtos from '@/pages/cadastros/Produtos'
import PlanoContas from '@/pages/cadastros/PlanoContas'
import CentrosCusto from '@/pages/cadastros/CentrosCusto'

import Relatorios from '@/pages/relatorios/Relatorios'
import Perfil from '@/pages/perfil/Perfil'
import NotFound from '@/pages/NotFound'

// Frotas
import Veiculos from '@/pages/frotas/Veiculos'
import Abastecimentos from '@/pages/frotas/Abastecimentos'
import Manutencoes from '@/pages/frotas/Manutencoes'
import Entregas from '@/pages/frotas/Entregas'
import Funcionarios from '@/pages/rh/Funcionarios'
import HorasExtras from '@/pages/rh/HorasExtras'
import ManualPage from '@/pages/Manual'
import Operadores from '@/pages/cadastros/Operadores'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CompanyProvider>
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
              <Route path="/cadastros/operadores" element={<Operadores />} />

              {/* Relatórios */}
              <Route path="/relatorios" element={<Relatorios />} />

              {/* Perfil */}
              <Route path="/perfil" element={<Perfil />} />
            </Route>

            {/* 404 Route */}
            <Route path="*" element={<NotFound />} />
          </Routes>
          <Toaster />
        </CompanyProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
