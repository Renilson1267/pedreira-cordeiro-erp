import React from 'react'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, AlertTriangle, Route } from 'lucide-react'
import { analisarDivergenciaKm } from '@/services/rotasGeocoding'

interface BadgeComparativoKmProps {
  kmMotorista: number
  kmRota?: number | null
  compacto?: boolean
}

export const BadgeComparativoKm: React.FC<BadgeComparativoKmProps> = ({
  kmMotorista,
  kmRota,
  compacto = false,
}) => {
  if (!kmRota || kmRota <= 0 || !kmMotorista || kmMotorista <= 0) {
    return null
  }

  const comp = analisarDivergenciaKm(kmMotorista, kmRota)
  if (!comp) return null

  if (compacto) {
    return (
      <span
        title={`Rota OSRM: ${kmRota} km | Motorista: ${kmMotorista} km | Diferença: ${
          comp.diferencaKm > 0 ? `+${comp.diferencaKm}` : comp.diferencaKm
        } km (${comp.diferencaPercent > 0 ? `+${comp.diferencaPercent}` : comp.diferencaPercent}%) - ${comp.descricao}`}
        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold border ${comp.badgeBg} ${comp.badgeText} ${comp.badgeBorder}`}
      >
        {comp.status === 'normal' ? (
          <CheckCircle2 className="w-2.5 h-2.5 text-emerald-700 shrink-0" />
        ) : (
          <AlertTriangle
            className={`w-2.5 h-2.5 shrink-0 ${
              comp.status === 'alerta' ? 'text-red-600' : 'text-amber-600'
            }`}
          />
        )}
        <span>
          {comp.diferencaPercent > 0 ? `+${comp.diferencaPercent}%` : `${comp.diferencaPercent}%`}
        </span>
      </span>
    )
  }

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-mono border ${comp.badgeBg} ${comp.badgeText} ${comp.badgeBorder}`}
      title={comp.descricao}
    >
      <Route className="w-3 h-3 shrink-0 opacity-70" />
      <span>Rota: {kmRota} km</span>
      <span className="opacity-50">|</span>
      <Badge
        variant="outline"
        className={`text-[9px] px-1 py-0 font-bold bg-white ${comp.badgeText} border-current`}
      >
        {comp.diferencaKm > 0 ? `+${comp.diferencaKm} km` : `${comp.diferencaKm} km`} (
        {comp.diferencaPercent > 0 ? `+${comp.diferencaPercent}%` : `${comp.diferencaPercent}%`})
      </Badge>
    </div>
  )
}
