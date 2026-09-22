import React from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Loader2, Navigation, CheckCircle2, AlertTriangle, ArrowRight, Info } from 'lucide-react'
import { analisarDivergenciaKm } from '@/services/rotasGeocoding'

interface BlocoKmRotaProps {
  kmRota: number | null
  carregandoRota: boolean
  erroRota: string | null
  kmMotorista: number
  origem: string
  destino: string
  duracaoMinutos?: number
  onUsarKmRota: () => void
  onRecalcular?: () => void
}

export const BlocoKmRota: React.FC<BlocoKmRotaProps> = ({
  kmRota,
  carregandoRota,
  erroRota,
  kmMotorista,
  origem,
  destino,
  duracaoMinutos,
  onUsarKmRota,
  onRecalcular,
}) => {
  const comparativo = kmRota && kmMotorista ? analisarDivergenciaKm(kmMotorista, kmRota) : null

  if (!origem || !destino) {
    return (
      <div className="p-3 bg-gray-50/80 rounded-xl border border-dashed border-[#ECEAE4] text-gray-400 text-xs flex items-center gap-2">
        <Navigation className="w-4 h-4 text-gray-400 shrink-0" />
        <span>
          Informe a <strong>cidade de origem</strong> e <strong>destino</strong> para calcular a
          distância rodoviária automática (OSRM) e comparar com o odômetro.
        </span>
      </div>
    )
  }

  if (carregandoRota) {
    return (
      <div className="p-3.5 bg-teal-50/60 rounded-xl border border-teal-200 text-teal-900 text-xs flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Loader2 className="w-4 h-4 animate-spin text-teal-700" />
          <div>
            <div className="font-semibold">Calculando rota rodoviária via OSRM...</div>
            <div className="text-[10px] text-teal-700">
              Traçando trajeto rodoviário entre origem e destino
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-3.5 bg-gradient-to-r from-teal-50/90 to-blue-50/60 rounded-xl border border-teal-200/90 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-bold text-teal-950">
          <Navigation className="w-3.5 h-3.5 text-teal-700" />
          <span>Km Automático da Rota (OSRM)</span>
        </div>
        {kmRota && (
          <Badge className="bg-teal-100 text-teal-900 border-teal-300 text-[10px] font-mono">
            {kmRota} km calculados
          </Badge>
        )}
      </div>

      {kmRota ? (
        <div className="space-y-2.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white p-2.5 rounded-lg border border-teal-100">
            <div>
              <div className="text-[10px] uppercase font-semibold text-gray-500">
                Distância Rodoviária Estimada
              </div>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-xl font-bold font-mono text-teal-900">{kmRota} km</span>
                {duracaoMinutos && duracaoMinutos > 0 ? (
                  <span className="text-[11px] text-gray-500 font-mono">
                    (~{Math.floor(duracaoMinutos / 60)}h{duracaoMinutos % 60}m de viagem)
                  </span>
                ) : null}
              </div>
            </div>

            <Button
              type="button"
              size="sm"
              onClick={onUsarKmRota}
              className="bg-teal-700 hover:bg-teal-800 text-white text-xs h-8 rounded-lg shadow-2xs"
            >
              <ArrowRight className="w-3 h-3 mr-1" />
              Usar este Km ({kmRota} km)
            </Button>
          </div>

          {/* Comparativo Motorista vs Rota */}
          {comparativo && (
            <div
              className={`p-2.5 rounded-lg border text-xs ${comparativo.badgeBg} ${comparativo.badgeBorder}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-bold">
                  {comparativo.status === 'normal' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                  ) : (
                    <AlertTriangle
                      className={`w-4 h-4 shrink-0 ${
                        comparativo.status === 'alerta' ? 'text-red-600' : 'text-amber-600'
                      }`}
                    />
                  )}
                  <span className={comparativo.badgeText}>
                    Comparativo: Motorista ({kmMotorista} km) vs Rota ({kmRota} km)
                  </span>
                </div>
                <Badge
                  variant="outline"
                  className={`font-mono text-[10px] font-bold ${comparativo.badgeText} bg-white`}
                >
                  {comparativo.diferencaPercent > 0
                    ? `+${comparativo.diferencaPercent}%`
                    : `${comparativo.diferencaPercent}%`}
                </Badge>
              </div>

              <div className="mt-1 flex items-center justify-between text-[11px] text-gray-600">
                <span>Diferença apurada:</span>
                <span className="font-mono font-bold text-gray-900">
                  {comparativo.diferencaKm > 0
                    ? `+${comparativo.diferencaKm} km a mais`
                    : comparativo.diferencaKm < 0
                      ? `${comparativo.diferencaKm} km a menos`
                      : 'Exatamente igual (0 km)'}
                </span>
              </div>
              <p className="text-[10px] text-gray-500 mt-1">{comparativo.descricao}</p>
            </div>
          )}
        </div>
      ) : (
        <div className="text-xs text-gray-600 bg-white p-2.5 rounded-lg border border-teal-100 flex items-start gap-2">
          <Info className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p>
              {erroRota
                ? `Não foi possível calcular automaticamente a rota: ${erroRota}. Você pode informar o Km manualmente sem problemas.`
                : 'Defina cidades reconhecidas para obter o cálculo automático de km rodoviário.'}
            </p>
            {onRecalcular && (
              <button
                type="button"
                onClick={onRecalcular}
                className="mt-1 text-teal-700 hover:underline font-semibold text-[11px]"
              >
                Tentar calcular novamente
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
