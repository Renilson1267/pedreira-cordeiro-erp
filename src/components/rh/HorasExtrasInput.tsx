import React, { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { parseHorasExtrasInput, formatarHoraMinuto } from '@/lib/horasExtrasParser'
import { Clock, Check, AlertCircle } from 'lucide-react'

export interface HorasExtrasInputProps {
  id?: string
  label?: string
  sublabel?: string
  /** Valor decimal armazenado (número ou vazio) */
  value: number | ''
  /** Callback retornando o valor decimal normalizado (ou '' se vazio) */
  onChange: (decimalValue: number | '') => void
  placeholder?: string
  disabled?: boolean
  required?: boolean
  className?: string
  inputClassName?: string
  colorTheme?: 'blue' | 'purple' | 'default'
}

/**
 * Campo de digitação inteligente para horas extras.
 * Aceita:
 * - Formato hora:minuto: "07:30", "7:30", "7h30", "07h30min", "0730"
 * - Formato decimal: "7,5", "7.5", "7,50", "7.5h"
 *
 * Exibe conversão e equivalência em tempo real ao lado do campo (ex: "07:30 = 7,50h" ou "7,50h = 07:30").
 */
export const HorasExtrasInput: React.FC<HorasExtrasInputProps> = ({
  id,
  label,
  sublabel,
  value,
  onChange,
  placeholder = 'Ex: 07:30 ou 7,5',
  disabled = false,
  required = false,
  className = '',
  inputClassName = '',
  colorTheme = 'default',
}) => {
  // Estado local com o texto digitado pelo usuário
  const [text, setText] = useState<string>(() => {
    if (value === '' || value === undefined || value === null) return ''
    // Exibe preferencialmente o formato hora:minuto para facilitar leitura do usuário,
    // mas se o usuário tiver acabado de digitar decimal o estado local mantém o texto digitado.
    return formatarHoraMinuto(Number(value))
  })

  // Sincroniza se o valor externo mudar sem ser por digitação local (ex: reset do formulário ou carga de edição)
  useEffect(() => {
    if (value === '' || value === undefined || value === null) {
      setText('')
      return
    }
    const currentParsed = parseHorasExtrasInput(text)
    // Se o valor numérico externo diferir do que o texto atual produz, sincroniza com hora:minuto
    if (!currentParsed.valido || currentParsed.decimal !== Number(value)) {
      setText(formatarHoraMinuto(Number(value)))
    }
  }, [value])

  const parsed = parseHorasExtrasInput(text)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value
    setText(rawValue)

    const res = parseHorasExtrasInput(rawValue)
    if (res.valido) {
      if (res.decimal === null) {
        onChange('')
      } else {
        onChange(res.decimal)
      }
    } else {
      // Valor inválido: não quebra o form, passa 0 ou mantém valor anterior se preenchido
      // Para garantir que o formulário não envie valor truncado, passamos '' quando inválido
      onChange('')
    }
  }

  // Estilos de cor conforme o tema
  const themeColors = {
    blue: {
      label: 'text-blue-950',
      border: 'border-blue-300 focus-visible:ring-blue-400',
      badgeBg: 'bg-blue-100/80 text-blue-900 border-blue-300',
      icon: 'text-blue-600',
    },
    purple: {
      label: 'text-purple-950',
      border: 'border-purple-300 focus-visible:ring-purple-400',
      badgeBg: 'bg-purple-100/80 text-purple-900 border-purple-300',
      icon: 'text-purple-600',
    },
    default: {
      label: 'text-gray-900',
      border: 'border-gray-300 focus-visible:ring-teal-500',
      badgeBg: 'bg-teal-50 text-teal-900 border-teal-200',
      icon: 'text-teal-700',
    },
  }[colorTheme]

  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <div className="flex items-center justify-between">
          <Label
            htmlFor={id}
            className={`text-xs font-semibold ${themeColors.label} flex items-center gap-1.5`}
          >
            <Clock className={`w-3.5 h-3.5 ${themeColors.icon}`} />
            {label}
            {required && <span className="text-red-500">*</span>}
          </Label>

          {/* EQUIVALÊNCIA EM TEMPO REAL AO LADO DO CAMPO */}
          {parsed.valido && parsed.equivalenciaRealTime && (
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-mono font-bold border transition-all animate-in fade-in duration-150 ${themeColors.badgeBg}`}
              title="Equivalência automática calculada em tempo real"
            >
              <Check className="w-3 h-3 text-emerald-600" />
              {parsed.equivalenciaRealTime}
            </span>
          )}
        </div>
      )}

      <div className="relative">
        <Input
          id={id}
          type="text"
          value={text}
          onChange={handleChange}
          disabled={disabled}
          placeholder={placeholder}
          className={`font-mono font-bold text-sm bg-white pr-20 ${
            !parsed.valido && text.trim() !== ''
              ? 'border-red-400 focus-visible:ring-red-400 text-red-900'
              : themeColors.border
          } ${inputClassName}`}
          autoComplete="off"
          spellCheck={false}
        />

        {/* Indicador de formato / ajuda na ponta direita do input */}
        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none flex items-center gap-1 text-[10px] text-gray-400 font-medium">
          {parsed.tipoDetectado === 'hora_minuto' && (
            <span className="text-teal-700 font-bold bg-teal-50 px-1 rounded">HH:MM</span>
          )}
          {parsed.tipoDetectado === 'decimal' && (
            <span className="text-blue-700 font-bold bg-blue-50 px-1 rounded">DECIMAL</span>
          )}
        </div>
      </div>

      {/* Mensagem de erro amigável se a digitação estiver inválida */}
      {!parsed.valido && text.trim() !== '' && (
        <div className="flex items-center gap-1.5 text-[11px] text-red-600 font-medium pt-0.5 animate-in fade-in">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{parsed.mensagemErro || 'Formato de hora inválido.'}</span>
        </div>
      )}

      {/* Sublabel de ajuda com os formatos aceitos */}
      {sublabel && parsed.valido && (
        <span className="text-[10px] text-gray-500 block leading-tight">{sublabel}</span>
      )}
    </div>
  )
}
