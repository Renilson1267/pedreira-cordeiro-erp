import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useCompany } from '@/contexts/CompanyContext'
import { videoInstitucionalService, VideoInstitucionalRecord } from '@/services/videoInstitucional'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { toast } from '@/hooks/use-toast'
import { formatDateTime } from '@/lib/formatters'
import {
  Video,
  UploadCloud,
  Play,
  Trash2,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  FileVideo,
  ExternalLink,
  ShieldAlert,
  Power,
  Eye,
  Info,
  Clock,
  HardDrive,
  User,
  Sparkles,
} from 'lucide-react'

// Limite: 200 MB
const MAX_FILE_SIZE_BYTES = 200 * 1024 * 1024

function formatBytes(bytes?: number): string {
  if (!bytes || bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

function formatDuracao(segundos?: number): string {
  if (!segundos || segundos <= 0) return 'Não informada'
  const m = Math.floor(segundos / 60)
  const s = Math.floor(segundos % 60)
  return `${m}:${s < 10 ? '0' : ''}${s} min`
}

export default function VideoInstitucional() {
  const { user } = useAuth()
  const { isAdmin } = useCompany()

  const [videos, setVideos] = useState<VideoInstitucionalRecord[]>([])
  const [loading, setLoading] = useState(true)

  // Estado do formulário de upload / substituição
  const [modalUploadOpen, setModalUploadOpen] = useState(false)
  const [substituindoId, setSubstituindoId] = useState<string | null>(null)
  const [titulo, setTitulo] = useState('Vídeo Institucional — Pedreira Cordeiro')
  const [descricao, setDescricao] = useState('')
  const [arquivoSelecionado, setArquivoSelecionado] = useState<File | null>(null)
  const [posterSelecionado, setPosterSelecionado] = useState<File | null>(null)
  const [previewVideoUrl, setPreviewVideoUrl] = useState<string | null>(null)
  const [previewPosterUrl, setPreviewPosterUrl] = useState<string | null>(null)
  const [duracaoDetectada, setDuracaoDetectada] = useState<number | undefined>(undefined)
  const [tornarAtivo, setTornarAtivo] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [progressoTexto, setProgressoTexto] = useState('')
  const [progressoUpload, setProgressoUpload] = useState<{
    carregadoBytes: number
    totalBytes: number
    porcentagem: number
    etapa: 'preparando' | 'enviando' | 'processando' | 'concluido'
    chunkAtual?: number
    totalChunks?: number
    tentativa?: number
  } | null>(null)

  // Modal de confirmação de exclusão
  const [itemParaExcluir, setItemParaExcluir] = useState<VideoInstitucionalRecord | null>(null)
  const [excluindo, setExcluindo] = useState(false)

  // Modal de confirmação de desativação
  const [itemParaDesativar, setItemParaDesativar] = useState<VideoInstitucionalRecord | null>(null)

  // Modal de preview player
  const [videoParaPreview, setVideoParaPreview] = useState<VideoInstitucionalRecord | null>(null)

  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const posterInputRef = useRef<HTMLInputElement | null>(null)

  const carregarVideos = useCallback(async () => {
    try {
      setLoading(true)
      const lista = await videoInstitucionalService.listar()
      setVideos(lista)
    } catch (err: any) {
      toast({
        title: 'Erro ao carregar vídeos',
        description: err.message || 'Não foi possível carregar a lista de vídeos institucionais.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isAdmin) {
      carregarVideos()
    }
  }, [isAdmin, carregarVideos])

  // Limpar ObjectURLs quando desmontar
  useEffect(() => {
    return () => {
      if (previewVideoUrl) URL.revokeObjectURL(previewVideoUrl)
      if (previewPosterUrl) URL.revokeObjectURL(previewPosterUrl)
    }
  }, [previewVideoUrl, previewPosterUrl])

  // Identifica o vídeo atualmente ativo na Home pública
  const videoAtivo = videos.find((v) => v.ativo)

  // Tratamento da seleção do arquivo de vídeo
  const handleSelecionarArquivo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Valida extensão e mime type
    const extensoesValidas = ['.mp4', '.webm', '.ogg', '.mov']
    const ehExtensaoValida = extensoesValidas.some((ext) => file.name.toLowerCase().endsWith(ext))
    const ehMimeValido =
      file.type.startsWith('video/') || file.type === 'video/mp4' || file.type === 'video/webm'

    if (!ehExtensaoValida && !ehMimeValido) {
      toast({
        title: 'Formato inválido',
        description: 'Por favor, selecione um arquivo de vídeo no formato MP4 ou WebM.',
        variant: 'destructive',
      })
      e.target.value = ''
      return
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      toast({
        title: 'Arquivo muito grande',
        description: `O vídeo não pode ultrapassar 200 MB (tamanho atual: ${formatBytes(file.size)}). Otimize o arquivo antes de enviar.`,
        variant: 'destructive',
      })
      e.target.value = ''
      return
    }

    if (previewVideoUrl) {
      URL.revokeObjectURL(previewVideoUrl)
    }

    const objectUrl = URL.createObjectURL(file)
    setPreviewVideoUrl(objectUrl)
    setArquivoSelecionado(file)

    // Tentar extrair a duração via elemento de vídeo temporário
    try {
      const tempVideo = document.createElement('video')
      tempVideo.preload = 'metadata'
      tempVideo.src = objectUrl
      tempVideo.onloadedmetadata = () => {
        if (tempVideo.duration && !isNaN(tempVideo.duration)) {
          setDuracaoDetectada(tempVideo.duration)
        }
      }
    } catch {
      /* intentionally ignored */
    }
  }

  // Tratamento da seleção do poster/capa opcional
  const handleSelecionarPoster = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Formato inválido de capa',
        description: 'Selecione uma imagem JPG, PNG ou WebP.',
        variant: 'destructive',
      })
      e.target.value = ''
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: 'Imagem muito grande',
        description: 'A imagem de capa não pode exceder 10 MB.',
        variant: 'destructive',
      })
      e.target.value = ''
      return
    }

    if (previewPosterUrl) {
      URL.revokeObjectURL(previewPosterUrl)
    }

    const objectUrl = URL.createObjectURL(file)
    setPreviewPosterUrl(objectUrl)
    setPosterSelecionado(file)
  }

  // Abre modal para novo upload
  const abrirModalNovoUpload = () => {
    setSubstituindoId(null)
    setTitulo(
      videoAtivo
        ? `Vídeo Institucional — Pedreira Cordeiro (${new Date().toLocaleDateString('pt-BR')})`
        : 'Vídeo Institucional — Pedreira Cordeiro',
    )
    setDescricao('Vídeo oficial de apresentação institucional da Pedreira Cordeiro e GC Mix.')
    setArquivoSelecionado(null)
    setPosterSelecionado(null)
    if (previewVideoUrl) URL.revokeObjectURL(previewVideoUrl)
    if (previewPosterUrl) URL.revokeObjectURL(previewPosterUrl)
    setPreviewVideoUrl(null)
    setPreviewPosterUrl(null)
    setDuracaoDetectada(undefined)
    setTornarAtivo(true)
    setModalUploadOpen(true)
  }

  // Abre modal para substituir um vídeo específico
  const abrirModalSubstituicao = (video: VideoInstitucionalRecord) => {
    setSubstituindoId(video.id)
    setTitulo(video.titulo)
    setDescricao(video.descricao || '')
    setArquivoSelecionado(null)
    setPosterSelecionado(null)
    if (previewVideoUrl) URL.revokeObjectURL(previewVideoUrl)
    if (previewPosterUrl) URL.revokeObjectURL(previewPosterUrl)
    setPreviewVideoUrl(null)
    setPreviewPosterUrl(null)
    setDuracaoDetectada(undefined)
    setTornarAtivo(true)
    setModalUploadOpen(true)
  }

  // Submissão do upload ou substituição
  const handleSalvarUpload = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!arquivoSelecionado) {
      toast({
        title: 'Nenhum vídeo selecionado',
        description: 'Selecione um arquivo de vídeo .mp4 para prosseguir.',
        variant: 'destructive',
      })
      return
    }

    if (!titulo.trim()) {
      toast({
        title: 'Título obrigatório',
        description: 'Informe um título para identificação do vídeo institucional.',
        variant: 'destructive',
      })
      return
    }

    try {
      setSalvando(true)
      setProgressoTexto('Iniciando envio...')
      setProgressoUpload({
        carregadoBytes: 0,
        totalBytes: arquivoSelecionado.size,
        porcentagem: 0,
        etapa: 'preparando',
      })

      const params = {
        titulo: titulo.trim(),
        descricao: descricao.trim(),
        arquivo: arquivoSelecionado,
        poster: posterSelecionado,
        ativo: tornarAtivo,
        duracaoSegundos: duracaoDetectada,
        enviadoPorNome: user?.name || 'Administrador',
        enviadoPorId: user?.id,
        onProgress: (info: {
          carregadoBytes: number
          totalBytes: number
          porcentagem: number
          etapa: 'preparando' | 'enviando' | 'processando' | 'concluido'
          chunkAtual?: number
          totalChunks?: number
          tentativa?: number
        }) => {
          setProgressoUpload(info)
          if (info.etapa === 'preparando') {
            setProgressoTexto('Preparando arquivo e iniciando conexão...')
          } else if (info.etapa === 'enviando') {
            const mbEnviados = (info.carregadoBytes / (1024 * 1024)).toFixed(1)
            const mbTotal = (info.totalBytes / (1024 * 1024)).toFixed(1)
            const blocoInfo =
              info.chunkAtual && info.totalChunks
                ? ` • Bloco ${info.chunkAtual}/${info.totalChunks}`
                : ''
            const tentativaInfo =
              info.tentativa && info.tentativa > 1 ? ` (tentativa ${info.tentativa})` : ''
            setProgressoTexto(
              `Enviando: ${mbEnviados} MB de ${mbTotal} MB (${info.porcentagem}%)${blocoInfo}${tentativaInfo}`,
            )
          } else if (info.etapa === 'processando') {
            setProgressoTexto('Todos os blocos enviados. Processando e publicando no servidor...')
          } else if (info.etapa === 'concluido') {
            setProgressoTexto('Vídeo institucional publicado com sucesso!')
          }
        },
      }

      if (substituindoId) {
        await videoInstitucionalService.substituir(substituindoId, params)
        toast({
          title: 'Vídeo institucional substituído!',
          description: 'O novo vídeo foi salvo com sucesso e já está disponível na Home pública.',
        })
      } else {
        await videoInstitucionalService.criar(params, tornarAtivo)
        toast({
          title: 'Vídeo institucional publicado!',
          description:
            'Upload concluído com sucesso. O vídeo já está ativo na Home pública do site.',
        })
      }

      setModalUploadOpen(false)
      await carregarVideos()
    } catch (err: any) {
      console.error('Erro ao enviar vídeo institucional:', err)
      const rawMsg = err?.message || ''
      let tituloErro = 'Falha no envio do vídeo'
      let descErro = rawMsg || 'Ocorreu um erro durante o upload do vídeo.'

      if (
        rawMsg.includes('ultrapassa o limite') ||
        rawMsg.includes('200 MB') ||
        rawMsg.includes('413')
      ) {
        tituloErro = 'Arquivo excede o limite máximo'
        descErro = `O vídeo selecionado excede 200 MB (${formatBytes(arquivoSelecionado?.size)}). Comprima ou reexporte o vídeo em resolução 1080p ou 720p.`
      } else if (
        rawMsg.includes('Failed to fetch') ||
        rawMsg.includes('NetworkError') ||
        rawMsg.includes('timeout') ||
        rawMsg.includes('ERR_CONNECTION') ||
        rawMsg.includes('conexão')
      ) {
        tituloErro = 'Erro de Conexão / Limite de Rede'
        descErro =
          'A conexão com o servidor foi interrompida ou o navegador bloqueou a requisição. O sistema usa envio fracionado automático; tente novamente com uma conexão estável.'
      } else if (rawMsg.includes('401') || rawMsg.includes('Não autorizado')) {
        tituloErro = 'Sessão Expirada'
        descErro = 'Sua autenticação expirou. Recarregue a página ou faça login novamente.'
      }

      toast({
        title: tituloErro,
        description: descErro,
        variant: 'destructive',
      })
    } finally {
      setSalvando(false)
      setProgressoTexto('')
      setProgressoUpload(null)
    }
  }

  // Alternar status ativo
  const handleAlternarAtivo = async (video: VideoInstitucionalRecord) => {
    if (video.ativo) {
      // Se for desativar o único ativo, pedir confirmação
      setItemParaDesativar(video)
      return
    }

    try {
      await videoInstitucionalService.alternarAtivo(video.id, true)
      toast({
        title: 'Vídeo ativado na Home!',
        description: `O vídeo "${video.titulo}" agora é o vídeo oficial exibido na página inicial pública.`,
      })
      await carregarVideos()
    } catch (err: any) {
      toast({
        title: 'Erro ao ativar vídeo',
        description: err.message,
        variant: 'destructive',
      })
    }
  }

  const confirmarDesativacao = async () => {
    if (!itemParaDesativar) return
    try {
      await videoInstitucionalService.alternarAtivo(itemParaDesativar.id, false)
      toast({
        title: 'Vídeo desativado',
        description:
          'A seção de vídeo institucional foi ocultada da Home pública até que um novo vídeo seja ativado.',
      })
      await carregarVideos()
    } catch (err: any) {
      toast({
        title: 'Erro ao desativar vídeo',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setItemParaDesativar(null)
    }
  }

  // Exclusão
  const confirmarExclusao = async () => {
    if (!itemParaExcluir) return
    try {
      setExcluindo(true)
      await videoInstitucionalService.excluir(itemParaExcluir.id)
      toast({
        title: 'Vídeo excluído com sucesso!',
        description: 'O arquivo foi apagado do armazenamento do servidor.',
      })
      await carregarVideos()
    } catch (err: any) {
      toast({
        title: 'Erro ao excluir vídeo',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setExcluindo(false)
      setItemParaExcluir(null)
    }
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 rounded-full bg-red-100 text-red-600 flex items-center justify-center mb-4">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-gray-900">Acesso Restrito ao Administrador</h2>
        <p className="text-sm text-gray-500 max-w-md mt-2">
          Apenas usuários com perfil de Administrador têm autorização para gerenciar e fazer upload
          do vídeo institucional do sistema.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-[#ECEAE4] shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">Vídeo Institucional</h1>
            <Badge className="bg-blue-50 text-blue-800 border-blue-200 text-xs">Home Pública</Badge>
          </div>
          <p className="text-xs text-gray-500 mt-1 max-w-2xl">
            Gerencie o vídeo oficial de apresentação da Pedreira Cordeiro e GC Mix. O arquivo
            enviado aqui é hospedado com alta performance no servidor e exibido diretamente aos
            visitantes na página inicial pública.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={carregarVideos}
            disabled={loading}
            className="border-[#ECEAE4] text-xs h-9"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>

          <Button
            onClick={abrirModalNovoUpload}
            className="bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs h-9 shadow-xs"
          >
            <UploadCloud className="w-4 h-4 mr-1.5" />
            Novo Upload de MP4
          </Button>
        </div>
      </div>

      {/* Card Informativo / Status da Home */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-[#ECEAE4] bg-white shadow-xs md:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className={`w-3 h-3 rounded-full ${
                    videoAtivo ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'
                  }`}
                />
                <CardTitle className="text-sm font-bold text-gray-900">
                  {videoAtivo ? 'Vídeo Ativo na Home Pública' : 'Nenhum Vídeo Ativo na Home'}
                </CardTitle>
              </div>
              <a
                href="/#video"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-teal-700 hover:text-teal-800 font-medium inline-flex items-center gap-1 hover:underline"
              >
                <span>Ver na Home</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <CardDescription className="text-xs text-gray-500">
              {videoAtivo
                ? 'Os visitantes da Home pública estão assistindo ao vídeo abaixo.'
                : 'Como não há nenhum vídeo ativo, a seção de vídeo está totalmente oculta da Home para não exibir players vazios aos visitantes.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {videoAtivo ? (
              <div className="flex flex-col lg:flex-row gap-4 items-start bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div className="w-full lg:w-64 aspect-video bg-black rounded-lg overflow-hidden relative group shrink-0">
                  <video
                    controls
                    playsInline
                    preload="metadata"
                    poster={
                      videoAtivo.poster
                        ? videoInstitucionalService.obterUrlArquivo(videoAtivo, videoAtivo.poster)
                        : undefined
                    }
                    className="w-full h-full object-cover"
                  >
                    <source
                      src={videoInstitucionalService.obterUrlArquivo(
                        videoAtivo,
                        videoAtivo.arquivo,
                      )}
                      type="video/mp4"
                    />
                    Seu navegador não suporta este vídeo.
                  </video>
                </div>
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-sm text-gray-900 truncate">
                      {videoAtivo.titulo}
                    </h3>
                    <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px] shrink-0">
                      Publicado na Home
                    </Badge>
                  </div>
                  {videoAtivo.descricao && (
                    <p className="text-xs text-gray-600 line-clamp-2">{videoAtivo.descricao}</p>
                  )}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] text-gray-500 pt-1">
                    <div className="flex items-center gap-1">
                      <HardDrive className="w-3.5 h-3.5 text-gray-400" />
                      <span>{formatBytes(videoAtivo.tamanho_bytes)}</span>
                    </div>
                    {videoAtivo.duracao_segundos ? (
                      <div className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-gray-400" />
                        <span>{formatDuracao(videoAtivo.duracao_segundos)}</span>
                      </div>
                    ) : null}
                    <div className="flex items-center gap-1">
                      <User className="w-3.5 h-3.5 text-gray-400" />
                      <span className="truncate">{videoAtivo.enviado_por_nome || 'Admin'}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => abrirModalSubstituicao(videoAtivo)}
                      className="text-xs h-8 border-teal-200 text-teal-800 hover:bg-teal-50"
                    >
                      <RefreshCw className="w-3 h-3 mr-1 text-teal-600" />
                      Substituir Vídeo
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setItemParaDesativar(videoAtivo)}
                      className="text-xs h-8 border-amber-200 text-amber-800 hover:bg-amber-50"
                    >
                      <Power className="w-3 h-3 mr-1 text-amber-600" />
                      Desativar da Home
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-6 text-center border-2 border-dashed border-gray-200 rounded-xl space-y-3">
                <FileVideo className="w-10 h-10 text-gray-300 mx-auto" />
                <div>
                  <p className="text-sm font-semibold text-gray-800">
                    A Home pública está sem vídeo configurado
                  </p>
                  <p className="text-xs text-gray-500 max-w-md mx-auto mt-0.5">
                    Envie o arquivo MP4 institucional produzido pela Pedreira Cordeiro para que ele
                    seja reproduzido diretamente na seção oficial do site.
                  </p>
                </div>
                <Button
                  onClick={abrirModalNovoUpload}
                  size="sm"
                  className="bg-teal-700 hover:bg-teal-800 text-white text-xs"
                >
                  <UploadCloud className="w-3.5 h-3.5 mr-1.5" />
                  Enviar Primeiro Vídeo
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Guia de Boas Práticas / Especificações Técnicas */}
        <Card className="border-[#ECEAE4] bg-white shadow-xs">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2 text-teal-800">
              <Sparkles className="w-4 h-4 text-teal-600" />
              <CardTitle className="text-sm font-bold">Dicas de Especificação</CardTitle>
            </div>
            <CardDescription className="text-xs text-gray-500">
              Para máxima compatibilidade nos navegadores e celulares:
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-xs text-gray-600">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <strong>Formato ideal:</strong> MP4 (codec H.264 / AAC) ou WebM.
              </div>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <strong>Resolução:</strong> 1080p (Full HD) ou 720p (HD 16:9).
              </div>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <strong>Tamanho máximo:</strong> 200 MB por upload.
              </div>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <strong>Substituição limpa:</strong> Ao substituir, o arquivo antigo é removido e o
                site é atualizado na hora sem cache quebrado.
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Histórico / Lista de Vídeos Enviados */}
      <Card className="border-[#ECEAE4] bg-white shadow-xs">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold text-gray-900">
                Histórico de Vídeos Enviados ({videos.length})
              </CardTitle>
              <CardDescription className="text-xs text-gray-500">
                Todos os arquivos cadastrados no sistema. Apenas um vídeo pode estar ativo por vez.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center text-gray-400">
              <RefreshCw className="w-6 h-6 animate-spin mb-2" />
              <span className="text-xs">Carregando lista de vídeos...</span>
            </div>
          ) : videos.length === 0 ? (
            <div className="py-12 text-center text-gray-400">
              <Video className="w-10 h-10 mx-auto mb-2 text-gray-300" />
              <p className="text-sm font-medium text-gray-600">Nenhum vídeo cadastrado ainda</p>
              <p className="text-xs text-gray-400 mt-0.5">
                Clique em &quot;Novo Upload de MP4&quot; para fazer o upload do vídeo institucional.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {videos.map((vid) => {
                const urlVideo = videoInstitucionalService.obterUrlArquivo(vid, vid.arquivo)
                const urlPoster = vid.poster
                  ? videoInstitucionalService.obterUrlArquivo(vid, vid.poster)
                  : undefined

                return (
                  <div
                    key={vid.id}
                    className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/60 p-3 rounded-xl transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        onClick={() => setVideoParaPreview(vid)}
                        className="w-20 h-14 bg-slate-900 rounded-lg overflow-hidden relative shrink-0 cursor-pointer group flex items-center justify-center border border-slate-200 shadow-2xs"
                      >
                        {urlPoster ? (
                          <img
                            src={urlPoster}
                            alt={vid.titulo}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                        ) : (
                          <FileVideo className="w-6 h-6 text-slate-400" />
                        )}
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-80 group-hover:opacity-100 transition-opacity">
                          <Play className="w-4 h-4 fill-white text-white" />
                        </div>
                      </div>

                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-bold text-sm text-gray-900 truncate">{vid.titulo}</h4>
                          {vid.ativo ? (
                            <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px]">
                              Ativo na Home
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="text-gray-500 border-gray-300 text-[10px]"
                            >
                              Inativo
                            </Badge>
                          )}
                        </div>
                        {vid.descricao && (
                          <p className="text-xs text-gray-500 truncate max-w-xl">{vid.descricao}</p>
                        )}
                        <div className="flex items-center gap-3 text-[11px] text-gray-400 flex-wrap">
                          <span>{formatBytes(vid.tamanho_bytes)}</span>
                          <span>•</span>
                          <span>{formatDateTime(vid.created)}</span>
                          {vid.enviado_por_nome && (
                            <>
                              <span>•</span>
                              <span>Enviado por: {vid.enviado_por_nome}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setVideoParaPreview(vid)}
                        className="text-xs h-8 text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                        title="Assistir preview"
                      >
                        <Eye className="w-3.5 h-3.5 mr-1" />
                        Preview
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleAlternarAtivo(vid)}
                        className={`text-xs h-8 ${
                          vid.ativo
                            ? 'border-amber-200 text-amber-700 hover:bg-amber-50'
                            : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                        }`}
                      >
                        <Power className="w-3.5 h-3.5 mr-1" />
                        {vid.ativo ? 'Desativar' : 'Tornar Ativo'}
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => abrirModalSubstituicao(vid)}
                        className="text-xs h-8 border-gray-200 text-gray-700 hover:bg-gray-50"
                        title="Substituir arquivo por novo MP4"
                      >
                        <RefreshCw className="w-3.5 h-3.5 mr-1 text-teal-600" />
                        Substituir
                      </Button>

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setItemParaExcluir(vid)}
                        className="text-xs h-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                        title="Excluir vídeo do storage"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* MODAL DE UPLOAD / SUBSTITUIÇÃO DE VÍDEO */}
      <Dialog open={modalUploadOpen} onOpenChange={setModalUploadOpen}>
        <DialogContent className="max-w-xl bg-white border-[#ECEAE4] rounded-2xl p-6 shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <UploadCloud className="w-5 h-5 text-teal-700" />
              {substituindoId ? 'Substituir Vídeo Institucional' : 'Upload de Vídeo Institucional'}
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-500">
              {substituindoId
                ? 'Selecione um novo arquivo .mp4 para substituir a versão anterior. O arquivo atual será removido do storage.'
                : 'Faça o upload do vídeo oficial em formato MP4 ou WebM para ser publicado diretamente na Home pública.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSalvarUpload} className="space-y-4 pt-2">
            {/* Título */}
            <div className="space-y-1.5">
              <Label htmlFor="titulo" className="text-xs font-semibold text-gray-700">
                Título do Vídeo <span className="text-red-500">*</span>
              </Label>
              <Input
                id="titulo"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Ex: Vídeo Institucional — Pedreira Cordeiro"
                className="h-10 text-xs border-[#ECEAE4]"
                required
              />
            </div>

            {/* Descrição */}
            <div className="space-y-1.5">
              <Label htmlFor="descricao" className="text-xs font-semibold text-gray-700">
                Descrição ou Detalhes <span className="text-gray-400 font-normal">(opcional)</span>
              </Label>
              <Input
                id="descricao"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Ex: Apresentação da pedreira, frota GC Mix e britador Lokotrack"
                className="h-10 text-xs border-[#ECEAE4]"
              />
            </div>

            {/* Campo de Upload de Vídeo (.mp4) */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-gray-700">
                Arquivo de Vídeo (.mp4 ou .webm) <span className="text-red-500">*</span>
              </Label>
              <input
                ref={fileInputRef}
                type="file"
                accept="video/mp4,video/webm,video/quicktime,video/ogg"
                onChange={handleSelecionarArquivo}
                className="hidden"
              />

              {!arquivoSelecionado ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-teal-200 hover:border-teal-500 bg-teal-50/30 hover:bg-teal-50/60 p-6 rounded-xl text-center cursor-pointer transition-all group"
                >
                  <UploadCloud className="w-8 h-8 text-teal-600 group-hover:scale-110 transition-transform mx-auto mb-2" />
                  <p className="text-xs font-bold text-gray-800">
                    Clique para selecionar o vídeo MP4 do seu computador
                  </p>
                  <p className="text-[11px] text-gray-500 mt-1">
                    Formatos suportados: MP4, WebM • Até 200 MB
                  </p>
                </div>
              ) : (
                <div className="p-3 bg-teal-50/60 border border-teal-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileVideo className="w-5 h-5 text-teal-700 shrink-0" />
                      <div className="truncate">
                        <strong className="text-gray-900 block truncate">
                          {arquivoSelecionado.name}
                        </strong>
                        <span className="text-[11px] text-gray-500">
                          {formatBytes(arquivoSelecionado.size)}
                          {duracaoDetectada ? ` • ${formatDuracao(duracaoDetectada)}` : ''}
                        </span>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-xs text-teal-700 hover:bg-teal-100/60 h-7"
                    >
                      Trocar arquivo
                    </Button>
                  </div>

                  {/* Player de Preview do Arquivo Selecionado */}
                  {previewVideoUrl && (
                    <div className="aspect-video w-full bg-black rounded-lg overflow-hidden">
                      <video
                        controls
                        playsInline
                        preload="metadata"
                        src={previewVideoUrl}
                        className="w-full h-full object-contain"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Poster / Capa opcional */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-gray-700">
                Imagem de Capa (Poster){' '}
                <span className="text-gray-400 font-normal">(opcional — JPG/PNG/WebP)</span>
              </Label>
              <input
                ref={posterInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleSelecionarPoster}
                className="hidden"
              />

              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => posterInputRef.current?.click()}
                  className="text-xs border-[#ECEAE4] h-8"
                >
                  {posterSelecionado ? 'Trocar Capa' : 'Selecionar Imagem de Capa'}
                </Button>
                {posterSelecionado && (
                  <span className="text-xs text-gray-600 truncate max-w-xs">
                    {posterSelecionado.name} ({formatBytes(posterSelecionado.size)})
                  </span>
                )}
              </div>
            </div>

            {/* Checkbox Tornar Ativo */}
            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="tornarAtivo"
                checked={tornarAtivo}
                onChange={(e) => setTornarAtivo(e.target.checked)}
                className="rounded border-gray-300 text-teal-700 focus:ring-teal-600 h-4 w-4"
              />
              <Label
                htmlFor="tornarAtivo"
                className="text-xs font-medium text-gray-700 cursor-pointer"
              >
                Definir este vídeo como <strong>ativo imediatamente</strong> na Home pública
              </Label>
            </div>

            {progressoUpload && (
              <div className="p-3.5 bg-teal-50/80 border border-teal-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between text-xs text-teal-900 font-semibold">
                  <span className="flex items-center gap-1.5">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-teal-700" />
                    {progressoUpload.etapa === 'preparando' && 'Iniciando upload...'}
                    {progressoUpload.etapa === 'enviando' && 'Enviando arquivo em partes...'}
                    {progressoUpload.etapa === 'processando' && 'Processando no servidor...'}
                    {progressoUpload.etapa === 'concluido' && 'Upload concluído!'}
                  </span>
                  <span className="text-teal-800 font-bold">{progressoUpload.porcentagem}%</span>
                </div>

                {/* Barra de Progresso visual */}
                <div className="w-full bg-teal-200/60 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="bg-teal-700 h-2.5 rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(100, Math.max(0, progressoUpload.porcentagem))}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] text-teal-700">
                  <span>
                    {(progressoUpload.carregadoBytes / (1024 * 1024)).toFixed(1)} MB de{' '}
                    {(progressoUpload.totalBytes / (1024 * 1024)).toFixed(1)} MB
                  </span>
                  {progressoUpload.chunkAtual && progressoUpload.totalChunks ? (
                    <span>
                      Bloco {progressoUpload.chunkAtual} de {progressoUpload.totalChunks}
                      {progressoUpload.tentativa && progressoUpload.tentativa > 1
                        ? ` (tentativa ${progressoUpload.tentativa})`
                        : ''}
                    </span>
                  ) : null}
                </div>
              </div>
            )}

            {!progressoUpload && progressoTexto && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-800 flex items-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-blue-600 shrink-0" />
                <span>{progressoTexto}</span>
              </div>
            )}

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setModalUploadOpen(false)}
                disabled={salvando}
                className="text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={salvando || !arquivoSelecionado}
                className="bg-teal-700 hover:bg-teal-800 text-white text-xs"
              >
                {salvando ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    Enviando Vídeo...
                  </>
                ) : substituindoId ? (
                  'Salvar Substituição'
                ) : (
                  'Publicar Vídeo'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL DE PREVIEW DO PLAYER */}
      {videoParaPreview && (
        <Dialog open={!!videoParaPreview} onOpenChange={() => setVideoParaPreview(null)}>
          <DialogContent className="max-w-3xl bg-slate-950 border-slate-800 text-white rounded-2xl p-6 shadow-2xl">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-white flex items-center justify-between">
                <span>{videoParaPreview.titulo}</span>
                {videoParaPreview.ativo && (
                  <Badge className="bg-emerald-500 text-white text-[10px] ml-2">
                    Ativo na Home
                  </Badge>
                )}
              </DialogTitle>
              {videoParaPreview.descricao && (
                <DialogDescription className="text-xs text-slate-400">
                  {videoParaPreview.descricao}
                </DialogDescription>
              )}
            </DialogHeader>

            <div className="aspect-video w-full bg-black rounded-xl overflow-hidden my-3 border border-slate-800">
              <video
                controls
                autoPlay
                playsInline
                preload="auto"
                poster={
                  videoParaPreview.poster
                    ? videoInstitucionalService.obterUrlArquivo(
                        videoParaPreview,
                        videoParaPreview.poster,
                      )
                    : undefined
                }
                className="w-full h-full object-contain"
              >
                <source
                  src={videoInstitucionalService.obterUrlArquivo(
                    videoParaPreview,
                    videoParaPreview.arquivo,
                  )}
                  type="video/mp4"
                />
                Seu navegador não suporta a tag de vídeo.
              </video>
            </div>

            <DialogFooter className="flex sm:justify-between items-center gap-2">
              <div className="text-xs text-slate-400">
                Tamanho: {formatBytes(videoParaPreview.tamanho_bytes)} • Enviado em:{' '}
                {formatDateTime(videoParaPreview.created)}
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => setVideoParaPreview(null)}
                className="text-xs border-slate-700 bg-slate-900 text-white hover:bg-slate-800"
              >
                Fechar Preview
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* ALERT DIALOG: CONFIRMAÇÃO DE DESATIVAÇÃO */}
      <AlertDialog open={!!itemParaDesativar} onOpenChange={() => setItemParaDesativar(null)}>
        <AlertDialogContent className="bg-white border-[#ECEAE4] rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold text-gray-900 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              Desativar Vídeo da Home Pública?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-gray-600 leading-relaxed">
              Ao desativar este vídeo, a seção de vídeo institucional na página inicial pública será{' '}
              <strong>completamente ocultada</strong> para os visitantes, sem quebras de layout nem
              players vazios. Você poderá reativá-lo a qualquer momento.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-xs">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmarDesativacao}
              className="bg-amber-600 hover:bg-amber-700 text-white text-xs"
            >
              Sim, Desativar da Home
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ALERT DIALOG: CONFIRMAÇÃO DE EXCLUSÃO */}
      <AlertDialog open={!!itemParaExcluir} onOpenChange={() => setItemParaExcluir(null)}>
        <AlertDialogContent className="bg-white border-[#ECEAE4] rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold text-gray-900 flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-red-600" />
              Excluir Vídeo Institucional?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-gray-600 leading-relaxed">
              Você está prestes a excluir o vídeo &quot;{itemParaExcluir?.titulo}&quot;. O arquivo
              MP4 será removido permanentemente do storage do servidor. Esta ação não poderá ser
              desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-xs" disabled={excluindo}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmarExclusao}
              disabled={excluindo}
              className="bg-red-600 hover:bg-red-700 text-white text-xs"
            >
              {excluindo ? 'Excluindo...' : 'Sim, Excluir Definitivamente'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
