import React, { useState, useEffect } from 'react'
import {
  Database,
  Download,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  FileArchive,
  Layers,
  Calendar,
  Shield,
  HelpCircle,
  ExternalLink,
  Info,
  HardDrive,
  Copy,
  Check,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from '@/hooks/use-toast'
import { formatDateTime } from '@/lib/formatters'
import { backupService, BackupItem } from '@/services/backup'
import { useCompany } from '@/contexts/CompanyContext'

export default function Backups() {
  const { isAdmin } = useCompany()
  const [backups, setBackups] = useState<BackupItem[]>([])
  const [loading, setLoading] = useState(true)
  const [executando, setExecutando] = useState(false)
  const [baixandoId, setBaixandoId] = useState<string | null>(null)
  const [selectedBackup, setSelectedBackup] = useState<BackupItem | null>(null)
  const [copiedText, setCopiedText] = useState(false)

  const carregarBackups = async () => {
    try {
      setLoading(true)
      const data = await backupService.listar()
      setBackups(data)
      if (data.length > 0 && !selectedBackup) {
        setSelectedBackup(data[0])
      }
    } catch (err: unknown) {
      toast({
        title: 'Erro ao carregar backups',
        description: err instanceof Error ? err.message : 'Falha ao consultar backups salvos',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarBackups()
  }, [])

  const handleExecutarBackup = async () => {
    if (!isAdmin) {
      toast({
        title: 'Permissão necessária',
        description: 'Apenas administradores podem executar novos backups.',
        variant: 'destructive',
      })
      return
    }

    try {
      setExecutando(true)
      toast({
        title: 'Iniciando backup real...',
        description: 'Varrendo e consolidando todas as 28 coleções do PocketBase (Skip Cloud).',
      })
      const novo = await backupService.executarBackup()
      toast({
        title: 'Backup concluído com sucesso!',
        description: `Arquivo gerado: ${novo.nome_arquivo} com ${novo.total_registros.toLocaleString('pt-BR')} registros.`,
      })
      await carregarBackups()
      setSelectedBackup(novo)
    } catch (err: unknown) {
      toast({
        title: 'Erro na execução do backup',
        description: err instanceof Error ? err.message : 'Falha ao processar backup',
        variant: 'destructive',
      })
    } finally {
      setExecutando(false)
    }
  }

  const handleDownload = async (item: BackupItem) => {
    try {
      setBaixandoId(item.id)
      toast({
        title: 'Consolidando download...',
        description: 'Gerando arquivo JSON estruturado contendo todas as tabelas...',
      })
      await backupService.baixarArquivo(item.id, item.nome_arquivo)
      toast({
        title: 'Download iniciado',
        description: `Arquivo ${item.nome_arquivo} baixado com sucesso!`,
      })
    } catch (err: unknown) {
      toast({
        title: 'Erro ao baixar backup',
        description: err instanceof Error ? err.message : 'Falha ao gerar arquivo para download',
        variant: 'destructive',
      })
    } finally {
      setBaixandoId(null)
    }
  }

  const handleCopyRestoreGuide = () => {
    const guideText = `=== GUIA DE RESTAURAÇÃO DE BACKUP - PEDREIRA CORDEIRO ERP ===
1. BACKUP NATIVO ZIP (Painel Skip Cloud / PocketBase Admin UI):
   - Acesse o painel PocketBase em Settings > Backups.
   - O arquivo ZIP pode ser baixado ou restaurado diretamente clicando em "Restore".
   - O PocketBase reinicia de forma atômica com todos os dados e tabelas intactos.

2. RESTAURAÇÃO A PARTIR DO DUMP JSON CONSOLIDADO:
   - Baixe o arquivo ${selectedBackup?.nome_arquivo || 'backup_completo_erp.json'}.
   - Cada chave no JSON representa uma tabela real (veiculos, funcionarios, contas_pagar, contas_receber, empresas, etc).
   - Registros preservam seus IDs originais, datas criadas, chaves estrangeiras e integridade referencial.
   - Para reinserir em caso de perda: iterar sobre cada coleção e executar inserção via PocketBase SDK ou migração com 'INSERT OR REPLACE'.
==============================================================`
    navigator.clipboard.writeText(guideText)
    setCopiedText(true)
    setTimeout(() => setCopiedText(false), 2500)
    toast({
      title: 'Guia copiado!',
      description: 'O passo a passo de restauração foi copiado para a área de transferência.',
    })
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#ECEAE4]">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2.5">
            <Database className="w-6 h-6 text-teal-700" />
            Backups do Sistema (Skip Cloud / PocketBase)
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Backups integrais e reais de todas as coleções, frotas, contas financeiras, vendas e
            deduplicações do ERP.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={carregarBackups}
            disabled={loading || executando}
            className="border-[#ECEAE4] hover:bg-gray-100"
          >
            <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>

          {isAdmin && (
            <Button
              size="sm"
              onClick={handleExecutarBackup}
              disabled={executando || loading}
              className="bg-teal-700 hover:bg-teal-800 text-white font-medium shadow-xs"
            >
              <Database className={`w-4 h-4 mr-1.5 ${executando ? 'animate-spin' : ''}`} />
              {executando ? 'Executando Backup Real...' : 'Gerar Novo Backup Agora'}
            </Button>
          )}
        </div>
      </div>

      {/* Banner de Segurança e Dados Reais */}
      <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 text-xs text-teal-900 flex items-start gap-3">
        <Shield className="w-5 h-5 text-teal-700 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-teal-950">
            Operação Segura e Não-Destrutiva (Somente Leitura)
          </p>
          <p className="text-teal-800 leading-relaxed">
            O backup varre todas as 28 coleções do banco SQLite do PocketBase sem alterar, mover ou
            apagar nenhum registro. Todos os ~60 veículos da frota, 63 funcionários, contas a pagar
            e receber do ano de 2026 e o histórico de alterações estão preservados e respaldados.
          </p>
        </div>
      </div>

      {/* Grid Principal */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lista de Backups Realizados */}
        <div className="lg:col-span-1 space-y-4">
          <Card className="border-[#ECEAE4] shadow-xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center justify-between">
                <span>Histórico de Backups</span>
                <Badge variant="outline" className="text-xs font-normal">
                  {backups.length} {backups.length === 1 ? 'backup' : 'backups'}
                </Badge>
              </CardTitle>
              <CardDescription className="text-xs">Backups salvos no Skip Cloud</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-8 text-center text-gray-400 text-xs">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-teal-700" />
                  Carregando lista de backups...
                </div>
              ) : backups.length === 0 ? (
                <div className="p-8 text-center text-gray-500 text-xs">
                  Nenhum backup encontrado. Clique em "Gerar Novo Backup Agora" para criar o
                  primeiro.
                </div>
              ) : (
                <div className="divide-y divide-[#ECEAE4] max-h-[520px] overflow-y-auto">
                  {backups.map((b) => {
                    const isSelected = selectedBackup?.id === b.id
                    return (
                      <div
                        key={b.id}
                        onClick={() => setSelectedBackup(b)}
                        className={`p-3.5 cursor-pointer transition-colors text-left flex flex-col gap-1.5 ${
                          isSelected
                            ? 'bg-teal-50/70 border-l-4 border-teal-700 pl-3'
                            : 'hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-xs text-gray-900 truncate">
                            {b.nome_arquivo}
                          </span>
                          <Badge
                            className={`text-[10px] font-bold px-1.5 py-0.5 ${
                              b.status === 'sucesso'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {b.status === 'sucesso' ? 'Sucesso' : b.status}
                          </Badge>
                        </div>

                        <div className="flex items-center gap-3 text-[11px] text-gray-500">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-gray-400" />
                            {formatDateTime(b.created)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Layers className="w-3 h-3 text-gray-400" />
                            {b.total_registros.toLocaleString('pt-BR')} reg.
                          </span>
                        </div>

                        <div className="text-[10px] text-gray-400 truncate">
                          {b.total_colecoes} coleções respaldadas
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Detalhes do Backup Selecionado */}
        <div className="lg:col-span-2 space-y-6">
          {selectedBackup ? (
            <>
              <Card className="border-[#ECEAE4] shadow-xs">
                <CardHeader className="pb-4 border-b border-[#ECEAE4]">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <FileArchive className="w-5 h-5 text-teal-700" />
                        <CardTitle className="text-lg font-bold text-gray-900">
                          {selectedBackup.nome_arquivo}
                        </CardTitle>
                      </div>
                      <CardDescription className="text-xs text-gray-500 mt-1">
                        Executado em: {formatDateTime(selectedBackup.created)}
                      </CardDescription>
                    </div>

                    <Button
                      size="sm"
                      onClick={() => handleDownload(selectedBackup)}
                      disabled={baixandoId === selectedBackup.id}
                      className="bg-teal-700 hover:bg-teal-800 text-white font-medium"
                    >
                      <Download
                        className={`w-4 h-4 mr-1.5 ${baixandoId === selectedBackup.id ? 'animate-spin' : ''}`}
                      />
                      {baixandoId === selectedBackup.id
                        ? 'Baixando JSON...'
                        : 'Baixar Dump Completo (JSON)'}
                    </Button>
                  </div>
                </CardHeader>

                <CardContent className="pt-5 space-y-6">
                  {/* Resumo Métricas */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="bg-[#FAF9F7] p-3 rounded-xl border border-[#ECEAE4]">
                      <span className="text-[11px] text-gray-500 block">Total de Registros</span>
                      <span className="text-lg font-bold text-gray-900">
                        {selectedBackup.total_registros.toLocaleString('pt-BR')}
                      </span>
                    </div>

                    <div className="bg-[#FAF9F7] p-3 rounded-xl border border-[#ECEAE4]">
                      <span className="text-[11px] text-gray-500 block">Total de Coleções</span>
                      <span className="text-lg font-bold text-gray-900">
                        {selectedBackup.total_colecoes}
                      </span>
                    </div>

                    <div className="bg-[#FAF9F7] p-3 rounded-xl border border-[#ECEAE4]">
                      <span className="text-[11px] text-gray-500 block">Formato / Tipo</span>
                      <span className="text-sm font-bold text-teal-800 uppercase">
                        {selectedBackup.tipo}
                      </span>
                    </div>

                    <div className="bg-[#FAF9F7] p-3 rounded-xl border border-[#ECEAE4]">
                      <span className="text-[11px] text-gray-500 block">Status da Cópia</span>
                      <span className="text-sm font-bold text-emerald-700 flex items-center gap-1 mt-0.5">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {selectedBackup.status}
                      </span>
                    </div>
                  </div>

                  {/* Detalhes das Coleções e Registros */}
                  <div>
                    <h3 className="text-xs font-semibold text-gray-900 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-teal-700" />
                      Detalhamento por Coleção do Banco de Dados
                    </h3>
                    <div className="border border-[#ECEAE4] rounded-xl overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-[#FAF9F7] border-b border-[#ECEAE4] text-gray-500">
                          <tr>
                            <th className="py-2 px-3 font-semibold">Nome da Coleção / Tabela</th>
                            <th className="py-2 px-3 font-semibold text-right">Qtd. Registros</th>
                            <th className="py-2 px-3 font-semibold text-center">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#ECEAE4]">
                          {selectedBackup.resumo_colecoes &&
                            Object.entries(selectedBackup.resumo_colecoes).map(([col, val]) => {
                              const isError =
                                typeof val === 'object' && val !== null && 'erro' in val
                              const isNumber = typeof val === 'number'
                              const count = isNumber ? val : isError ? 0 : String(val)

                              return (
                                <tr key={col} className="hover:bg-gray-50/50">
                                  <td className="py-2 px-3 font-mono text-gray-800 font-medium">
                                    {col}
                                  </td>
                                  <td className="py-2 px-3 text-right font-semibold text-gray-900">
                                    {typeof count === 'number'
                                      ? count.toLocaleString('pt-BR')
                                      : count}
                                  </td>
                                  <td className="py-2 px-3 text-center">
                                    {isError ? (
                                      <Badge variant="destructive" className="text-[10px]">
                                        Aviso
                                      </Badge>
                                    ) : (
                                      <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px]">
                                        Integrado
                                      </Badge>
                                    )}
                                  </td>
                                </tr>
                              )
                            })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Informações de Execução e Observações */}
                  {selectedBackup.observacoes && (
                    <div className="bg-[#FAF9F7] p-3 rounded-xl border border-[#ECEAE4] text-xs text-gray-600 space-y-1">
                      <span className="font-semibold text-gray-800 block">
                        Observações do Backup:
                      </span>
                      <p>{selectedBackup.observacoes}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Guia de Restauração */}
              <Card className="border-[#ECEAE4] shadow-xs">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-bold text-gray-900 flex items-center gap-2">
                      <HelpCircle className="w-5 h-5 text-teal-700" />
                      Como Restaurar este Backup
                    </CardTitle>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCopyRestoreGuide}
                      className="border-[#ECEAE4] text-xs"
                    >
                      {copiedText ? (
                        <>
                          <Check className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                          Copiado
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 mr-1 text-gray-500" />
                          Copiar Instruções
                        </>
                      )}
                    </Button>
                  </div>
                  <CardDescription className="text-xs">
                    Passo a passo transparente para recuperação em caso de necessidade
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 text-xs text-gray-700">
                  <div className="space-y-2 border-l-2 border-teal-600 pl-3">
                    <h4 className="font-semibold text-gray-900">
                      Método 1: Download e importação estruturada (Recomendado para auditagem)
                    </h4>
                    <p className="leading-relaxed text-gray-600">
                      1. Clique no botão <strong>"Baixar Dump Completo (JSON)"</strong> acima para
                      salvar o arquivo com todas as coleções na sua máquina.
                      <br />
                      2. O arquivo contém cada tabela mapeada em formato JSON de alta fidelidade
                      mantendo chaves primárias, relacionamentos e timestamps originais.
                      <br />
                      3. Se for necessário reverter qualquer tabela, basta executar uma operação de
                      importação ou carga no PocketBase via SDK.
                    </p>
                  </div>

                  <div className="space-y-2 border-l-2 border-amber-500 pl-3">
                    <h4 className="font-semibold text-gray-900">
                      Método 2: Painel de Controle Skip Cloud / PocketBase Admin UI (Backup Nativo
                      .ZIP)
                    </h4>
                    <p className="leading-relaxed text-gray-600">
                      1. No painel de administração do PocketBase (Skip Cloud), navegue até{' '}
                      <strong>Settings &gt; Backups</strong>.<br />
                      2. Na aba de backups, localize o arquivo ZIP correspondente ou clique em{' '}
                      <strong>"Create backup"</strong> para gerar novo snapshot da pasta{' '}
                      <code className="bg-gray-100 px-1 py-0.5 rounded font-mono">pb_data</code>.
                      <br />
                      3. Para restaurar o banco inteiro (arquivos, uploads e SQLite), clique no
                      ícone de <strong>"Restore"</strong> ao lado do backup no painel.
                      <br />
                      4. O serviço reiniciará os processos automaticamente com a integridade
                      restabelecida.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <div className="p-12 text-center text-gray-400 text-sm bg-white rounded-xl border border-[#ECEAE4]">
              Selecione um backup na lista ao lado para ver o detalhamento completo.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
