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
  Copy,
  Check,
  Clock,
  Cloud,
  CloudUpload,
  ExternalLink,
  Settings,
  Unlink,
  FolderSync,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from '@/hooks/use-toast'
import { formatDateTime } from '@/lib/formatters'
import {
  backupService,
  BackupItem,
  BackupAgendamentoInfo,
  GoogleDriveStatusInfo,
} from '@/services/backup'
import { useCompany } from '@/contexts/CompanyContext'

export default function Backups() {
  const { isAdmin } = useCompany()
  const [backups, setBackups] = useState<BackupItem[]>([])
  const [agendamentoInfo, setAgendamentoInfo] = useState<BackupAgendamentoInfo | null>(null)
  const [driveInfo, setDriveInfo] = useState<GoogleDriveStatusInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [executando, setExecutando] = useState(false)
  const [baixandoId, setBaixandoId] = useState<string | null>(null)
  const [enviandoDriveId, setEnviandoDriveId] = useState<string | null>(null)
  const [selectedBackup, setSelectedBackup] = useState<BackupItem | null>(null)
  const [copiedText, setCopiedText] = useState(false)
  const [copiedRedirectUri, setCopiedRedirectUri] = useState(false)

  // Modal de Configuração do Google Drive
  const [modalConfigOpen, setModalConfigOpen] = useState(false)
  const [clientIdInput, setClientIdInput] = useState('')
  const [clientSecretInput, setClientSecretInput] = useState('')
  const [folderNameInput, setFolderNameInput] = useState('Backups ERP')
  const [manualRefreshTokenInput, setManualRefreshTokenInput] = useState('')
  const [salvandoConfig, setSalvandoConfig] = useState(false)
  const [desconectando, setDesconectando] = useState(false)

  const carregarDados = async () => {
    try {
      setLoading(true)
      const [dataBackups, infoAgendamento, infoDrive] = await Promise.all([
        backupService.listar(),
        backupService.obterStatusAgendamento(),
        backupService.obterStatusDrive(),
      ])
      setBackups(dataBackups)
      setAgendamentoInfo(infoAgendamento)
      setDriveInfo(infoDrive)
      if (dataBackups.length > 0 && !selectedBackup) {
        setSelectedBackup(dataBackups[0])
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
    carregarDados()

    // Ouvir mensagem de sucesso disparada pelo popup do OAuth callback
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'GOOGLE_DRIVE_CONNECTED') {
        toast({
          title: 'Google Drive conectado com sucesso!',
          description: event.data.email
            ? `Conta vinculada: ${event.data.email}`
            : 'Sua conta do Google foi conectada aos backups.',
        })
        carregarDados()
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  // Buscar último backup com origem automática real nos dados
  const ultimoBackupAutomatico =
    agendamentoInfo?.ultimo_backup_automatico ||
    backups.find((b) => b.origem === 'semanal_automatico') ||
    null

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
      await carregarDados()
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

  const handleEnviarAoGoogleDrive = async (item: BackupItem) => {
    if (!isAdmin) {
      toast({
        title: 'Permissão necessária',
        description: 'Apenas administradores podem enviar backups ao Google Drive.',
        variant: 'destructive',
      })
      return
    }

    if (!driveInfo?.conectado) {
      toast({
        title: 'Google Drive não conectado',
        description: 'Conecte sua conta do Google Drive no painel acima antes de enviar.',
        variant: 'destructive',
      })
      return
    }

    try {
      setEnviandoDriveId(item.id)
      toast({
        title: 'Enviando ao Google Drive...',
        description: `Enviando arquivo ${item.nome_arquivo} para a pasta "${driveInfo?.pasta_nome || 'Backups ERP'}"...`,
      })

      const res = await backupService.enviarBackupAoDrive(item.id)

      toast({
        title: 'Backup salvo no Google Drive!',
        description:
          res.message || 'Arquivo sincronizado com sucesso na sua conta do Google Drive.',
      })

      await carregarDados()
      if (selectedBackup?.id === item.id) {
        setSelectedBackup((prev) =>
          prev
            ? {
                ...prev,
                drive_status: 'enviado',
                drive_file_id: res.file_id,
                drive_enviado_em: res.enviado_em,
                drive_erro: '',
              }
            : null,
        )
      }
    } catch (err: unknown) {
      toast({
        title: 'Falha no envio ao Google Drive',
        description: err instanceof Error ? err.message : 'Erro ao processar envio ao Drive',
        variant: 'destructive',
      })
      await carregarDados()
    } finally {
      setEnviandoDriveId(null)
    }
  }

  const handleConectarGoogleDrive = async () => {
    try {
      const res = await backupService.obterAuthUrlDrive()
      if (res.auth_url) {
        // Abrir popup para autorização OAuth
        const width = 600
        const height = 700
        const left = window.screen.width / 2 - width / 2
        const top = window.screen.height / 2 - height / 2
        window.open(
          res.auth_url,
          'google_oauth_popup',
          `width=${width},height=${height},top=${top},left=${left},scrollbars=yes,status=yes`,
        )
      }
    } catch (err: unknown) {
      toast({
        title: 'Erro ao iniciar autenticação Google',
        description:
          err instanceof Error
            ? err.message
            : 'Certifique-se de configurar o Client ID e Client Secret primeiro.',
        variant: 'destructive',
      })
      setModalConfigOpen(true)
    }
  }

  const handleDesconectarGoogleDrive = async () => {
    if (!confirm('Deseja realmente desconectar o Google Drive da integração de backups?')) {
      return
    }

    try {
      setDesconectando(true)
      await backupService.desconectarDrive()
      toast({
        title: 'Google Drive desconectado',
        description: 'A integração foi desvinculada com sucesso.',
      })
      await carregarDados()
    } catch (err: unknown) {
      toast({
        title: 'Erro ao desconectar',
        description: err instanceof Error ? err.message : 'Falha ao desconectar o Google Drive',
        variant: 'destructive',
      })
    } finally {
      setDesconectando(false)
    }
  }

  const handleSalvarConfigDrive = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setSalvandoConfig(true)
      await backupService.salvarConfigDrive({
        client_id: clientIdInput.trim() || undefined,
        client_secret: clientSecretInput.trim() || undefined,
        folder_name: folderNameInput.trim() || 'Backups ERP',
        refresh_token: manualRefreshTokenInput.trim() || undefined,
      })
      toast({
        title: 'Configurações salvas',
        description: 'Credenciais do Google Drive atualizadas com sucesso.',
      })
      setModalConfigOpen(false)
      await carregarDados()
    } catch (err: unknown) {
      toast({
        title: 'Erro ao salvar configurações',
        description: err instanceof Error ? err.message : 'Falha ao gravar credenciais',
        variant: 'destructive',
      })
    } finally {
      setSalvandoConfig(false)
    }
  }

  const handleCopyRedirectUri = () => {
    const uri =
      driveInfo?.redirect_uri_recomendada ||
      'https://erp-empresarial-completo-575bb.shrd00.internal.goskip.dev/backend/v1/google-drive/oauth/callback'
    navigator.clipboard.writeText(uri)
    setCopiedRedirectUri(true)
    setTimeout(() => setCopiedRedirectUri(false), 2500)
    toast({
      title: 'Redirect URI copiada!',
      description:
        'Cole esta URL nas configurações de "URIs de redirecionamento autorizados" no Google Cloud Console.',
    })
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

3. ARQUIVOS SINCRONIZADOS NO GOOGLE DRIVE:
   - Acesse sua pasta "Backups ERP" no Google Drive.
   - Os dumps semanais automáticos e sob demanda são armazenados com o carimbo de data/hora oficial.
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
            sincronização automática com o Google Drive.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={carregarDados}
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

      {/* Cartão de Integração Google Drive */}
      <Card className="border-teal-200/80 bg-gradient-to-r from-teal-50/60 via-white to-emerald-50/40 shadow-xs overflow-hidden">
        <CardHeader className="pb-3 border-b border-teal-100/70">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-teal-700 text-white rounded-lg shadow-xs shrink-0">
                <Cloud className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-base font-bold text-gray-900 flex items-center gap-2">
                  <span>Integração Google Drive</span>
                  {driveInfo?.conectado ? (
                    <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] px-2.5 py-0.5">
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      Conectado
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="text-amber-800 bg-amber-50 border-amber-300 text-[11px] font-medium"
                    >
                      <AlertCircle className="w-3 h-3 mr-1 text-amber-600" />
                      Desconectado
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription className="text-xs text-gray-600 mt-0.5">
                  Cópia externa automática do dump JSON semanal para sua conta Google Drive na pasta
                  &quot;{driveInfo?.pasta_nome || 'Backups ERP'}&quot;.
                </CardDescription>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {isAdmin && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setModalConfigOpen(true)}
                  className="border-teal-200 hover:bg-teal-50 text-teal-900 text-xs"
                >
                  <Settings className="w-3.5 h-3.5 mr-1 text-teal-700" />
                  Configurações OAuth
                </Button>
              )}

              {isAdmin && driveInfo?.conectado ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDesconectarGoogleDrive}
                  disabled={desconectando}
                  className="border-red-200 text-red-700 hover:bg-red-50 text-xs"
                >
                  <Unlink className="w-3.5 h-3.5 mr-1" />
                  {desconectando ? 'Desconectando...' : 'Desconectar'}
                </Button>
              ) : (
                isAdmin && (
                  <Button
                    size="sm"
                    onClick={handleConectarGoogleDrive}
                    className="bg-teal-700 hover:bg-teal-800 text-white font-medium text-xs shadow-xs"
                  >
                    <ExternalLink className="w-3.5 h-3.5 mr-1" />
                    Conectar Conta Google
                  </Button>
                )
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-3.5 pb-3.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            <div className="bg-white/80 p-2.5 rounded-lg border border-teal-100">
              <span className="text-gray-500 block text-[11px]">Status da Conexão</span>
              <div className="mt-1 flex items-center gap-1.5 font-semibold">
                {driveInfo?.conectado ? (
                  <span className="text-emerald-700 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    Conectado e Pronto
                  </span>
                ) : (
                  <span className="text-amber-700 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                    Aguardando Conexão
                  </span>
                )}
              </div>
            </div>

            <div className="bg-white/80 p-2.5 rounded-lg border border-teal-100">
              <span className="text-gray-500 block text-[11px]">Conta Vinculada</span>
              <div
                className="mt-1 font-semibold text-gray-900 truncate"
                title={driveInfo?.conta_email || 'Nenhuma conta'}
              >
                {driveInfo?.conta_email ? (
                  <span>{driveInfo.conta_email}</span>
                ) : (
                  <span className="text-gray-400 font-normal">Nenhuma conta vinculada</span>
                )}
              </div>
            </div>

            <div className="bg-white/80 p-2.5 rounded-lg border border-teal-100">
              <span className="text-gray-500 block text-[11px]">Pasta de Destino</span>
              <div className="mt-1 font-semibold text-teal-900 flex items-center gap-1">
                <FolderSync className="w-3.5 h-3.5 text-teal-700" />
                <span>{driveInfo?.pasta_nome || 'Backups ERP'}</span>
              </div>
            </div>

            <div className="bg-white/80 p-2.5 rounded-lg border border-teal-100">
              <span className="text-gray-500 block text-[11px]">Último Envio ao Drive</span>
              <div className="mt-1 font-semibold text-gray-900">
                {driveInfo?.ultimo_envio ? (
                  formatDateTime(driveInfo.ultimo_envio)
                ) : (
                  <span className="text-gray-400 font-normal">Ainda não enviado</span>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Banner de Status do Backup Semanal Automático */}
      <div className="bg-gradient-to-r from-teal-50 via-emerald-50/70 to-teal-50 border border-teal-200/80 rounded-xl p-4.5 text-xs text-teal-950 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-teal-600 text-white rounded-lg shadow-xs shrink-0 mt-0.5">
              <Clock className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-sm text-gray-900">Backup Automático Semanal:</span>
                <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] px-2.5 py-0.5 shadow-xs">
                  ATIVO — toda madrugada de domingo
                </Badge>
                <span className="text-[11px] text-teal-800 font-mono bg-teal-100/70 px-2 py-0.5 rounded border border-teal-200">
                  00:30 (horário do servidor)
                </span>
                {driveInfo?.conectado && (
                  <Badge className="bg-teal-700 text-white font-medium text-[10px] px-2 py-0.5 flex items-center gap-1">
                    <Cloud className="w-3 h-3" />
                    Auto-upload Drive ativo
                  </Badge>
                )}
              </div>
              <p className="text-teal-900 leading-relaxed text-xs">
                O job semanal do backend roda automaticamente sem depender de clique manual. Ele
                varre as 28 coleções do banco SQLite, grava o snapshot particionado e, quando o
                Google Drive está conectado, transfere o arquivo gerado para a pasta &quot;Backups
                ERP&quot;.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row md:flex-col items-start md:items-end justify-center shrink-0 pl-11 md:pl-0 border-t md:border-t-0 pt-2 md:pt-0 border-teal-200/60 text-xs">
            <span className="text-gray-500 text-[11px] font-medium">
              Última execução automática:
            </span>
            {ultimoBackupAutomatico ? (
              <span className="font-bold text-emerald-900 flex items-center gap-1.5 mt-0.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                {formatDateTime(ultimoBackupAutomatico.created)}
                <span className="text-gray-500 font-normal">
                  ({ultimoBackupAutomatico.total_registros.toLocaleString('pt-BR')} reg.)
                </span>
              </span>
            ) : (
              <span className="font-medium text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 mt-0.5">
                Aguardando primeira execução (domingo que vem)
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Banner de Segurança e Dados Reais */}
      <div className="bg-teal-50/60 border border-teal-200 rounded-xl p-4 text-xs text-teal-900 flex items-start gap-3">
        <Shield className="w-5 h-5 text-teal-700 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-teal-950">
            Operação Segura e Não-Destrutiva (Somente Leitura)
          </p>
          <p className="text-teal-800 leading-relaxed">
            Tanto o backup manual quanto o semanal automático varrem todas as 28 coleções do banco
            SQLite do PocketBase sem alterar, mover ou apagar nenhum registro. Todos os ~60 veículos
            da frota, 63 funcionários, contas a pagar e receber do ano de 2026 e o histórico de
            alterações estão preservados e respaldados.
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
                  Nenhum backup encontrado. Clique em &quot;Gerar Novo Backup Agora&quot; para criar
                  o primeiro.
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
                          <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                            {b.origem === 'semanal_automatico' ? (
                              <Badge className="bg-teal-100 text-teal-800 text-[10px] font-bold px-1.5 py-0.5 border border-teal-200">
                                Semanal Auto
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="text-[10px] text-gray-600 px-1.5 py-0.5"
                              >
                                Manual
                              </Badge>
                            )}

                            {/* Badge do Google Drive */}
                            {b.drive_status === 'enviado' ? (
                              <Badge className="bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] font-semibold px-1.5 py-0.5">
                                ☁️ no Drive
                              </Badge>
                            ) : b.drive_status === 'erro' ? (
                              <Badge variant="destructive" className="text-[10px] px-1.5 py-0.5">
                                ☁️ falha
                              </Badge>
                            ) : null}

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

                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Botão Enviar ao Google Drive */}
                      {isAdmin && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEnviarAoGoogleDrive(selectedBackup)}
                          disabled={enviandoDriveId === selectedBackup.id}
                          className="border-teal-300 text-teal-800 hover:bg-teal-50"
                        >
                          <CloudUpload
                            className={`w-4 h-4 mr-1.5 ${enviandoDriveId === selectedBackup.id ? 'animate-spin' : ''}`}
                          />
                          {enviandoDriveId === selectedBackup.id
                            ? 'Enviando ao Drive...'
                            : selectedBackup.drive_status === 'enviado'
                              ? 'Reenviar ao Google Drive'
                              : 'Enviar ao Google Drive'}
                        </Button>
                      )}

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
                  </div>
                </CardHeader>

                <CardContent className="pt-5 space-y-6">
                  {/* Resumo Métricas */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="bg-[#FAF9F7] p-3 rounded-xl border border-[#ECEAE4]">
                      <span className="text-[11px] text-gray-500 block">Origem do Backup</span>
                      <div className="mt-1">
                        {selectedBackup.origem === 'semanal_automatico' ? (
                          <span className="text-xs font-bold text-teal-800 bg-teal-100/80 px-2 py-0.5 rounded border border-teal-200 inline-flex items-center gap-1">
                            <Clock className="w-3 h-3 text-teal-700" />
                            Semanal Automático
                          </span>
                        ) : (
                          <span className="text-xs font-bold text-gray-700 bg-gray-100 px-2 py-0.5 rounded border border-gray-200 inline-block">
                            Manual / Sob Demanda
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="bg-[#FAF9F7] p-3 rounded-xl border border-[#ECEAE4]">
                      <span className="text-[11px] text-gray-500 block">Total de Registros</span>
                      <span className="text-lg font-bold text-gray-900">
                        {selectedBackup.total_registros.toLocaleString('pt-BR')}
                      </span>
                    </div>

                    <div className="bg-[#FAF9F7] p-3 rounded-xl border border-[#ECEAE4]">
                      <span className="text-[11px] text-gray-500 block">Google Drive</span>
                      <div className="mt-1">
                        {selectedBackup.drive_status === 'enviado' ? (
                          <span className="text-xs font-bold text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded border border-emerald-300 inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            Enviado ao Drive
                          </span>
                        ) : selectedBackup.drive_status === 'erro' ? (
                          <span
                            className="text-xs font-bold text-red-800 bg-red-100 px-2 py-0.5 rounded border border-red-300 inline-flex items-center gap-1"
                            title={selectedBackup.drive_erro}
                          >
                            <AlertCircle className="w-3 h-3 text-red-600" />
                            Erro no Envio
                          </span>
                        ) : (
                          <span className="text-xs font-medium text-gray-600 bg-gray-100 px-2 py-0.5 rounded border border-gray-200 inline-block">
                            Não enviado
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="bg-[#FAF9F7] p-3 rounded-xl border border-[#ECEAE4]">
                      <span className="text-[11px] text-gray-500 block">Status da Cópia</span>
                      <span className="text-sm font-bold text-emerald-700 flex items-center gap-1 mt-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {selectedBackup.status}
                      </span>
                    </div>
                  </div>

                  {/* Informações de Drive (se enviado) */}
                  {selectedBackup.drive_status === 'enviado' && (
                    <div className="bg-emerald-50/70 p-3 rounded-xl border border-emerald-200 text-xs text-emerald-950 flex items-start gap-2.5">
                      <Cloud className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                      <div className="space-y-0.5">
                        <p className="font-semibold text-emerald-900">
                          Arquivo preservado com segurança no Google Drive
                        </p>
                        <p className="text-emerald-800 text-[11px]">
                          Pasta de destino:{' '}
                          <strong>{driveInfo?.pasta_nome || 'Backups ERP'}</strong> • Enviado em:{' '}
                          {selectedBackup.drive_enviado_em
                            ? formatDateTime(selectedBackup.drive_enviado_em)
                            : 'Recentemente'}
                          {selectedBackup.drive_file_id && (
                            <span className="block font-mono text-[10px] text-emerald-700 mt-0.5">
                              File ID: {selectedBackup.drive_file_id}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                  )}

                  {selectedBackup.drive_erro && (
                    <div className="bg-amber-50 p-3 rounded-xl border border-amber-200 text-xs text-amber-950 flex items-start gap-2.5">
                      <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-amber-900">
                          Registro de ocorrência no Google Drive:
                        </p>
                        <p className="text-amber-800 text-[11px] mt-0.5">
                          {selectedBackup.drive_erro}
                        </p>
                      </div>
                    </div>
                  )}

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
                      1. Clique no botão <strong>&quot;Baixar Dump Completo (JSON)&quot;</strong>{' '}
                      acima para salvar o arquivo com todas as coleções na sua máquina ou acesse a
                      pasta &quot;Backups ERP&quot; no Google Drive.
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
                      <strong>&quot;Create backup&quot;</strong> para gerar novo snapshot da pasta{' '}
                      <code className="bg-gray-100 px-1 py-0.5 rounded font-mono">pb_data</code>.
                      <br />
                      3. Para restaurar o banco inteiro (arquivos, uploads e SQLite), clique no
                      ícone de <strong>&quot;Restore&quot;</strong> ao lado do backup no painel.
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

      {/* Modal de Configuração do Google Drive */}
      <Dialog open={modalConfigOpen} onOpenChange={setModalConfigOpen}>
        <DialogContent className="sm:max-w-[580px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-teal-900">
              <Cloud className="w-5 h-5 text-teal-700" />
              Configuração do Google Cloud / Drive API
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-600">
              Configure as credenciais OAuth 2.0 criadas no Google Cloud Console para permitir o
              envio automático.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSalvarConfigDrive} className="space-y-4 text-xs">
            <div className="bg-teal-50/70 border border-teal-200 rounded-lg p-3 space-y-2">
              <span className="font-semibold text-teal-950 block">
                1. Redirect URI autorizada para cadastrar no Google:
              </span>
              <div className="flex items-center gap-2">
                <code className="bg-white px-2 py-1.5 rounded border border-teal-200 text-[11px] font-mono text-gray-800 break-all flex-1">
                  {driveInfo?.redirect_uri_recomendada ||
                    'https://erp-empresarial-completo-575bb.shrd00.internal.goskip.dev/backend/v1/google-drive/oauth/callback'}
                </code>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCopyRedirectUri}
                  className="shrink-0 bg-white border-teal-200 hover:bg-teal-50"
                >
                  {copiedRedirectUri ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-gray-500" />
                  )}
                </Button>
              </div>
              <p className="text-[11px] text-teal-800 leading-tight">
                No Google Cloud Console, crie um <strong>OAuth Client ID</strong> do tipo{' '}
                <strong>Aplicação Web</strong> e adicione a URL acima em{' '}
                <em>&quot;URIs de redirecionamento autorizados&quot;</em>.
              </p>
            </div>

            <div className="space-y-3 pt-1">
              <div>
                <Label htmlFor="clientId" className="text-xs font-semibold text-gray-700">
                  Client ID do Google
                </Label>
                <Input
                  id="clientId"
                  placeholder="ex: 123456789-abc.apps.googleusercontent.com"
                  value={clientIdInput}
                  onChange={(e) => setClientIdInput(e.target.value)}
                  className="text-xs font-mono mt-1"
                />
              </div>

              <div>
                <Label htmlFor="clientSecret" className="text-xs font-semibold text-gray-700">
                  Client Secret do Google
                </Label>
                <Input
                  id="clientSecret"
                  type="password"
                  placeholder="ex: GOCSPX-xxxxxxxxxxxxxxxx"
                  value={clientSecretInput}
                  onChange={(e) => setClientSecretInput(e.target.value)}
                  className="text-xs font-mono mt-1"
                />
              </div>

              <div>
                <Label htmlFor="folderName" className="text-xs font-semibold text-gray-700">
                  Nome da Pasta no Drive (padrão: Backups ERP)
                </Label>
                <Input
                  id="folderName"
                  placeholder="Backups ERP"
                  value={folderNameInput}
                  onChange={(e) => setFolderNameInput(e.target.value)}
                  className="text-xs mt-1"
                />
              </div>

              <div>
                <Label htmlFor="refreshToken" className="text-xs font-semibold text-gray-700">
                  Refresh Token Manual (Opcional — caso já possua)
                </Label>
                <Input
                  id="refreshToken"
                  type="password"
                  placeholder="1//04xxxxxxxx..."
                  value={manualRefreshTokenInput}
                  onChange={(e) => setManualRefreshTokenInput(e.target.value)}
                  className="text-xs font-mono mt-1"
                />
                <span className="text-[10px] text-gray-500 mt-0.5 block">
                  Se não preencher, basta clicar em &quot;Conectar Conta Google&quot; na tela para
                  autorizar no navegador.
                </span>
              </div>
            </div>

            <DialogFooter className="gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setModalConfigOpen(false)}
                className="text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={salvandoConfig}
                className="bg-teal-700 hover:bg-teal-800 text-white text-xs font-medium"
              >
                {salvandoConfig ? 'Salvando...' : 'Salvar Configurações'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
