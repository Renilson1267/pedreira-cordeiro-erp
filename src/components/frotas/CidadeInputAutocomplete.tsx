import React, { useState, useEffect, useRef } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  buscarCidadesNominatim,
  CIDADES_FREQUENTES_REGIAO,
  type CidadeGeo,
} from '@/services/rotasGeocoding'
import { Loader2, MapPin, Search } from 'lucide-react'

interface CidadeInputAutocompleteProps {
  label: string
  value: string
  onChange: (value: string, coords?: { lat: number; lon: number }) => void
  placeholder?: string
  required?: boolean
  atalhos?: string[]
  onSelectAtalho?: (texto: string) => void
  helperText?: string
}

export const CidadeInputAutocomplete: React.FC<CidadeInputAutocompleteProps> = ({
  label,
  value,
  onChange,
  placeholder = 'Digite a cidade (ex: Patos, Monteiro, Caicó...)',
  required = false,
  atalhos,
  onSelectAtalho,
  helperText,
}) => {
  const [sugestoes, setSugestoes] = useState<CidadeGeo[]>([])
  const [carregando, setCarregando] = useState(false)
  const [mostrarDropdown, setMostrarDropdown] = useState(false)
  const [avisoErro, setAvisoErro] = useState<string | null>(null)

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)

  // Fecha dropdown ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setMostrarDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const handleInputChange = (texto: string) => {
    onChange(texto)
    setAvisoErro(null)

    if (timerRef.current) {
      clearTimeout(timerRef.current)
    }

    if (texto.trim().length < 2) {
      setSugestoes([])
      setMostrarDropdown(false)
      return
    }

    // Debounce de ~400ms para consulta Nominatim
    timerRef.current = setTimeout(async () => {
      try {
        setCarregando(true)
        const cidades = await buscarCidadesNominatim(texto)
        setSugestoes(cidades)
        setMostrarDropdown(cidades.length > 0)
        if (cidades.length === 0) {
          setAvisoErro(null) // Nenhum erro, apenas nada encontrado
        }
      } catch (err: any) {
        console.warn('Erro ao buscar cidades:', err)
        setAvisoErro('Falha na busca online de cidades. Digite livremente.')
        // Fallback para as cidades frequentes que correspondam
        const fallback = CIDADES_FREQUENTES_REGIAO.filter((c) =>
          c.cidade.toLowerCase().includes(texto.toLowerCase()),
        )
        setSugestoes(fallback)
        setMostrarDropdown(fallback.length > 0)
      } finally {
        setCarregando(false)
      }
    }, 400)
  }

  const handleSelectCidade = (cidade: CidadeGeo) => {
    const formatado = cidade.uf ? `${cidade.cidade} - ${cidade.uf}` : cidade.display_name
    onChange(formatado, { lat: cidade.lat, lon: cidade.lon })
    setMostrarDropdown(false)
    setSugestoes([])
  }

  return (
    <div className="relative" ref={wrapperRef}>
      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold text-gray-700">{label}</Label>
        <span className="text-[10px] text-teal-700 flex items-center gap-0.5">
          <Search className="w-2.5 h-2.5" />
          Busca de Cidades
        </span>
      </div>

      <div className="relative mt-1">
        <Input
          required={required}
          value={value}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => {
            if (sugestoes.length > 0) setMostrarDropdown(true)
          }}
          placeholder={placeholder}
          className="bg-white pr-8 text-xs"
        />
        {carregando ? (
          <div className="absolute right-2.5 top-2.5 text-teal-600">
            <Loader2 className="w-4 h-4 animate-spin" />
          </div>
        ) : (
          <div className="absolute right-2.5 top-2.5 text-gray-400 pointer-events-none">
            <MapPin className="w-3.5 h-3.5" />
          </div>
        )}
      </div>

      {/* Dropdown com resultados do autocomplete */}
      {mostrarDropdown && sugestoes.length > 0 && (
        <div className="absolute z-50 left-0 right-0 mt-1 max-h-56 overflow-y-auto bg-white border border-[#ECEAE4] rounded-xl shadow-lg divide-y divide-[#ECEAE4]">
          <div className="p-1.5 bg-[#FAF9F7] text-[10px] uppercase font-semibold text-gray-500 tracking-wider flex items-center justify-between">
            <span>Cidades Encontradas</span>
            <span className="font-mono text-[9px] text-teal-700">OpenStreetMap</span>
          </div>
          {sugestoes.map((c, idx) => (
            <button
              type="button"
              key={`${c.lat}-${c.lon}-${idx}`}
              onClick={() => handleSelectCidade(c)}
              className="w-full text-left px-3 py-2 text-xs hover:bg-teal-50/60 transition-colors flex items-start gap-2 group"
            >
              <MapPin className="w-3.5 h-3.5 text-teal-600 shrink-0 mt-0.5 group-hover:scale-110 transition-transform" />
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-gray-900 group-hover:text-teal-900 flex items-center justify-between">
                  <span>{c.cidade}</span>
                  {c.uf && (
                    <span className="text-[10px] font-mono font-normal text-gray-400 bg-gray-100 px-1.5 py-0.2 rounded">
                      {c.uf}
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-gray-500 truncate">{c.display_name}</div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Aviso amigável caso haja erro de rede / geocoding */}
      {avisoErro && (
        <p className="text-[10px] text-amber-700 mt-1 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
          {avisoErro}
        </p>
      )}

      {/* Atalhos rápidos (ex: unidades da pedreira ou cidades vizinhas) */}
      {atalhos && atalhos.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {atalhos.map((sug) => (
            <button
              type="button"
              key={sug}
              onClick={() => {
                if (onSelectAtalho) {
                  onSelectAtalho(sug)
                } else {
                  onChange(sug)
                }
              }}
              className="text-[10px] px-1.5 py-0.5 rounded bg-white border border-teal-200 text-teal-800 hover:bg-teal-100/60 transition-colors"
            >
              {sug.split('(')[0].trim()}
            </button>
          ))}
        </div>
      )}

      {helperText && !avisoErro && (
        <span className="text-[10px] text-gray-400 mt-1 block">{helperText}</span>
      )}
    </div>
  )
}
