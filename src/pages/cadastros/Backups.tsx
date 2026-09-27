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
  X,
  Lightbulb,
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

  // Banner persistente de resultado de operação (Google Drive, Backup Manual, etc.)
  const [resultadoOperacao, setResultadoOperacao] = useState<{
    tipo: 'sucesso' | 'erro'
    titulo: string
    mensagem: string
    nomeBackup?: string
    detalheTecnico?: string
    dicaProvavel?: string
    dataHora: string
  } | null>(null)

  // Formulário de Configuração da Conta de Serviço
  const [modalConfigAberta, setModalConfigAberta] = useState(false)
  const [serviceAccountJsonInput, setServiceAccountJsonInput] = useState('')
  const [folderIdInput, setFolderIdInput] = useState('')
  const [usuarioEmailInput, setUsuarioEmailInput] = useState('renilsonfmello@gmail.com')
  const [salvandoConfig, setSalvandoConfig] = useState(false)
  const [etapaSalvamento, setEtapaSalvamento] = useState<
    'ocioso' | 'salvando' | 'validando_google'
  >('ocioso')
  const [avisoValidacao, setAvisoValidacao] = useState<string | null>(null)
  const [desconectando, setDesconectando] = useState(false)
  const [emailCopiado, setEmailCopiado] = useState(false)

  // Estado OAuth Google (Gmail Pessoal)
  const [modalOAuthAberta, setModalOAuthAberta] = useState(false)
  const [oauthClientIdInput, setOauthClientIdInput] = useState('')
  const [oauthClientSecretInput, setOauthClientSecretInput] = useState('')
  const [salvandoOAuth, setSalvandoOAuth] = useState(false)
  const [iniciandoOAuth, setIniciandoOAuth] = useState(false)
  const [desconectandoOAuth, setDesconectandoOAuth] = useState(false)
  const [redirectUriExibida, setRedirectUriExibida] = useState('')
  const [uriCopiada, setUriCopiada] = useState(false)

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
        if (drive.value?.usuario_email) {
          setUsuarioEmailInput(drive.value.usuario_email)
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

  // Se o usuário entrar na página e o backup mais recente tiver registrado um erro no Drive,
  // inicializamos o banner informativo com a mensagem real para que ele saiba o estado exato
  useEffect(() => {
    if (resultadoOperacao === null && backups.length > 0) {
      const maisRecente = backups[0]
      if (maisRecente && maisRecente.drive_status === 'erro' && maisRecente.drive_erro) {
        const dica = analisarCausaProvavelErro(maisRecente.drive_erro)
        setResultadoOperacao({
          tipo: 'erro',
          titulo: 'Último envio ao Google Drive falhou',
          mensagem: `A última tentativa de envio do arquivo ${maisRecente.nome_arquivo} ao Google Drive registrou uma falha.`,
          nomeBackup: maisRecente.nome_arquivo,
          detalheTecnico: maisRecente.drive_erro,
          dicaProvavel: dica,
          dataHora: maisRecente.created ? formatDateTime(maisRecente.created) : 'Registro anterior',
        })
      }
    }
    // Executa apenas uma vez no carregamento inicial da lista
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backups.length])

  useEffect(() => {
    carregarDados()
  }, [carregarDados])

  // Atualizar redirect URI esperada baseada na origem atual do app
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const origin = window.location.origin
      setRedirectUriExibida(`${origin}/backend/v1/google-drive/oauth-callback`)
    }
  }, [])

  // Ouvinte de mensagem da janela de popup do OAuth do Google
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'GOOGLE_DRIVE_OAUTH_SUCCESS') {
        toast({
          title: 'Conta Google conectada!',
          description: 'OAuth concluído com sucesso. O Google Drive está pronto para backups.',
        })
        carregarDados()
      }
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [carregarDados, toast])

  const copiarRedirectUri = () => {
    if (!redirectUriExibida) return
    try {
      if (navigator?.clipboard?.writeText) {
        navigator.clipboard.writeText(redirectUriExibida)
      } else {
        const textArea = document.createElement('textarea')
        textArea.value = redirectUriExibida
        document.body.appendChild(textArea)
        textArea.select()
        document.execCommand('copy')
        document.body.removeChild(textArea)
      }
      setUriCopiada(true)
      toast({
        title: 'URI copiada!',
        description:
          'Cole esta URI em "URIs de redirecionamento autorizados" no Google Cloud Console.',
      })
      setTimeout(() => setUriCopiada(false), 2500)
    } catch {
      toast({
        title: 'URI de redirecionamento',
        description: redirectUriExibida,
      })
    }
  }

  const salvarCredenciaisOAuth = async () => {
    const cid = oauthClientIdInput.trim()
    const csec = oauthClientSecretInput.trim()
    if (!cid || !csec) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Preencha o Client ID e o Client Secret para salvar.',
        variant: 'destructive',
      })
      return
    }

    try {
      setSalvandoOAuth(true)
      const res = await backupService.salvarConfiguracoesOAuth({
        client_id: cid,
        client_secret: csec,
      })
      toast({
        title: 'Credenciais salvas!',
        description: res.message || 'Client ID e Secret configurados com sucesso.',
      })
      setModalOAuthAberta(false)
      await carregarDados()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao salvar credenciais OAuth.'
      toast({
        title: 'Erro ao salvar',
        description: msg,
        variant: 'destructive',
      })
    } finally {
      setSalvandoOAuth(false)
    }
  }

  const conectarComGoogleOAuth = async () => {
    try {
      setIniciandoOAuth(true)
      const res = await backupService.iniciarOAuthDrive()
      const targetUrl = res.url || res.auth_url
      if (!targetUrl) {
        throw new Error(res.error || 'URL de autorização não retornada pelo servidor.')
      }

      // Abre em janela popup ou na mesma aba se popup for bloqueado
      const w = 550
      const h = 650
      const left = window.screen.width / 2 - w / 2
      const top = window.screen.height / 2 - h / 2
      const popup = window.open(
        targetUrl,
        'google_oauth_drive',
        `toolbar=no, location=no, directories=no, status=no, menubar=no, scrollbars=yes, resizable=yes, copyhistory=no, width=${w}, height=${h}, top=${top}, left=${left}`,
      )

      if (!popup || popup.closed || typeof popup.closed === 'undefined') {
        window.location.href = targetUrl
      } else {
        toast({
          title: 'Janela de consentimento aberta',
          description: 'Faça login com seu Gmail e conceda permissão para a gravação dos backups.',
        })
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao iniciar conexão com Google.'
      toast({
        title: 'Erro na conexão Google',
        description: msg,
        variant: 'destructive',
      })
    } finally {
      setIniciandoOAuth(false)
    }
  }

  const desconectarOAuth = async () => {
    if (!confirm('Deseja realmente desconectar sua conta Google Gmail pessoal dos backups?')) {
      return
    }
    try {
      setDesconectandoOAuth(true)
      await backupService.desconectarOAuthDrive()
      toast({
        title: 'Conta desconectada',
        description: 'A autorização OAuth com o Google Drive foi removida.',
      })
      await carregarDados()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao desconectar conta Google.'
      toast({
        title: 'Erro ao desconectar',
        description: msg,
        variant: 'destructive',
      })
    } finally {
      setDesconectandoOAuth(false)
    }
  }

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

      const payload: {
        service_account_json?: string
        folder_id?: string
        folder_name?: string
        usuario_email?: string
      } = {}

      if (serviceAccountJsonInput.trim()) {
        payload.service_account_json = serviceAccountJsonInput.trim()
      }
      payload.folder_id = folderIdInput.trim()
      payload.usuario_email = usuarioEmailInput.trim() || 'renilsonfmello@gmail.com'

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

  const analisarCausaProvavelErro = (erroTexto: string) => {
    const txt = (erroTexto || '').toLowerCase()
    if (
      txt.includes('service accounts do not have storage quota') ||
      txt.includes('quota') ||
      txt.includes('storage')
    ) {
      return 'Contas de serviço do Google não possuem cota para gravar em pastas normais do Gmail. O ERP agora faz o upload no Drive próprio da conta de serviço e compartilha automaticamente o arquivo com seu email (aparece em "Compartilhado comigo" no Google Drive).'
    }
    if (txt.includes('404') || txt.includes('not found') || txt.includes('file not found')) {
      return 'A pasta configurada no Google Drive não foi encontrada. Verifique se o ID da pasta está correto e se a pasta foi compartilhada com a Conta de Serviço.'
    }
    if (
      txt.includes('403') ||
      txt.includes('permission') ||
      txt.includes('access') ||
      txt.includes('unauthorized') ||
      txt.includes('forbidden')
    ) {
      return 'Permissão negada no Google Drive. Certifique-se de que compartilhou a pasta do Drive com o email da conta de serviço atribuindo a permissão "Editor", e de que a API Google Drive está ativada no seu Google Cloud Console.'
    }
    if (
      txt.includes('invalid_grant') ||
      txt.includes('jwt') ||
      txt.includes('signature') ||
      txt.includes('token')
    ) {
      return 'Falha na validação da chave criptográfica da Conta de Serviço. Pode ser que a chave privada esteja corrompida ou o relógio do servidor esteja dessincronizado.'
    }
    if (txt.includes('timeout') || txt.includes('deadline') || txt.includes('context canceled')) {
      return 'Tempo limite de resposta excedido ao conectar com os servidores do Google. Tente novamente em alguns instantes.'
    }
    if (
      txt.includes('drive api') ||
      txt.includes('api not enabled') ||
      txt.includes('accessnotconfigured')
    ) {
      return 'A API Google Drive não está habilitada no projeto do Google Cloud. Acesse o Google Cloud Console e clique em "Ativar API Google Drive".'
    }
    return 'Verifique as credenciais da Conta de Serviço e se a pasta do Drive foi compartilhada com o email técnico com permissão de Editor.'
  }

  const executarBackupManual = async () => {
    try {
      setExecutando(true)
      toast({
        title: 'Iniciando backup...',
        description: 'Coletando todas as 28 coleções do sistema com integridade total.',
      })

      const novoBackup = await backupService.executarBackupManual()

      setResultadoOperacao({
        tipo: 'sucesso',
        titulo: 'Backup gerado com sucesso!',
        mensagem: `O arquivo ${novoBackup.nome_arquivo} foi consolidado com sucesso com ${(novoBackup.total_registros || 0).toLocaleString('pt-BR')} registros e ${novoBackup.total_colecoes || 0} coleções.`,
        nomeBackup: novoBackup.nome_arquivo,
        dataHora: new Date().toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
      })

      toast({
        title: 'Backup concluído com sucesso!',
        description: `Arquivo ${novoBackup.nome_arquivo} gerado com ${novoBackup.total_registros} registros.`,
      })

      await carregarDados()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao processar o backup.'
      setResultadoOperacao({
        tipo: 'erro',
        titulo: 'Falha na execução do backup',
        mensagem: 'Não foi possível gerar o dump de backup do sistema.',
        detalheTecnico: msg,
        dicaProvavel: 'Verifique se há espaço suficiente e permissões no banco de dados.',
        dataHora: new Date().toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
      })
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
    const backupAlvo = backups.find((b) => b.id === backupId)
    const nomeBackupAlvo = backupAlvo?.nome_arquivo || `backup_${backupId}.json`

    try {
      setEnviandoDriveId(backupId)
      toast({
        title: 'Enviando ao Drive...',
        description: `Autenticando via Conta de Serviço e transferindo ${nomeBackupAlvo}.`,
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

      const msgSucesso =
        res?.message ||
        `O arquivo ${nomeBackupAlvo} foi enviado com sucesso e está disponível em "Compartilhado comigo" no seu Google Drive.`

      // Banner fixo e persistente de sucesso
      setResultadoOperacao({
        tipo: 'sucesso',
        titulo: 'Backup enviado com sucesso ao Google Drive',
        mensagem: msgSucesso,
        nomeBackup: nomeBackupAlvo,
        dataHora: new Date().toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
      })

      toast({
        title: 'Backup enviado com sucesso ao Google Drive!',
        description: msgSucesso,
      })

      await carregarDados()
    } catch (err: unknown) {
      // Desempacotamento completo de erro sem mascarar código HTTP nem a causa real
      const errObj = typeof err === 'object' && err !== null ? (err as Record<string, unknown>) : {}
      const httpStatus = typeof errObj.status === 'number' ? errObj.status : undefined
      const responseObj =
        errObj.response && typeof errObj.response === 'object'
          ? (errObj.response as Record<string, unknown>)
          : undefined
      const dataObj =
        errObj.data && typeof errObj.data === 'object'
          ? (errObj.data as Record<string, unknown>)
          : undefined
      const origError =
        errObj.originalError && typeof errObj.originalError === 'object'
          ? (errObj.originalError as Record<string, unknown>)
          : undefined

      const backendMessage =
        (responseObj?.message as string) ||
        (responseObj?.error as string) ||
        (dataObj?.message as string) ||
        (dataObj?.error as string) ||
        (origError?.message as string) ||
        (err instanceof Error ? err.message : '') ||
        'Erro desconhecido'

      let msgFormatada = ''
      if (
        httpStatus === 0 ||
        (!httpStatus && backendMessage.toLowerCase().includes('failed to fetch'))
      ) {
        msgFormatada = `Erro de conexão ao contatar o servidor (Status 0): verifique a rede ou preflight CORS. Detalhe: ${backendMessage}`
      } else if (httpStatus) {
        msgFormatada = `[HTTP ${httpStatus}] ${backendMessage}`
      } else {
        msgFormatada = backendMessage
      }

      // Atualização imediata no estado local para refletir a mensagem real da falha
      setBackups((prev) =>
        prev.map((b) =>
          b.id === backupId
            ? {
                ...b,
                drive_status: 'erro',
                drive_erro: msgFormatada,
              }
            : b,
        ),
      )

      const dica = analisarCausaProvavelErro(msgFormatada)

      // Banner fixo e persistente de erro SEMPRE com código HTTP e mensagem real
      setResultadoOperacao({
        tipo: 'erro',
        titulo: 'Falha no envio ao Google Drive',
        mensagem: `O envio do arquivo ${nomeBackupAlvo} para o Google Drive falhou.`,
        nomeBackup: nomeBackupAlvo,
        detalheTecnico: msgFormatada,
        dicaProvavel: dica,
        dataHora: new Date().toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
      })

      toast({
        title: 'Erro no envio ao Google Drive',
        description: msgFormatada,
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

          <Button
            onClick={executarBackupManual}
            disabled={executando}
            className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs"
            title="Gerar backup completo imediato de todas as coleções do sistema"
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
        </div>
      </div>

      {/* Card 1: Conectar sua Conta Google Pessoal via OAuth (Recomendado) */}
      <Card className="border-2 border-primary/20 shadow-sm overflow-hidden bg-gradient-to-br from-card via-card to-primary/5">
        <div className="bg-primary/10 border-b border-primary/20 px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary text-primary-foreground flex items-center justify-center shrink-0 shadow-sm">
              <Cloud className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-semibold text-foreground">
                  Conectar sua conta Google Drive (Recomendado)
                </h2>
                {driveStatus?.oauth_status === 'conectado' ? (
                  <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white text-xs gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Conta Conectada
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="text-amber-600 border-amber-500/40 bg-amber-500/10 text-xs"
                  >
                    OAuth Pendente
                  </Badge>
                )}
                <Badge
                  variant="secondary"
                  className="text-[10px] uppercase font-bold tracking-wider"
                >
                  Cota Total do seu Gmail
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Grava os backups automaticamente no seu próprio Google Drive pessoal, com cota
                completa e sem bloqueio de Service Account.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (driveStatus?.oauth_client_id) {
                  setOauthClientIdInput(driveStatus.oauth_client_id)
                }
                setModalOAuthAberta(true)
              }}
              className="gap-1.5"
            >
              <KeyRound className="h-4 w-4 text-primary" />
              {driveStatus?.oauth_client_id ? 'Editar Client ID / Secret' : 'Configurar Client ID'}
            </Button>

            {driveStatus?.oauth_status === 'conectado' ? (
              isAdmin && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={desconectarOAuth}
                  disabled={desconectandoOAuth}
                  className="gap-1 text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {desconectandoOAuth ? 'Desconectando...' : 'Desconectar'}
                </Button>
              )
            ) : (
              <Button
                size="sm"
                onClick={conectarComGoogleOAuth}
                disabled={iniciandoOAuth}
                className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
              >
                {iniciandoOAuth ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <ExternalLink className="h-4 w-4" />
                )}
                Conectar com Google
              </Button>
            )}
          </div>
        </div>

        <CardContent className="p-6 space-y-4">
          {driveStatus?.oauth_status === 'conectado' ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-muted/40 p-4 rounded-lg border border-emerald-500/30">
              <div className="space-y-1">
                <div className="text-xs font-medium text-muted-foreground uppercase flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  Status da Autenticação
                </div>
                <div className="text-sm font-semibold text-emerald-600 flex items-center gap-1.5">
                  <span>Autorizado via OAuth 2.0</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Refresh token ativo. Os envios de fatias (256KB) renovam tokens com cota pessoal.
                </p>
              </div>

              <div className="space-y-1">
                <div className="text-xs font-medium text-muted-foreground uppercase flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                  Client ID Configurado
                </div>
                <div
                  className="text-xs font-mono text-foreground truncate"
                  title={driveStatus.oauth_client_id || ''}
                >
                  {driveStatus.oauth_client_id
                    ? `${driveStatus.oauth_client_id.slice(0, 18)}...apps.googleusercontent.com`
                    : 'Configurado ✓'}
                </div>
                <p className="text-xs text-muted-foreground">
                  Permissão restrita aos arquivos gerados pelo ERP (
                  <code className="text-[10px]">drive.file</code>).
                </p>
              </div>

              <div className="space-y-1">
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
                  Envio automático semanal ou manual direto da tabela abaixo.
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                  <h3 className="text-sm font-semibold text-foreground">
                    Passo 1: Configure seu Client ID e conecte sua conta Google
                  </h3>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Para o Google permitir a conexão com seu Gmail, crie um{' '}
                  <strong>ID do cliente OAuth (Aplicativo da Web)</strong> no Google Cloud Console e
                  informe a URI de redirecionamento autorizada exibida abaixo.
                </p>
                <div className="pt-2 flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] font-semibold text-foreground">
                    URI de redirecionamento exata:
                  </span>
                  <code className="bg-background px-2 py-1 rounded text-xs font-mono border text-primary font-medium select-all">
                    {redirectUriExibida ||
                      'https://erp-empresarial-completo-575bb.shrd00.internal.goskip.dev/backend/v1/google-drive/oauth-callback'}
                  </code>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={copiarRedirectUri}
                    className="h-7 text-xs gap-1"
                  >
                    {uriCopiada ? (
                      <Check className="h-3 w-3 text-emerald-600" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                    {uriCopiada ? 'Copiada!' : 'Copiar URI'}
                  </Button>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Button
                  size="sm"
                  onClick={() => setModalOAuthAberta(true)}
                  variant="outline"
                  className="gap-1.5"
                >
                  <KeyRound className="h-4 w-4 text-primary" />
                  Cadastrar Chaves
                </Button>
                <Button
                  size="sm"
                  onClick={conectarComGoogleOAuth}
                  disabled={iniciandoOAuth}
                  className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {iniciandoOAuth ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <ExternalLink className="h-4 w-4" />
                  )}
                  Conectar com Google
                </Button>
              </div>
            </div>
          )}

          {/* Instruções passo a passo do OAuth em acordeão recolhível */}
          <Accordion
            type="single"
            collapsible
            className="w-full border rounded-lg px-4 bg-muted/20"
          >
            <AccordionItem value="passo-oauth" className="border-none">
              <AccordionTrigger className="text-xs font-medium text-muted-foreground hover:text-foreground py-3">
                <span className="flex items-center gap-2">
                  <HelpCircle className="h-4 w-4 text-primary" />
                  Como criar o OAuth Client ID no Google Cloud Console (Passo a passo rápido)
                </span>
              </AccordionTrigger>
              <AccordionContent className="text-xs text-muted-foreground space-y-3 pt-1 pb-4">
                <ol className="list-decimal pl-5 space-y-2 text-foreground/90">
                  <li>
                    Acesse o{' '}
                    <a
                      href="https://console.cloud.google.com/apis/credentials"
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary underline font-medium inline-flex items-center gap-0.5"
                    >
                      Google Cloud Console &rarr; Credenciais
                      <ExternalLink className="h-3 w-3" />
                    </a>
                    .
                  </li>
                  <li>
                    Se for a primeira vez, configure a <strong>Tela de consentimento OAuth</strong>{' '}
                    (Tipo de usuário: Externo, adicione seu email como usuário de teste).
                  </li>
                  <li>
                    Clique em <strong>+ Criar credenciais</strong> &rarr; selecione{' '}
                    <strong>ID do cliente OAuth</strong>.
                  </li>
                  <li>
                    Em <em>Tipo de aplicativo</em>, selecione <strong>Aplicativo da Web</strong>.
                  </li>
                  <li>
                    Em <strong>URIs de redirecionamento autorizados</strong>, clique em{' '}
                    <strong>+ Adicionar URI</strong> e cole exatamente:
                    <div className="mt-1">
                      <code className="bg-background px-2 py-1 rounded text-[11px] font-mono border text-primary block w-fit select-all">
                        {redirectUriExibida ||
                          'https://erp-empresarial-completo-575bb.shrd00.internal.goskip.dev/backend/v1/google-drive/oauth-callback'}
                      </code>
                    </div>
                  </li>
                  <li>
                    Clique em <strong>Criar</strong>, copie o <strong>Client ID</strong> e o{' '}
                    <strong>Client Secret</strong> e cole no botão <strong>Cadastrar Chaves</strong>{' '}
                    acima.
                  </li>
                  <li>
                    Clique em <strong>Conectar com Google</strong> para autorizar o acesso à sua
                    conta pessoal do Google Drive. Pronto!
                  </li>
                </ol>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

      {/* Cartão de Integração Google Drive via Conta de Serviço (Método Alternativo / Fallback) */}
      <Card className="border border-border/80 shadow-sm overflow-hidden bg-gradient-to-br from-card via-card to-muted/20">
        <div className="bg-muted/40 border-b border-border/60 px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-muted text-muted-foreground flex items-center justify-center shrink-0">
              <KeyRound className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-foreground">
                  Método Alternativo: Conta de Serviço (Service Account)
                </h2>
                {driveStatus?.chave_configurada ? (
                  <Badge variant="outline" className="text-xs text-muted-foreground">
                    Configurada (Fallback)
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-xs text-muted-foreground/60">
                    Opcional
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Utilizado como plano B caso o OAuth do Gmail não esteja conectado.
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
              {driveStatus?.chave_configurada ? 'Alterar Credenciais SA' : 'Configurar Chave JSON'}
            </Button>

            {driveStatus?.chave_configurada && isAdmin && (
              <Button
                variant="ghost"
                size="sm"
                onClick={desconectarDrive}
                disabled={desconectando}
                className="gap-1 text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Desconectar SA
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

              {/* Compartilhamento e Destino no Google Drive */}
              <div className="space-y-1 md:col-span-1">
                <div className="text-xs font-medium text-muted-foreground uppercase flex items-center gap-1.5">
                  <FolderSync className="h-3.5 w-3.5 text-primary" />
                  Destino e Compartilhamento
                </div>
                <div className="text-sm font-semibold text-foreground flex items-center gap-1.5 flex-wrap">
                  <span>
                    {driveStatus.usuario_email
                      ? `Compartilhado com ${driveStatus.usuario_email}`
                      : 'renilsonfmello@gmail.com'}
                  </span>
                  <Badge
                    variant="outline"
                    className="text-[10px] font-mono border-emerald-500/30 text-emerald-600 bg-emerald-500/5"
                  >
                    Compartilhado comigo ✓
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {driveStatus.pasta_id
                    ? `Fallback automático ativado (pasta ID: ${driveStatus.pasta_id.slice(0, 8)}...)`
                    : 'Disponível na aba "Compartilhado comigo" no Google Drive.'}
                </p>
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
                  Envio automático semanal (domingo 00h30) com compartilhamento para{' '}
                  {driveStatus.usuario_email || 'renilsonfmello@gmail.com'}.
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
                    depender de telas de consentimento, configure uma Conta de Serviço gratuita no
                    Google Cloud.
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
              {driveStatus?.oauth_status === 'conectado'
                ? 'OAuth Gmail conectado'
                : driveStatus?.configurado
                  ? 'Drive ativo'
                  : 'Drive pendente'}
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

      {/* Banner / Alerta Fixo de Resultado de Operação (Drive ou Backup Manual) */}
      {resultadoOperacao && (
        <div
          role="alert"
          className={`rounded-lg border p-4 shadow-sm transition-all animate-in fade-in slide-in-from-top-2 duration-200 ${
            resultadoOperacao.tipo === 'sucesso'
              ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-950 dark:text-emerald-100'
              : 'bg-destructive/10 border-destructive/40 text-destructive dark:text-red-200'
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              {resultadoOperacao.tipo === 'sucesso' ? (
                <div className="h-9 w-9 rounded-full bg-emerald-500/20 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
              ) : (
                <div className="h-9 w-9 rounded-full bg-destructive/20 text-destructive flex items-center justify-center shrink-0 mt-0.5">
                  <AlertTriangle className="h-5 w-5" />
                </div>
              )}

              <div className="space-y-1.5 flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm">
                    {resultadoOperacao.tipo === 'sucesso' ? '✅' : '❌'} {resultadoOperacao.titulo}
                  </span>
                  {resultadoOperacao.nomeBackup && (
                    <Badge
                      variant="outline"
                      className={`text-xs font-mono font-medium ${
                        resultadoOperacao.tipo === 'sucesso'
                          ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                          : 'border-destructive/40 bg-destructive/10 text-destructive dark:text-red-300'
                      }`}
                    >
                      {resultadoOperacao.nomeBackup}
                    </Badge>
                  )}
                  <span className="text-[11px] text-muted-foreground ml-auto">
                    {resultadoOperacao.dataHora}
                  </span>
                </div>

                <p className="text-xs text-foreground/90 leading-relaxed">
                  {resultadoOperacao.mensagem}
                </p>

                {/* Seção de Detalhe Técnico em caso de erro */}
                {resultadoOperacao.tipo === 'erro' && resultadoOperacao.detalheTecnico && (
                  <div className="mt-2 bg-background/80 border border-destructive/30 rounded p-2.5 font-mono text-[11px] text-destructive dark:text-red-300 break-words space-y-1">
                    <span className="font-sans font-semibold text-[10px] uppercase tracking-wider block text-muted-foreground">
                      Mensagem de Erro Completa:
                    </span>
                    <p className="select-all whitespace-pre-wrap">
                      {resultadoOperacao.detalheTecnico}
                    </p>
                  </div>
                )}

                {/* Seção de Dica da Causa Provável */}
                {resultadoOperacao.tipo === 'erro' && resultadoOperacao.dicaProvavel && (
                  <div className="mt-2 flex items-start gap-2 bg-amber-500/10 border border-amber-500/30 rounded p-2.5 text-xs text-amber-900 dark:text-amber-200">
                    <Lightbulb className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="block font-semibold">
                        Causa provável e como resolver:
                      </strong>
                      <span>{resultadoOperacao.dicaProvavel}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setResultadoOperacao(null)}
              className="h-7 w-7 p-0 shrink-0 text-muted-foreground hover:text-foreground"
              title="Fechar aviso"
              aria-label="Fechar banner de resultado"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

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
                        ) : item.drive_status === 'enviando' ? (
                          <Badge className="bg-amber-500 hover:bg-amber-600 text-white text-[10px] gap-1 shadow-xs">
                            <RefreshCw className="h-3 w-3 animate-spin" />
                            Enviando ao Drive…{' '}
                            {item.drive_total_bytes && item.drive_total_bytes > 0
                              ? `${Math.min(100, Math.round(((item.drive_offset || 0) / item.drive_total_bytes) * 100))}%`
                              : ''}
                          </Badge>
                        ) : item.drive_status === 'solicitado' ? (
                          <Badge
                            variant="secondary"
                            className="text-[10px] gap-1 bg-amber-500/15 text-amber-700 dark:text-amber-300"
                          >
                            <Clock className="h-3 w-3" />
                            Na fila do Drive
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

      {/* Modal de Configuração do OAuth Client ID (Gmail Pessoal) */}
      <Dialog open={modalOAuthAberta} onOpenChange={setModalOAuthAberta}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary" />
              Configurar OAuth 2.0 (Google Drive Pessoal)
            </DialogTitle>
            <DialogDescription>
              Insira o Client ID e Client Secret criados no Google Cloud Console para autorizar o
              acesso à sua conta pessoal do Google Drive.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="oauth-client-id" className="text-xs font-semibold">
                Client ID do OAuth (Google Cloud) *
              </Label>
              <Input
                id="oauth-client-id"
                placeholder="Ex: 123456789-abcdefgh.apps.googleusercontent.com"
                value={oauthClientIdInput}
                onChange={(e) => setOauthClientIdInput(e.target.value)}
                className="text-xs font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="oauth-client-secret" className="text-xs font-semibold">
                Client Secret do OAuth *
              </Label>
              <Input
                id="oauth-client-secret"
                type="password"
                placeholder="Ex: GOCSPX-xxxxxxxxxxxxxxxxxxxxxxxx"
                value={oauthClientSecretInput}
                onChange={(e) => setOauthClientSecretInput(e.target.value)}
                className="text-xs font-mono"
              />
              <p className="text-[11px] text-muted-foreground">
                O Client Secret é armazenado com proteção no banco de dados e nunca é compartilhado
                publicamente.
              </p>
            </div>

            <div className="bg-muted p-3 rounded-lg border space-y-1.5 text-xs">
              <div className="font-semibold text-foreground flex items-center justify-between">
                <span>URI de Redirecionamento autorizada necessária no Google Cloud:</span>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={copiarRedirectUri}
                  className="h-6 text-[11px] gap-1 px-1.5 text-primary"
                >
                  {uriCopiada ? (
                    <Check className="h-3 w-3 text-emerald-600" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                  {uriCopiada ? 'Copiada' : 'Copiar'}
                </Button>
              </div>
              <code className="block bg-background p-2 rounded text-[11px] font-mono border break-all text-primary select-all">
                {redirectUriExibida ||
                  'https://erp-empresarial-completo-575bb.shrd00.internal.goskip.dev/backend/v1/google-drive/oauth-callback'}
              </code>
              <p className="text-[11px] text-muted-foreground">
                No Google Cloud Console, cole exatamente esta URL no campo{' '}
                <strong>URIs de redirecionamento autorizados</strong> das suas credenciais.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setModalOAuthAberta(false)}
              disabled={salvandoOAuth}
            >
              Cancelar
            </Button>
            <Button
              onClick={salvarCredenciaisOAuth}
              disabled={
                salvandoOAuth || !oauthClientIdInput.trim() || !oauthClientSecretInput.trim()
              }
              className="gap-2 bg-primary text-primary-foreground"
            >
              {salvandoOAuth ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Salvar Credenciais'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

            {/* Campo 2: Email para Compartilhamento do Backup */}
            <div className="space-y-1.5">
              <Label htmlFor="usuario-email" className="text-xs font-semibold">
                Email do Usuário para Compartilhar o Backup *
              </Label>
              <Input
                id="usuario-email"
                type="email"
                placeholder="Ex: renilsonfmello@gmail.com"
                value={usuarioEmailInput}
                onChange={(e) => setUsuarioEmailInput(e.target.value)}
                className="text-xs"
              />
              <div className="bg-emerald-500/10 border border-emerald-500/20 p-2.5 rounded text-[11px] text-foreground/90 space-y-1">
                <div className="font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                  Compartilhamento Automático (Compatível com contas normais @gmail.com):
                </div>
                <p>
                  A Conta de Serviço grava o arquivo de backup e o compartilha imediatamente com
                  este e-mail. O arquivo aparecerá na aba{' '}
                  <strong>&quot;Compartilhado comigo&quot;</strong> do seu Google Drive, sem
                  necessidade de Google Workspace ou Unidades Compartilhadas.
                </p>
              </div>
            </div>

            {/* Campo 3: ID da Pasta Compartilhada no Google Drive (Opcional / Fallback) */}
            <div className="space-y-1.5">
              <Label htmlFor="folder-id" className="text-xs font-semibold text-muted-foreground">
                ID da Pasta ou Unidade Compartilhada (Opcional)
              </Label>
              <Input
                id="folder-id"
                placeholder="Ex: 1sbDoZucOc8Vea2F0nXtc07FKsSlzdX7V (opcional)"
                value={folderIdInput}
                onChange={(e) => setFolderIdInput(e.target.value)}
                className="text-xs font-mono"
              />
              <p className="text-[11px] text-muted-foreground">
                Se informado, o sistema tenta primeiro gravar nessa pasta; caso a conta não tenha
                cota (como no Gmail comum), o fallback automático envia para o Drive da conta de
                serviço e compartilha com o e-mail acima.
              </p>
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
                        : backupDetalhe.drive_status === 'enviando'
                          ? `Enviando (${backupDetalhe.drive_total_bytes ? Math.min(100, Math.round(((backupDetalhe.drive_offset || 0) / backupDetalhe.drive_total_bytes) * 100)) : 0}%)`
                          : backupDetalhe.drive_status === 'solicitado'
                            ? 'Na Fila de Envio'
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
