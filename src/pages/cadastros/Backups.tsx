import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  ShieldCheck,
  Download,
  Clock,
  HardDrive,
  RefreshCw,
  Play,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Info,
  Layers,
  ArrowDownToLine,
  Database,
  Search,
  CloudUpload,
  Cloud,
  Check,
  Copy,
  ExternalLink,
  Trash2,
  KeyRound,
  FolderSync,
  HelpCircle,
  FileCheck2,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { useCompany } from '@/contexts/CompanyContext'
import { formatDateTime } from '@/lib/formatters'
import {
  backupService,
  BackupItem,
  BackupAgendamentoInfo,
  GoogleDriveStatusInfo,
} from '@/services/backup'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'

export function Backups() {
  const { isAdmin } = useCompany()
  const { toast } = useToast()

  const [backups, setBackups] = useState<BackupItem[]>([])
  const [agendamento, setAgendamento] = useState<BackupAgendamentoInfo | null>(null)
  const [driveStatus, setDriveStatus] = useState<GoogleDriveStatusInfo | null>(null)

  const [loading, setLoading] = useState(true)
  const [executando, setExecutando] = useState(false)
  const [baixandoId, setBaixandoId] = useState<string | null>(null)
  const [enviandoDriveId, setEnviandoDriveId] = useState<string | null>(null)

  const [filtroTexto, setFiltroTexto] = useState('')
  const [filtroOrigem, setFiltroOrigem] = useState<'todos' | 'manual' | 'semanal_automatico'>(
    'todos',
  )
  const [backupDetalhe, setBackupDetalhe] = useState<BackupItem | null>(null)

  // Formulário de Configuração da Conta de Serviço
  const [modalConfigAberta, setModalConfigAberta] = useState(false)
  const [serviceAccountJsonInput, setServiceAccountJsonInput] = useState('')
  const [folderIdInput, setFolderIdInput] = useState('')
  const [salvandoConfig, setSalvandoConfig] = useState(false)
  const [etapaSalvamento, setEtapaSalvamento] = useState<
    'ocioso' | 'salvando' | 'validando_google'
  >('ocioso')
  const [avisoValidacao, setAvisoValidacao] = useState<string | null>(null)
  const [desconectando, setDesconectando] = useState(false)
  const [emailCopiado, setEmailCopiado] = useState(false)

  const carregarDados = useCallback(async () => {
    try {
      setLoading(true)
      const [lista, agend, drive] = await Promise.allSettled([
        backupService.listarBackups(),
        backupService.obterStatusAgendamento(),
        backupService.obterStatusGoogleDrive(),
      ])

      if (lista.status === 'fulfilled' && Array.isArray(lista.value)) {
        setBackups(lista.value)
      } else {
        setBackups([])
        console.warn('[Backups.tsx] Falha ao carregar lista de backups:', lista)
      }

      if (agend.status === 'fulfilled' && agend.value) {
        setAgendamento(agend.value)
      }

      if (drive.status === 'fulfilled' && drive.value) {
        setDriveStatus(drive.value)
        if (drive.value?.pasta_id) {
          setFolderIdInput(drive.value.pasta_id)
        }
      }
    } catch (err) {
      console.error('[Backups.tsx] Erro inesperado em carregarDados:', err)
      toast({
        title: 'Aviso de conexão',
        description: 'Não foi possível atualizar alguns dados de backup.',
      })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    carregarDados()
  }, [carregarDados])

  const copiarEmailContaServico = () => {
    if (!driveStatus?.client_email) return
    try {
      if (navigator?.clipboard?.writeText) {
        navigator.clipboard.writeText(driveStatus.client_email)
      } else {
        const textArea = document.createElement('textarea')
        textArea.value = driveStatus.client_email
        document.body.appendChild(textArea)
        textArea.select()
        document.execCommand('copy')
        document.body.removeChild(textArea)
      }
      setEmailCopiado(true)
      toast({
        title: 'Email copiado!',
        description: 'Email da Conta de Serviço copiado para a área de transferência.',
      })
      setTimeout(() => setEmailCopiado(false), 2500)
    } catch {
      toast({
        title: 'Email da Conta de Serviço',
        description: driveStatus.client_email,
      })
    }
  }

  const salvarConfiguracoesDrive = async () => {
    // Validação estrutural local prévia no cliente
    if (serviceAccountJsonInput.trim()) {
      try {
        const parsed = JSON.parse(serviceAccountJsonInput.trim())
        if (!parsed.client_email || !parsed.private_key) {
          toast({
            title: 'JSON incompleto',
            description:
              'O JSON da Conta de Serviço deve conter pelo menos "client_email" e "private_key".',
            variant: 'destructive',
          })
          return
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'JSON inválido'
        toast({
          title: 'Arquivo JSON inválido',
          description: 'O texto inserido não é um JSON válido: ' + msg,
          variant: 'destructive',
        })
        return
      }
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => {
      controller.abort()
    }, 20000) // Timeout cliente de 20s para segurança absoluta contra travamentos

    try {
      setSalvandoConfig(true)
      setAvisoValidacao(null)
      setEtapaSalvamento(serviceAccountJsonInput.trim() ? 'validando_google' : 'salvando')

      const payload: { service_account_json?: string; folder_id?: string; folder_name?: string } =
        {}

      if (serviceAccountJsonInput.trim()) {
        payload.service_account_json = serviceAccountJsonInput.trim()
      }
      payload.folder_id = folderIdInput.trim()

      const res = await backupService.salvarConfiguracoesDrive(payload, controller.signal)
      clearTimeout(timeoutId)

      if (res.validacao_online?.testada && !res.validacao_online.sucesso) {
        // Chave salva com aviso sobre a validação Google
        setAvisoValidacao(res.validacao_online.aviso)
        toast({
          title: 'Chave salva!',
          description:
            res.validacao_online.aviso ||
            'Chave salva com sucesso. A validação online será refeita no próximo envio.',
          className: 'bg-amber-500 text-white border-none',
        })
      } else {
        toast({
          title: 'Chave salva com sucesso!',
          description: res.message || 'Conta de Serviço Google Drive configurada e validada.',
        })
      }

      setServiceAccountJsonInput('')
      setModalConfigAberta(false)
      await carregarDados()
    } catch (err: unknown) {
      clearTimeout(timeoutId)
      let msg = err instanceof Error ? err.message : 'Falha ao salvar configurações.'
      if (err instanceof DOMException && err.name === 'AbortError') {
        msg =
          'A requisição demorou mais de 20s. Verifique se as credenciais foram salvas no status da conta.'
        await carregarDados()
      }
      toast({
        title: 'Aviso na configuração',
        description: msg,
        variant: 'destructive',
      })
    } finally {
      setSalvandoConfig(false)
      setEtapaSalvamento('ocioso')
    }
  }

  const desconectarDrive = async () => {
    if (!confirm('Deseja realmente remover as credenciais da Conta de Serviço do Google Drive?')) {
      return
    }

    try {
      setDesconectando(true)
      await backupService.desconectarGoogleDrive()
      toast({
        title: 'Desconectado',
        description: 'Configurações da Conta de Serviço removidas com sucesso.',
      })
      setServiceAccountJsonInput('')
      setFolderIdInput('')
      await carregarDados()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao remover credenciais.'
      toast({
        title: 'Erro ao desconectar',
        description: msg,
        variant: 'destructive',
      })
    } finally {
      setDesconectando(false)
    }
  }

  const executarBackupManual = async () => {
    if (!isAdmin) {
      toast({
        title: 'Permissão necessária',
        description: 'Apenas administradores podem executar backups sob demanda.',
        variant: 'destructive',
      })
      return
    }

    try {
      setExecutando(true)
      toast({
        title: 'Iniciando backup...',
        description: 'Coletando todas as 28 coleções do sistema com integridade total.',
      })

      const novoBackup = await backupService.executarBackupManual()

      toast({
        title: 'Backup concluído com sucesso!',
        description: `Arquivo ${novoBackup.nome_arquivo} gerado com ${novoBackup.total_registros} registros.`,
      })

      await carregarDados()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao processar o backup.'
      toast({
        title: 'Falha no backup',
        description: msg,
        variant: 'destructive',
      })
    } finally {
      setExecutando(false)
    }
  }

  const enviarAoGoogleDrive = async (backupId: string) => {
    if (!isAdmin) {
      toast({
        title: 'Ação restrita',
        description: 'Apenas administradores podem enviar backups ao Google Drive.',
        variant: 'destructive',
      })
      return
    }

    try {
      setEnviandoDriveId(backupId)
      toast({
        title: 'Enviando ao Drive...',
        description: 'Autenticando via Conta de Serviço e transferindo arquivo.',
      })

      const res = await backupService.enviarBackupAoDrive(backupId)

      // Atualização imediata no estado local para refletir o sucesso real
      setBackups((prev) =>
        prev.map((b) =>
          b.id === backupId
            ? {
                ...b,
                drive_status: 'enviado',
                drive_file_id: res?.file_id || b.drive_file_id || '',
                drive_folder_id: res?.folder_id || b.drive_folder_id || '',
                drive_enviado_em: res?.enviado_em || new Date().toISOString(),
                drive_erro: '',
              }
            : b,
        ),
      )

      toast({
        title: 'Backup enviado com sucesso ao Google Drive!',
        description: res?.message || 'Arquivo sincronizado na sua pasta do Google Drive.',
      })

      await carregarDados()
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : typeof err === 'object' && err !== null && 'message' in err
            ? String((err as { message: unknown }).message)
            : 'Falha ao transferir para o Google Drive.'

      // Atualização imediata no estado local para refletir a mensagem real da falha
      setBackups((prev) =>
        prev.map((b) =>
          b.id === backupId
            ? {
                ...b,
                drive_status: 'erro',
                drive_erro: msg,
              }
            : b,
        ),
      )

      toast({
        title: 'Erro no envio ao Google Drive',
        description: msg,
        variant: 'destructive',
      })
      await carregarDados()
    } finally {
      setEnviandoDriveId(null)
    }
  }

  const baixarBackupJson = async (backup: BackupItem) => {
    try {
      setBaixandoId(backup.id)
      toast({
        title: 'Consolidando arquivo...',
        description: 'Juntando chunks e gerando dump JSON estruturado para download.',
      })

      const payload = await backupService.baixarDadosBackup(backup.id)
      backupService.dispararDownloadNoNavegador(backup.nome_arquivo, payload)

      toast({
        title: 'Download iniciado!',
        description: `Arquivo ${backup.nome_arquivo} baixado com sucesso no seu computador.`,
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao baixar o arquivo.'
      toast({
        title: 'Falha no download',
        description: msg,
        variant: 'destructive',
      })
    } finally {
      setBaixandoId(null)
    }
  }

  const backupsFiltrados = useMemo(() => {
    if (!Array.isArray(backups)) return []
    const termo = (filtroTexto || '').trim().toLowerCase()
    return backups.filter((b) => {
      if (!b) return false
      const nomeArquivo = (b.nome_arquivo || '').toLowerCase()
      const statusStr = (b.status || '').toLowerCase()
      const obsStr = (b.observacoes || '').toLowerCase()

      const matchTexto =
        termo === '' ||
        nomeArquivo.includes(termo) ||
        statusStr.includes(termo) ||
        obsStr.includes(termo)

      const origemStr = b.origem || 'manual'
      const matchOrigem = filtroOrigem === 'todos' || origemStr === filtroOrigem

      return matchTexto && matchOrigem
    })
  }, [backups, filtroTexto, filtroOrigem])

  const estatisticas = useMemo(() => {
    const lista = Array.isArray(backups) ? backups : []
    const totalBackups = lista.length
    const totalRegistrosSalvos = lista.reduce(
      (acc, cur) => acc + (Number(cur?.total_registros) || 0),
      0,
    )
    const ultimoExecutado = lista[0] || null
    const automaticos = lista.filter((b) => b?.origem === 'semanal_automatico').length
    const noDrive = lista.filter((b) => b?.drive_status === 'enviado').length

    return {
      totalBackups,
      totalRegistrosSalvos,
      ultimoExecutado,
      automaticos,
      noDrive,
    }
  }, [backups])

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <HardDrive className="h-7 w-7 text-primary" />
              Backups do Sistema
            </h1>
            <Badge
              variant="outline"
              className="border-emerald-500/30 text-emerald-600 bg-emerald-500/10 text-xs"
            >
              Produção Real
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Gestão de integridade, exportação completa e sincronização automática semanal com o
            Google Drive.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={carregarDados}
            disabled={loading}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>

          {isAdmin && (
            <Button
              onClick={executarBackupManual}
              disabled={executando}
              className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {executando ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Gerando Dump...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 fill-current" />
                  Fazer Backup Agora
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Cartão de Integração Google Drive via Conta de Serviço */}
      <Card className="border border-border/80 shadow-sm overflow-hidden bg-gradient-to-br from-card via-card to-muted/20">
        <div className="bg-primary/5 border-b border-primary/10 px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Cloud className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-foreground">
                  Integração Google Drive (Conta de Serviço)
                </h2>
                {driveStatus?.configurado ? (
                  <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white text-xs gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Conta Conectada
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="text-amber-600 border-amber-500/40 bg-amber-500/10 text-xs"
                  >
                    Não configurada
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Envio direto via API do Google Cloud usando chave técnica de serviço (sem expiração
                de token).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setModalConfigAberta(true)
                if (driveStatus?.pasta_id) setFolderIdInput(driveStatus.pasta_id)
              }}
              className="gap-2"
            >
              <KeyRound className="h-4 w-4 text-primary" />
              {driveStatus?.configurado ? 'Alterar Credenciais' : 'Configurar Chave Google'}
            </Button>

            {driveStatus?.configurado && isAdmin && (
              <Button
                variant="ghost"
                size="sm"
                onClick={desconectarDrive}
                disabled={desconectando}
                className="gap-1 text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Desconectar
              </Button>
            )}
          </div>
        </div>

        <CardContent className="p-6 space-y-4">
          {driveStatus?.configurado ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-muted/40 p-4 rounded-lg border border-border/60">
              {/* Email Técnico da Conta de Serviço */}
              <div className="space-y-1 md:col-span-1">
                <div className="text-xs font-medium text-muted-foreground uppercase flex items-center gap-1.5">
                  <KeyRound className="h-3.5 w-3.5 text-primary" />
                  Email da Conta de Serviço
                </div>
                <div
                  className="text-sm font-mono font-medium text-foreground truncate"
                  title={driveStatus.client_email || ''}
                >
                  {driveStatus.client_email_mascarado ||
                    driveStatus.client_email ||
                    'Chave ativa ✓'}
                </div>
                {driveStatus.client_email && (
                  <Button
                    variant="link"
                    size="sm"
                    onClick={copiarEmailContaServico}
                    className="p-0 h-auto text-xs text-primary gap-1 font-normal"
                  >
                    {emailCopiado ? (
                      <Check className="h-3 w-3 text-emerald-600" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                    {emailCopiado ? 'Email copiado!' : 'Copiar email para compartilhar pasta'}
                  </Button>
                )}
              </div>

              {/* Alerta de Validação se houver */}
              {avisoValidacao && (
                <div className="md:col-span-3 bg-amber-500/10 border border-amber-500/30 p-3 rounded-lg flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-200">
                  <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <span className="font-semibold block">Nota sobre a validação da chave:</span>
                    <span>{avisoValidacao}</span>
                  </div>
                </div>
              )}

              {/* Pasta de Destino no Google Drive */}
              <div className="space-y-1 md:col-span-1">
                <div className="text-xs font-medium text-muted-foreground uppercase flex items-center gap-1.5">
                  <FolderSync className="h-3.5 w-3.5 text-primary" />
                  Pasta no Google Drive
                </div>
                <div className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <span>{driveStatus.pasta_nome || 'Backups ERP'}</span>
                  {driveStatus.pasta_id ? (
                    <Badge
                      variant="outline"
                      className="text-[10px] font-mono border-emerald-500/30 text-emerald-600 bg-emerald-500/5"
                    >
                      ID Definido ✓
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="text-[10px] text-amber-600 border-amber-500/30"
                    >
                      Drive raiz da conta
                    </Badge>
                  )}
                </div>
                {driveStatus.pasta_id ? (
                  <a
                    href={`https://drive.google.com/drive/folders/${driveStatus.pasta_id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    Abrir pasta no Drive
                    <ExternalLink className="h-3 w-3" />
                  </a>
                ) : (
                  <p className="text-xs text-amber-600">
                    Defina o ID da sua pasta compartilhada para ver os arquivos no seu Drive
                    pessoal.
                  </p>
                )}
              </div>

              {/* Status do Último Envio */}
              <div className="space-y-1 md:col-span-1">
                <div className="text-xs font-medium text-muted-foreground uppercase flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-primary" />
                  Último Envio ao Drive
                </div>
                <div className="text-sm font-medium text-foreground">
                  {driveStatus.ultimo_envio
                    ? formatDateTime(driveStatus.ultimo_envio)
                    : 'Aguardando primeiro envio'}
                </div>
                <p className="text-xs text-muted-foreground">
                  Envio automático acionado após o término do backup semanal de domingo.
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h3 className="text-sm font-medium text-foreground">
                    Google Drive ainda não vinculado por Conta de Serviço
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Para habilitar o envio automático e seguro dos backups ao Google Drive sem
                    depender de telas de consentimento ou renovação de token, configure uma Conta de
                    Serviço gratuita no Google Cloud.
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                onClick={() => setModalConfigAberta(true)}
                className="gap-2 bg-amber-600 hover:bg-amber-700 text-white shrink-0"
              >
                <KeyRound className="h-4 w-4" />
                Configurar Agora
              </Button>
            </div>
          )}

          {/* Instruções passo a passo em acordeão recolhível */}
          <Accordion
            type="single"
            collapsible
            className="w-full border rounded-lg px-4 bg-muted/20"
          >
            <AccordionItem value="passo-a-passo" className="border-none">
              <AccordionTrigger className="text-xs font-medium text-muted-foreground hover:text-foreground py-3">
                <span className="flex items-center gap-2">
                  <HelpCircle className="h-4 w-4 text-primary" />
                  Como criar a Conta de Serviço no Google Cloud Console (Passo a passo rápido)
                </span>
              </AccordionTrigger>
              <AccordionContent className="text-xs text-muted-foreground space-y-3 pt-1 pb-4">
                <ol className="list-decimal pl-5 space-y-2 text-foreground/90">
                  <li>
                    Acesse o{' '}
                    <a
                      href="https://console.cloud.google.com/apis/library/drive.googleapis.com"
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary underline font-medium inline-flex items-center gap-0.5"
                    >
                      Google Cloud Console - API Google Drive
                      <ExternalLink className="h-3 w-3" />
                    </a>{' '}
                    e clique em <strong>Ativar</strong>.
                  </li>
                  <li>
                    No menu lateral esquerdo, vá em <strong>IAM e Administrador</strong> &rarr;{' '}
                    <a
                      href="https://console.cloud.google.com/iam-admin/serviceaccounts"
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary underline font-medium inline-flex items-center gap-0.5"
                    >
                      Contas de serviço
                      <ExternalLink className="h-3 w-3" />
                    </a>{' '}
                    &rarr; clique em <strong>+ Criar conta de serviço</strong> (dê o nome "ERP
                    Pedreira Cordeiro" e avance sem papéis).
                  </li>
                  <li>
                    Na lista de contas de serviço, clique no email da conta criada &rarr; aba{' '}
                    <strong>Chaves</strong> &rarr; <strong>Adicionar chave</strong> &rarr;{' '}
                    <strong>Criar nova chave</strong> &rarr; selecione <strong>JSON</strong> &rarr;
                    baixe o arquivo no seu computador.
                  </li>
                  <li>
                    No seu <strong>Google Drive pessoal</strong>, crie uma pasta chamada{' '}
                    <strong>"Backups ERP"</strong> (ou use uma existente), clique nela com o botão
                    direito &rarr; <strong>Compartilhar</strong> &rarr; adicione o{' '}
                    <strong>email da conta de serviço</strong> (ex:{' '}
                    <code className="bg-muted px-1 py-0.5 rounded text-[11px]">
                      backup-erp@projeto.iam.gserviceaccount.com
                    </code>
                    ) com a permissão <strong>Editor</strong>.
                  </li>
                  <li>
                    Copie o ID da pasta (a sequência de caracteres no link após <em>/folders/</em>)
                    e cole o JSON da chave no botão <strong>Configurar Chave Google</strong> acima.
                    Pronto!
                  </li>
                </ol>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

      {/* Cartões de Indicadores */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border border-border/80 shadow-sm">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase">
              Total de Backups
            </CardTitle>
            <Database className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold tracking-tight">{estatisticas.totalBackups}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {estatisticas.automaticos} semanais automáticos
            </p>
          </CardContent>
        </Card>

        <Card className="border border-border/80 shadow-sm">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase">
              Sincronizados no Drive
            </CardTitle>
            <CloudUpload className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold tracking-tight text-emerald-600">
              {estatisticas.noDrive}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {driveStatus?.configurado ? 'Conta de serviço ativa' : 'Drive pendente'}
            </p>
          </CardContent>
        </Card>

        <Card className="border border-border/80 shadow-sm">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase">
              Cron Semanal
            </CardTitle>
            <Calendar className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              Domingos 00:30
            </div>
            <p
              className="text-xs text-muted-foreground mt-1 truncate"
              title="Agendado no PocketBase"
            >
              Job nativo ativo no servidor
            </p>
          </CardContent>
        </Card>

        <Card className="border border-border/80 shadow-sm">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase">
              Último Backup
            </CardTitle>
            <ShieldCheck className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-sm font-bold text-foreground">
              {estatisticas.ultimoExecutado
                ? formatDateTime(estatisticas.ultimoExecutado.created)
                : 'Nenhum'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {estatisticas.ultimoExecutado
                ? `${estatisticas.ultimoExecutado.total_registros} registros`
                : 'Aguardando execução'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabela de Backups Realizados */}
      <Card className="border border-border/80 shadow-sm">
        <CardHeader className="p-5 border-b border-border/60">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base font-semibold">Histórico de Backups</CardTitle>
              <CardDescription className="text-xs">
                Backups armazenados no banco, disponíveis para download imediato em JSON ou envio ao
                Google Drive.
              </CardDescription>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-full sm:w-60">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Filtrar por nome ou status..."
                  value={filtroTexto}
                  onChange={(e) => setFiltroTexto(e.target.value)}
                  className="pl-8 text-xs h-8"
                />
              </div>

              <div className="flex rounded-md border border-input p-0.5 bg-muted/40 text-xs">
                <button
                  type="button"
                  onClick={() => setFiltroOrigem('todos')}
                  className={`px-2.5 py-1 rounded-sm transition-colors ${
                    filtroOrigem === 'todos'
                      ? 'bg-background shadow-xs font-medium text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Todos ({backups.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFiltroOrigem('semanal_automatico')}
                  className={`px-2.5 py-1 rounded-sm transition-colors ${
                    filtroOrigem === 'semanal_automatico'
                      ? 'bg-background shadow-xs font-medium text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Semanal ({estatisticas.automaticos})
                </button>
                <button
                  type="button"
                  onClick={() => setFiltroOrigem('manual')}
                  className={`px-2.5 py-1 rounded-sm transition-colors ${
                    filtroOrigem === 'manual'
                      ? 'bg-background shadow-xs font-medium text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Manual ({backups.length - estatisticas.automaticos})
                </button>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center gap-3 text-muted-foreground">
              <RefreshCw className="h-6 w-6 animate-spin text-primary" />
              <p className="text-sm">Carregando lista de backups...</p>
            </div>
          ) : backupsFiltrados.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground space-y-2">
              <HardDrive className="h-10 w-10 mx-auto text-muted-foreground/40" />
              <p className="text-sm font-medium">Nenhum backup encontrado</p>
              <p className="text-xs text-muted-foreground/80 max-w-sm mx-auto">
                {filtroTexto || filtroOrigem !== 'todos'
                  ? 'Nenhum registro coincide com os filtros aplicados.'
                  : 'Nenhum backup foi gerado ainda. Clique em "Fazer Backup Agora" acima para criar o primeiro.'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {backupsFiltrados.map((item) => {
                const isBaixando = baixandoId === item.id
                const isEnviandoDrive = enviandoDriveId === item.id
                const noDrive = item.drive_status === 'enviado'

                return (
                  <div
                    key={item.id}
                    className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-muted/30 transition-colors"
                  >
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-semibold text-foreground truncate max-w-md">
                          {item.nome_arquivo}
                        </span>

                        {item.status === 'sucesso' ? (
                          <Badge
                            variant="outline"
                            className="border-emerald-500/40 text-emerald-600 bg-emerald-500/10 text-[10px] gap-1"
                          >
                            <CheckCircle2 className="h-3 w-3" />
                            Íntegro
                          </Badge>
                        ) : item.status === 'parcial' ? (
                          <Badge
                            variant="outline"
                            className="border-amber-500/40 text-amber-600 bg-amber-500/10 text-[10px] gap-1"
                          >
                            <AlertTriangle className="h-3 w-3" />
                            Parcial
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="text-[10px]">
                            Falha
                          </Badge>
                        )}

                        {item.origem === 'semanal_automatico' ? (
                          <Badge
                            variant="secondary"
                            className="text-[10px] gap-1 bg-primary/10 text-primary"
                          >
                            <Calendar className="h-3 w-3" />
                            Semanal Cron
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] text-muted-foreground">
                            Manual
                          </Badge>
                        )}

                        {noDrive ? (
                          <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] gap-1 shadow-xs">
                            <CloudUpload className="h-3 w-3" />
                            ☁️ no Drive
                          </Badge>
                        ) : item.drive_status === 'erro' ? (
                          <Badge
                            variant="destructive"
                            className="text-[10px] gap-1"
                            title={item.drive_erro || 'Erro no envio'}
                          >
                            <AlertTriangle className="h-3 w-3" />
                            Erro no Drive
                          </Badge>
                        ) : null}
                      </div>

                      <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {formatDateTime(item.created)}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1 font-medium text-foreground/90">
                          <Database className="h-3.5 w-3.5 text-primary" />
                          {(Number(item.total_registros) || 0).toLocaleString('pt-BR')} registros
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Layers className="h-3.5 w-3.5" />
                          {Number(item.total_colecoes) || 0} coleções
                        </span>
                        {item.drive_enviado_em && (
                          <>
                            <span>•</span>
                            <span className="text-emerald-600">
                              Enviado ao Drive em {formatDateTime(item.drive_enviado_em)}
                            </span>
                          </>
                        )}
                      </div>

                      {item.drive_status === 'erro' && item.drive_erro && (
                        <p
                          className="text-xs text-destructive font-mono bg-destructive/10 p-1.5 rounded max-w-xl truncate"
                          title={item.drive_erro}
                        >
                          Falha Drive: {item.drive_erro}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setBackupDetalhe(item)}
                        className="h-8 text-xs gap-1"
                      >
                        <Info className="h-3.5 w-3.5" />
                        Ver Resumo
                      </Button>

                      {isAdmin && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => enviarAoGoogleDrive(item.id)}
                          disabled={isEnviandoDrive}
                          className="h-8 text-xs gap-1 border-primary/30 text-primary hover:bg-primary/10"
                          title="Enviar cópia deste backup para a pasta do Google Drive via Conta de Serviço"
                        >
                          {isEnviandoDrive ? (
                            <>
                              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                              Enviando...
                            </>
                          ) : (
                            <>
                              <CloudUpload className="h-3.5 w-3.5" />
                              {noDrive ? 'Reenviar ao Drive' : 'Enviar ao Google Drive'}
                            </>
                          )}
                        </Button>
                      )}

                      <Button
                        size="sm"
                        onClick={() => baixarBackupJson(item)}
                        disabled={isBaixando}
                        className="h-8 text-xs gap-1 bg-secondary text-secondary-foreground hover:bg-secondary/80"
                      >
                        {isBaixando ? (
                          <>
                            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                            Consolidando...
                          </>
                        ) : (
                          <>
                            <Download className="h-3.5 w-3.5" />
                            Baixar JSON
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de Configuração da Conta de Serviço Google Drive */}
      <Dialog open={modalConfigAberta} onOpenChange={setModalConfigAberta}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary" />
              Configurar Conta de Serviço do Google Drive
            </DialogTitle>
            <DialogDescription>
              Cole o arquivo JSON de chave baixado do Google Cloud Console. A chave é salva com
              segurança no servidor e nunca é exposta.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Campo 1: Colar JSON da Conta de Serviço */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="service-account-json" className="text-xs font-semibold">
                  JSON da Chave da Conta de Serviço *
                </Label>
                {driveStatus?.configurado && (
                  <span className="text-[11px] text-emerald-600 font-medium flex items-center gap-1">
                    <FileCheck2 className="h-3.5 w-3.5" />
                    Chave atualmente configurada ({driveStatus.client_email_mascarado})
                  </span>
                )}
              </div>
              <Textarea
                id="service-account-json"
                placeholder={`Cole o conteúdo completo do arquivo .json baixado no Google Cloud Console, ex:\n{\n  "type": "service_account",\n  "project_id": "...",\n  "private_key_id": "...",\n  "private_key": "-----BEGIN PRIVATE KEY-----\\n...",\n  "client_email": "seu-servico@projeto.iam.gserviceaccount.com"\n}`}
                value={serviceAccountJsonInput}
                onChange={(e) => setServiceAccountJsonInput(e.target.value)}
                className="font-mono text-xs h-40 resize-y"
              />
              <p className="text-[11px] text-muted-foreground">
                {driveStatus?.configurado
                  ? 'Deixe este campo em branco se desejar manter a chave atual e apenas alterar o ID da pasta.'
                  : 'Abra o arquivo .json baixado no bloco de notas, copie tudo e cole aqui.'}
              </p>
            </div>

            {/* Campo 2: ID da Pasta Compartilhada no Google Drive */}
            <div className="space-y-1.5">
              <Label htmlFor="folder-id" className="text-xs font-semibold">
                ID ou Link da Pasta no Google Drive (Recomendado)
              </Label>
              <Input
                id="folder-id"
                placeholder="Ex: 1sbDoZucOc8Vea2F0nXtc07FKsSlzdX7V ou cole o link completo da pasta"
                value={folderIdInput}
                onChange={(e) => setFolderIdInput(e.target.value)}
                className="text-xs font-mono"
              />
              <div className="bg-amber-500/10 border border-amber-500/20 p-2.5 rounded text-[11px] text-foreground/90 space-y-1">
                <div className="font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1">
                  <Info className="h-3.5 w-3.5 shrink-0" />
                  Importante sobre a pasta do Google Drive:
                </div>
                <p>
                  As contas de serviço possuem um armazenamento isolado. Para você enxergar os
                  backups no seu Google Drive pessoal, você precisa{' '}
                  <strong>compartilhar uma pasta sua</strong> com o email da conta de serviço como{' '}
                  <strong>Editor</strong> e colar o ID dela acima.
                </p>
              </div>
            </div>

            {/* Email da Conta de Serviço para Copiar */}
            {driveStatus?.client_email && (
              <div className="bg-muted p-3 rounded-lg border flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[11px] font-medium text-muted-foreground">
                    Email da Conta de Serviço para compartilhar no Drive:
                  </div>
                  <div className="text-xs font-mono font-semibold truncate text-foreground">
                    {driveStatus.client_email}
                  </div>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={copiarEmailContaServico}
                  className="gap-1 text-xs shrink-0"
                >
                  {emailCopiado ? (
                    <Check className="h-3 w-3 text-emerald-600" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                  {emailCopiado ? 'Copiado!' : 'Copiar'}
                </Button>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setModalConfigAberta(false)}
              disabled={salvandoConfig}
            >
              Cancelar
            </Button>
            <Button
              onClick={salvarConfiguracoesDrive}
              disabled={
                salvandoConfig ||
                (!serviceAccountJsonInput.trim() &&
                  !driveStatus?.configurado &&
                  !folderIdInput.trim())
              }
              className="gap-2 bg-primary text-primary-foreground"
            >
              {salvandoConfig ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  {etapaSalvamento === 'validando_google'
                    ? 'Salvando e testando chave Google...'
                    : 'Salvando...'}
                </>
              ) : (
                'Salvar Configurações'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Detalhes e Resumo do Backup */}
      <Dialog open={!!backupDetalhe} onOpenChange={(open) => !open && setBackupDetalhe(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {backupDetalhe && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 font-mono text-sm">
                  <Database className="h-4 w-4 text-primary" />
                  {backupDetalhe.nome_arquivo}
                </DialogTitle>
                <DialogDescription>
                  Dump estruturado completo com integridade referencial.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 text-xs">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-muted/40 p-3 rounded-lg border">
                  <div>
                    <span className="text-muted-foreground block">Origem:</span>
                    <strong className="text-foreground">
                      {backupDetalhe.origem === 'semanal_automatico'
                        ? 'Semanal Automático'
                        : 'Manual'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Criado em:</span>
                    <strong className="text-foreground">
                      {formatDateTime(backupDetalhe.created)}
                    </strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Total de Coleções:</span>
                    <strong className="text-foreground">
                      {Number(backupDetalhe.total_colecoes) || 0}
                    </strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Total de Registros:</span>
                    <strong className="text-emerald-600 font-bold">
                      {(Number(backupDetalhe.total_registros) || 0).toLocaleString('pt-BR')}
                    </strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Status Google Drive:</span>
                    <strong className="text-foreground">
                      {backupDetalhe.drive_status === 'enviado'
                        ? '☁️ Enviado com Sucesso'
                        : backupDetalhe.drive_status === 'erro'
                          ? 'Falha no Envio'
                          : 'Pendente'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Tabela de Duplicatas:</span>
                    <strong className="text-foreground">
                      {backupDetalhe.backup_duplicatas_incluido ? 'Incluída' : 'Não necessária'}
                    </strong>
                  </div>
                </div>

                {backupDetalhe.observacoes && (
                  <div className="bg-muted/20 p-2.5 rounded border text-muted-foreground">
                    <span className="font-semibold text-foreground block mb-0.5">Observações:</span>
                    {backupDetalhe.observacoes}
                  </div>
                )}

                {/* Resumo por Coleção */}
                <div className="space-y-2">
                  <h4 className="font-semibold text-foreground flex items-center justify-between">
                    <span>Registros por Coleção ({backupDetalhe.total_colecoes})</span>
                    <Badge variant="outline" className="text-[10px]">
                      Particionado em blocos de 200
                    </Badge>
                  </h4>

                  {backupDetalhe.resumo_colecoes &&
                    typeof backupDetalhe.resumo_colecoes === 'object' && (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-56 overflow-y-auto p-2 bg-background border rounded-md">
                        {Object.entries(backupDetalhe.resumo_colecoes).map(([col, qtd]) => {
                          const isErro =
                            typeof qtd === 'object' && qtd !== null && 'erro' in (qtd as object)
                          const isStringErro = typeof qtd === 'string'
                          const contagem = isErro
                            ? 'Erro'
                            : isStringErro
                              ? qtd
                              : typeof qtd === 'number'
                                ? qtd.toLocaleString('pt-BR')
                                : String(qtd ?? '-')
                          return (
                            <div
                              key={col}
                              className={`flex items-center justify-between p-1.5 rounded text-[11px] ${
                                isErro || isStringErro
                                  ? 'bg-destructive/10 text-destructive'
                                  : 'bg-muted/30 text-foreground'
                              }`}
                            >
                              <span className="font-mono truncate max-w-[120px]" title={col}>
                                {col}
                              </span>
                              <span
                                className="font-bold truncate max-w-[90px]"
                                title={String(contagem)}
                              >
                                {contagem}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    )}
                </div>
              </div>

              <DialogFooter className="gap-2 sm:gap-0">
                <Button variant="outline" onClick={() => setBackupDetalhe(null)}>
                  Fechar
                </Button>
                <Button
                  onClick={() => {
                    baixarBackupJson(backupDetalhe)
                  }}
                  className="gap-2 bg-primary text-primary-foreground"
                >
                  <ArrowDownToLine className="h-4 w-4" />
                  Baixar Arquivo JSON
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
export default Backups
