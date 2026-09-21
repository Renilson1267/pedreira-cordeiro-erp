import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCompany } from '@/contexts/CompanyContext'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { formatCurrency, formatDate } from '@/lib/formatters'
import pb from '@/lib/pocketbase/client'
import {
  Search,
  Users,
  Truck,
  ArrowUpRight,
  ArrowDownLeft,
  FileText,
  Construction,
} from 'lucide-react'

interface GlobalSearchModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({ open, onOpenChange }) => {
  const { currentEmpresa } = useCompany()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [clientes, setClientes] = useState<any[]>([])
  const [fornecedores, setFornecedores] = useState<any[]>([])
  const [contasPagar, setContasPagar] = useState<any[]>([])
  const [contasReceber, setContasReceber] = useState<any[]>([])
  const [veiculos, setVeiculos] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) {
      setQuery('')
      setClientes([])
      setFornecedores([])
      setContasPagar([])
      setContasReceber([])
      setVeiculos([])
      return
    }
  }, [open])

  useEffect(() => {
    if (!query.trim() || query.length < 2 || !currentEmpresa) {
      setClientes([])
      setFornecedores([])
      setContasPagar([])
      setContasReceber([])
      setVeiculos([])
      return
    }

    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const q = query.trim()
        const [c, f, cp, cr, v] = await Promise.all([
          pb.collection('clientes').getList(1, 5, {
            filter: `empresa_id = '${currentEmpresa.id}' && (nome ~ '${q}' || cnpj_cpf ~ '${q}')`,
          }),
          pb.collection('fornecedores').getList(1, 5, {
            filter: `empresa_id = '${currentEmpresa.id}' && (nome ~ '${q}' || cnpj_cpf ~ '${q}')`,
          }),
          pb.collection('contas_pagar').getList(1, 5, {
            filter: `empresa_id = '${currentEmpresa.id}' && descricao ~ '${q}'`,
          }),
          pb.collection('contas_receber').getList(1, 5, {
            filter: `empresa_id = '${currentEmpresa.id}' && descricao ~ '${q}'`,
          }),
          pb.collection('veiculos').getList(1, 5, {
            filter: `empresa_id = '${currentEmpresa.id}' && (codigo_interno ~ '${q}' || modelo ~ '${q}' || placa ~ '${q}')`,
          }),
        ])

        setClientes(c.items)
        setFornecedores(f.items)
        setContasPagar(cp.items)
        setContasReceber(cr.items)
        setVeiculos(v.items)
      } catch (err) {
        console.error('Search error:', err)
      } finally {
        setLoading(false)
      }
    }, 250)

    return () => clearTimeout(timer)
  }, [query, currentEmpresa])

  const handleSelect = (path: string) => {
    onOpenChange(false)
    navigate(path)
  }

  const hasResults =
    clientes.length > 0 ||
    fornecedores.length > 0 ||
    contasPagar.length > 0 ||
    contasReceber.length > 0 ||
    veiculos.length > 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[620px] bg-white rounded-2xl border-[#ECEAE4] p-0 overflow-hidden shadow-2xl">
        <div className="p-4 border-b border-[#ECEAE4] flex items-center gap-3">
          <Search className="w-5 h-5 text-gray-400" />
          <Input
            autoFocus
            placeholder="Buscar clientes, fornecedores, contas a pagar ou receber..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="border-0 focus-visible:ring-0 text-base shadow-none p-0 h-9"
          />
        </div>

        <div className="max-h-[420px] overflow-y-auto p-4 space-y-4">
          {loading && (
            <div className="text-center py-6 text-gray-400 text-sm">Buscando registros...</div>
          )}

          {!loading && query.length >= 2 && !hasResults && (
            <div className="text-center py-8 text-gray-400 text-sm">
              Nenhum resultado encontrado para &quot;{query}&quot;.
            </div>
          )}

          {!loading && query.length < 2 && (
            <div className="text-center py-8 text-gray-400 text-xs">
              Digite pelo menos 2 caracteres para pesquisar em toda a empresa.
            </div>
          )}

          {clientes.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-teal-600" />
                Clientes
              </div>
              <div className="space-y-1">
                {clientes.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => handleSelect(`/cadastros/clientes?id=${c.id}`)}
                    className="p-2.5 rounded-lg hover:bg-[#FAF9F7] cursor-pointer flex justify-between items-center transition-colors border border-transparent hover:border-[#ECEAE4]"
                  >
                    <div>
                      <div className="text-sm font-medium text-gray-800">{c.nome}</div>
                      <div className="text-xs text-gray-400">
                        {c.cnpj_cpf || c.email || 'Sem documento'}
                      </div>
                    </div>
                    <span className="text-xs text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md font-medium">
                      Ver cliente
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {fornecedores.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5 text-blue-600" />
                Fornecedores
              </div>
              <div className="space-y-1">
                {fornecedores.map((f) => (
                  <div
                    key={f.id}
                    onClick={() => handleSelect(`/cadastros/fornecedores?id=${f.id}`)}
                    className="p-2.5 rounded-lg hover:bg-[#FAF9F7] cursor-pointer flex justify-between items-center transition-colors border border-transparent hover:border-[#ECEAE4]"
                  >
                    <div>
                      <div className="text-sm font-medium text-gray-800">{f.nome}</div>
                      <div className="text-xs text-gray-400">
                        {f.cnpj_cpf || f.email || 'Sem documento'}
                      </div>
                    </div>
                    <span className="text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md font-medium">
                      Ver fornecedor
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {contasPagar.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <ArrowDownLeft className="w-3.5 h-3.5 text-red-600" />
                Contas a Pagar
              </div>
              <div className="space-y-1">
                {contasPagar.map((cp) => (
                  <div
                    key={cp.id}
                    onClick={() => handleSelect(`/financeiro/pagar?id=${cp.id}`)}
                    className="p-2.5 rounded-lg hover:bg-[#FAF9F7] cursor-pointer flex justify-between items-center transition-colors border border-transparent hover:border-[#ECEAE4]"
                  >
                    <div>
                      <div className="text-sm font-medium text-gray-800">{cp.descricao}</div>
                      <div className="text-xs text-gray-400">
                        Vencimento: {formatDate(cp.vencimento)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-red-600">
                        {formatCurrency(cp.valor)}
                      </div>
                      <div className="text-[10px] text-gray-400 uppercase">{cp.status}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {contasReceber.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <ArrowUpRight className="w-3.5 h-3.5 text-green-600" />
                Contas a Receber
              </div>
              <div className="space-y-1">
                {contasReceber.map((cr) => (
                  <div
                    key={cr.id}
                    onClick={() => handleSelect(`/financeiro/receber?id=${cr.id}`)}
                    className="p-2.5 rounded-lg hover:bg-[#FAF9F7] cursor-pointer flex justify-between items-center transition-colors border border-transparent hover:border-[#ECEAE4]"
                  >
                    <div>
                      <div className="text-sm font-medium text-gray-800">{cr.descricao}</div>
                      <div className="text-xs text-gray-400">
                        Vencimento: {formatDate(cr.vencimento)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-green-600">
                        {formatCurrency(cr.valor)}
                      </div>
                      <div className="text-[10px] text-gray-400 uppercase">{cr.status}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {veiculos.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Construction className="w-3.5 h-3.5 text-amber-600" />
                Veículos & Máquinas (Frota Pedreira)
              </div>
              <div className="space-y-1">
                {veiculos.map((v) => (
                  <div
                    key={v.id}
                    onClick={() => handleSelect(`/frotas/veiculos`)}
                    className="p-2.5 rounded-lg hover:bg-[#FAF9F7] cursor-pointer flex justify-between items-center transition-colors border border-transparent hover:border-[#ECEAE4]"
                  >
                    <div>
                      <div className="text-sm font-medium text-gray-800 flex items-center gap-2">
                        <span className="font-mono text-teal-800 font-bold">
                          {v.codigo_interno}
                        </span>
                        <span>•</span>
                        <span>{v.modelo}</span>
                      </div>
                      <div className="text-xs text-gray-400">
                        {v.tipo} • {v.medidor_atual} {v.tipo_medidor === 'km' ? 'km' : 'horas'}
                      </div>
                    </div>
                    <span className="text-xs text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md font-medium">
                      Ver frota
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
