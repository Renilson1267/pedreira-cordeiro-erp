import React, { useState } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useCompany } from '@/contexts/CompanyContext'
import { CompanySwitcherModal } from '@/components/CompanySwitcherModal'
import { GlobalSearchModal } from '@/components/GlobalSearchModal'
import { getInitials } from '@/lib/formatters'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  LayoutDashboard,
  ArrowDownLeft,
  ArrowUpRight,
  Landmark,
  LineChart,
  Users,
  Truck,
  Package,
  Layers,
  FileBarChart2,
  ChevronDown,
  Search,
  Bell,
  Menu,
  X,
  LogOut,
  User,
  KeyRound,
  Shield,
  Building,
  Fuel,
  Wrench,
  Construction,
  PieChart,
  Clock,
} from 'lucide-react'

export default function Layout() {
  const { user, logout } = useAuth()
  const { currentEmpresa, currentRole, isReadOnly } = useCompany()
  const [switcherOpen, setSwitcherOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const navGroups = [
    {
      group: 'Visão Geral',
      items: [{ label: 'Dashboard', path: '/', icon: LayoutDashboard }],
    },
    {
      group: 'Financeiro',
      items: [
        { label: 'Contas a Pagar', path: '/financeiro/pagar', icon: ArrowDownLeft },
        { label: 'Contas a Receber', path: '/financeiro/receber', icon: ArrowUpRight },
        { label: 'Conciliação', path: '/financeiro/conciliacao', icon: Landmark },
        { label: 'DRE Gerencial', path: '/financeiro/dre', icon: LineChart },
      ],
    },
    {
      group: 'Frotas & Pedreira',
      items: [
        { label: 'Veículos & Máquinas', path: '/frotas/veiculos', icon: Construction },
        { label: 'Abastecimentos', path: '/frotas/abastecimentos', icon: Fuel },
        { label: 'Manutenções', path: '/frotas/manutencoes', icon: Wrench },
        { label: 'Entregas', path: '/frotas/entregas', icon: Truck },
      ],
    },
    {
      group: 'Recursos Humanos',
      items: [
        { label: 'Funcionários & Equipe', path: '/rh/funcionarios', icon: Users },
        { label: 'Folha de Horas Extras', path: '/rh/horas-extras', icon: Clock },
      ],
    },
    {
      group: 'Cadastros',
      items: [
        { label: 'Clientes', path: '/cadastros/clientes', icon: Users },
        { label: 'Fornecedores', path: '/cadastros/fornecedores', icon: Truck },
        { label: 'Produtos e Serviços', path: '/cadastros/produtos', icon: Package },
        { label: 'Plano de Contas', path: '/cadastros/plano-de-contas', icon: Layers },
        { label: 'Centros de Custo', path: '/cadastros/centros-de-custo', icon: PieChart },
      ],
    },
    {
      group: 'Estratégico',
      items: [{ label: 'Relatórios', path: '/relatorios', icon: FileBarChart2 }],
    },
  ]

  return (
    <div className="flex h-screen bg-[#FAF9F7] text-gray-800 overflow-hidden font-sans">
      {/* Mobile Drawer Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-xs z-40 lg:hidden transition-opacity"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar Desktop & Mobile */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-[#ECEAE4] flex flex-col transition-transform duration-200 ease-in-out lg:static lg:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Logo */}
        <div className="h-16 px-5 border-b border-[#ECEAE4] flex items-center justify-between">
          <div
            className="flex items-center space-x-2.5 cursor-pointer"
            onClick={() => navigate('/')}
          >
            <div className="w-9 h-9 rounded-xl bg-teal-700 flex items-center justify-center text-white shadow-sm shadow-teal-700/20">
              <svg
                className="w-5 h-5"
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
            <div>
              <span className="font-bold text-lg text-gray-900 tracking-tight">
                Pedreira Cordeiro
              </span>
              <span className="text-[10px] text-teal-700 font-semibold uppercase tracking-wider block -mt-1">
                Grupo Pedreira Cordeiro
              </span>
            </div>
          </div>
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="lg:hidden text-gray-400 hover:text-gray-600 p-1 rounded-md"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Company Switcher Trigger */}
        <div className="p-3 border-b border-[#ECEAE4]">
          <button
            onClick={() => setSwitcherOpen(true)}
            className="w-full flex items-center justify-between p-2 rounded-xl bg-[#FAF9F7] hover:bg-gray-100/80 border border-[#ECEAE4] transition-all text-left group"
          >
            <div className="flex items-center space-x-2.5 overflow-hidden">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-xs"
                style={{ backgroundColor: currentEmpresa?.cor || '#0F766E' }}
              >
                {getInitials(currentEmpresa?.nome_fantasia)}
              </div>
              <div className="overflow-hidden">
                <div className="text-xs font-semibold text-gray-900 truncate">
                  {currentEmpresa?.nome_fantasia || 'Grupo Pedreira Cordeiro'}
                </div>
                <div className="text-[10px] text-gray-500 font-mono truncate">
                  {currentEmpresa?.cnpj || '05.581.899/0001-05'}
                </div>
              </div>
            </div>
            <ChevronDown className="w-4 h-4 text-gray-400 group-hover:text-gray-700 shrink-0 transition-colors" />
          </button>

          {/* Role badge */}
          <div className="mt-1.5 flex items-center justify-between px-1">
            <span className="text-[10px] text-gray-400 font-medium">Papel atual:</span>
            <span
              className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${
                currentRole === 'admin'
                  ? 'bg-amber-100 text-amber-800'
                  : currentRole === 'financeiro'
                    ? 'bg-teal-100 text-teal-800'
                    : 'bg-gray-100 text-gray-700'
              }`}
            >
              {currentRole}
            </span>
          </div>
        </div>

        {/* Navigation Items */}
        <div className="flex-1 overflow-y-auto py-3 px-3 space-y-4">
          {navGroups.map((group) => (
            <div key={group.group}>
              <div className="px-3 mb-1.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                {group.group}
              </div>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon
                  const isActive =
                    item.path === '/'
                      ? location.pathname === '/'
                      : location.pathname.startsWith(item.path)

                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center space-x-3 px-3 py-2 rounded-xl text-sm font-medium transition-all relative ${
                        isActive
                          ? 'bg-teal-50 text-teal-800 font-semibold'
                          : 'text-gray-600 hover:bg-[#FAF9F7] hover:text-gray-900'
                      }`}
                    >
                      {isActive && (
                        <span className="absolute left-1 w-1 h-5 bg-teal-700 rounded-full" />
                      )}
                      <Icon className={`w-4 h-4 ${isActive ? 'text-teal-700' : 'text-gray-400'}`} />
                      <span>{item.label}</span>
                    </NavLink>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        {/* User Card & Dropdown */}
        <div className="p-3 border-t border-[#ECEAE4]">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-[#FAF9F7] transition-all text-left">
                <div className="flex items-center space-x-2.5 overflow-hidden">
                  <div className="w-8 h-8 rounded-full bg-teal-100 text-teal-800 flex items-center justify-center font-bold text-xs shrink-0">
                    {getInitials(user?.name)}
                  </div>
                  <div className="overflow-hidden">
                    <div className="text-xs font-semibold text-gray-900 truncate">
                      {user?.name || 'Administrador'}
                    </div>
                    <div className="text-[10px] text-gray-500 truncate">{user?.email}</div>
                  </div>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-56 bg-white border-[#ECEAE4] rounded-xl p-1 shadow-lg"
            >
              <DropdownMenuLabel className="text-xs text-gray-500 font-normal px-2 py-1.5">
                Conectado como <strong className="text-gray-800">{user?.name}</strong>
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-[#ECEAE4]" />
              <DropdownMenuItem
                onClick={() => navigate('/perfil')}
                className="cursor-pointer text-xs rounded-lg hover:bg-gray-100"
              >
                <User className="w-3.5 h-3.5 mr-2 text-teal-600" />
                Meu Perfil
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => navigate('/perfil?tab=seguranca')}
                className="cursor-pointer text-xs rounded-lg hover:bg-gray-100"
              >
                <KeyRound className="w-3.5 h-3.5 mr-2 text-amber-600" />
                Alterar Senha
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-[#ECEAE4]" />
              <DropdownMenuItem
                onClick={handleLogout}
                className="cursor-pointer text-xs text-red-600 focus:text-red-700 rounded-lg hover:bg-red-50"
              >
                <LogOut className="w-3.5 h-3.5 mr-2" />
                Sair do Pedreira Cordeiro
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      {/* Main Wrapper */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-[#ECEAE4] px-4 sm:px-6 flex items-center justify-between shrink-0 z-10">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-lg text-gray-500 hover:bg-[#FAF9F7]"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="hidden sm:flex items-center space-x-2 text-xs text-gray-500 font-medium">
              <Building className="w-3.5 h-3.5 text-teal-600" />
              <span>{currentEmpresa?.nome_fantasia || 'Pedreira Cordeiro'}</span>
              <span>•</span>
              <span className="capitalize">
                {location.pathname.replace('/', '').replace('/', ' / ') || 'Dashboard'}
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-2 sm:space-x-3">
            {/* Global Search Button */}
            <button
              onClick={() => setSearchOpen(true)}
              className="hidden md:flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-[#FAF9F7] border border-[#ECEAE4] text-xs text-gray-500 hover:text-gray-900 hover:border-gray-300 transition-all w-56 lg:w-72"
            >
              <Search className="w-3.5 h-3.5 text-gray-400" />
              <span className="flex-1 text-left">Buscar clientes, contas...</span>
              <kbd className="hidden lg:inline-block px-1.5 py-0.5 text-[10px] font-mono bg-white rounded border border-[#ECEAE4] text-gray-400">
                ⌘K
              </kbd>
            </button>

            {/* Mobile Search Icon */}
            <button
              onClick={() => setSearchOpen(true)}
              className="md:hidden p-2 rounded-lg text-gray-500 hover:bg-[#FAF9F7]"
            >
              <Search className="w-4 h-4" />
            </button>

            {/* Notifications mock / bell */}
            <div className="relative">
              <button
                title="Notificações"
                className="p-2 rounded-lg text-gray-500 hover:bg-[#FAF9F7] hover:text-gray-700 transition-colors relative"
                onClick={() => {}}
              >
                <Bell className="w-4 h-4" />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-amber-500" />
              </button>
            </div>

            {/* Read-only banner pill if applicable */}
            {isReadOnly && (
              <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-200">
                <Shield className="w-3 h-3 mr-1" />
                Modo Leitura
              </span>
            )}
          </div>
        </header>

        {/* Scrollable Page Body */}
        <main className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 min-w-0">
          <div className="max-w-[1400px] mx-auto animate-fade-in">
            <Outlet />
          </div>
        </main>

        {/* Footer */}
        <footer className="h-10 border-t border-[#ECEAE4] bg-white px-6 flex items-center justify-between text-xs text-gray-400 shrink-0">
          <div>
            Pedreira Cordeiro ERP • v1.0 •{' '}
            {currentEmpresa?.nome_fantasia || 'Grupo Pedreira Cordeiro'}
          </div>
          <div className="font-medium text-gray-500 truncate max-w-[240px]">
            {currentEmpresa?.nome_fantasia || 'Pedreira Cordeiro'}
          </div>
        </footer>
      </div>

      {/* Modals */}
      <CompanySwitcherModal open={switcherOpen} onOpenChange={setSwitcherOpen} />
      <GlobalSearchModal open={searchOpen} onOpenChange={setSearchOpen} />
    </div>
  )
}
