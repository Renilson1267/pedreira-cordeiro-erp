import React, { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { getHelpForRoute } from '@/data/helpContent'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  HelpCircle,
  Lightbulb,
  Headphones,
  BookOpen,
  Info,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react'

export function HelpFloatingButton() {
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()

  const helpTopic = getHelpForRoute(location.pathname)

  const handleIrAoManual = () => {
    setOpen(false)
    navigate('/manual')
  }

  return (
    <>
      {/* Botão FAB Flutuante fixado no canto inferior direito */}
      <div
        className="fixed bottom-14 sm:bottom-16 right-4 sm:right-6 z-40 print:hidden pointer-events-auto"
        role="region"
        aria-label="Ajuda do Sistema"
      >
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="group relative flex items-center justify-center w-12 h-12 rounded-full bg-teal-700 hover:bg-teal-800 text-white shadow-lg shadow-teal-900/25 hover:shadow-xl hover:shadow-teal-900/35 transition-all duration-200 transform hover:scale-105 active:scale-95 focus:outline-hidden focus:ring-3 focus:ring-teal-500/50 cursor-pointer"
          title={`Ajuda: ${helpTopic.title}`}
          aria-label={`Abrir ajuda da tela ${helpTopic.title}`}
        >
          <HelpCircle className="w-6 h-6 transition-transform group-hover:rotate-12" />

          {/* Tooltip rápida no hover em desktop */}
          <span className="sr-only">Abrir Ajuda</span>
          <span className="hidden md:group-hover:inline-block absolute right-14 whitespace-nowrap bg-gray-900 text-white text-xs font-medium px-2.5 py-1 rounded-lg shadow-md transition-opacity duration-150 pointer-events-none">
            Ajuda desta tela ({helpTopic.title})
          </span>
        </button>
      </div>

      {/* Modal de Ajuda Contextual */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl bg-white border-[#ECEAE4] rounded-2xl p-0 overflow-hidden shadow-2xl">
          {/* Cabeçalho do Modal */}
          <DialogHeader className="p-6 pb-4 bg-[#FAF9F7] border-b border-[#ECEAE4]">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-teal-100 text-teal-800 flex items-center justify-center shrink-0 shadow-xs">
                <HelpCircle className="w-5 h-5 text-teal-700" />
              </div>
              <div className="flex-1 min-w-0 text-left">
                <div className="flex items-center gap-2">
                  <DialogTitle className="text-xl font-bold tracking-tight text-gray-900">
                    Ajuda
                  </DialogTitle>
                  <Badge
                    variant="outline"
                    className="bg-teal-50 text-teal-800 border-teal-200 text-[10px] font-semibold uppercase"
                  >
                    Guia Rápido
                  </Badge>
                </div>
                <DialogDescription className="text-xs text-gray-600 mt-1 flex items-center gap-1.5 font-medium">
                  <span className="text-gray-400">Tela atual:</span>
                  <span className="font-semibold text-teal-900">{helpTopic.title}</span>
                  <span className="text-gray-300">•</span>
                  <span className="text-gray-500 truncate">{helpTopic.subtitle}</span>
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* Conteúdo com rolagem controlada */}
          <ScrollArea className="max-h-[65vh] p-6 space-y-6">
            <div className="space-y-5">
              {/* Seção "Sobre esta tela" */}
              <div className="p-4 bg-teal-50/50 rounded-xl border border-teal-100">
                <div className="flex items-center gap-2 mb-2">
                  <Info className="w-4 h-4 text-teal-700" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-teal-900">
                    Sobre esta tela
                  </h4>
                </div>
                <p className="text-xs text-gray-700 leading-relaxed">{helpTopic.description}</p>
              </div>

              {/* Seções com tópicos operacionais */}
              {helpTopic.sections.map((sec, sIdx) => (
                <div key={sIdx} className="space-y-2.5">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-800 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-teal-700" />
                    {sec.heading}
                  </h4>
                  <ul className="space-y-2">
                    {sec.items.map((item, iIdx) => (
                      <li
                        key={iIdx}
                        className="flex items-start gap-2 text-xs text-gray-600 leading-relaxed bg-[#FAF9F7] p-2.5 rounded-xl border border-[#ECEAE4]"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 shrink-0 mt-0.5" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}

              {/* Dicas Práticas Reais do Módulo */}
              {helpTopic.tips && helpTopic.tips.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
                    <Lightbulb className="w-4 h-4 text-amber-600" />
                    Dicas Práticas
                  </h4>
                  <div className="space-y-2">
                    {helpTopic.tips.map((tip, tIdx) => (
                      <div
                        key={tIdx}
                        className="p-3 bg-amber-50/70 rounded-xl border border-amber-200/80 text-xs text-amber-950 flex items-start gap-2.5 leading-relaxed"
                      >
                        <span className="shrink-0 text-amber-600 font-bold">•</span>
                        <span>{tip}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Seção Suporte / Administrador */}
              <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-200 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-gray-200/80 text-gray-700 flex items-center justify-center shrink-0">
                    <Headphones className="w-4 h-4" />
                  </div>
                  <div className="text-left">
                    <div className="text-xs font-bold text-gray-900">Contato & Suporte</div>
                    <div className="text-[11px] text-gray-500">
                      Fale com o administrador do sistema
                    </div>
                  </div>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleIrAoManual}
                  className="text-xs h-8 border-gray-300 hover:bg-white text-gray-700"
                >
                  <BookOpen className="w-3.5 h-3.5 mr-1 text-teal-700" />
                  Ver Manual Completo
                  <ExternalLink className="w-3 h-3 ml-1 text-gray-400" />
                </Button>
              </div>
            </div>
          </ScrollArea>

          {/* Rodapé do Modal com Botão Fechar */}
          <div className="p-4 bg-[#FAF9F7] border-t border-[#ECEAE4] flex items-center justify-between">
            <span className="text-[11px] text-gray-400">
              Pressione{' '}
              <kbd className="px-1.5 py-0.5 font-mono bg-white border border-gray-300 rounded text-[10px] text-gray-600">
                Esc
              </kbd>{' '}
              para fechar
            </span>
            <Button
              onClick={() => setOpen(false)}
              className="bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs h-9 px-5 shadow-xs"
            >
              Fechar Ajuda
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
export default HelpFloatingButton
