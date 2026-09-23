import * as React from 'react'
import { Check, ChevronsUpDown, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'

export interface ComboboxOption {
  id: string
  label: string
  sublabel?: string
  disabled?: boolean
  keywords?: string[]
}

export interface ComboboxPesquisavelProps {
  value: string | undefined | null
  onChange: (value: string) => void
  options: ComboboxOption[]
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  className?: string
  triggerClassName?: string
  contentClassName?: string
  disabled?: boolean
  allowClear?: boolean
  id?: string
  name?: string
  'aria-label'?: string
}

/**
 * Remove diacríticos/acentos e converte para minúsculas para buscas insensíveis.
 */
export function normalizarTexto(texto: string): string {
  return (texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

export const ComboboxPesquisavel: React.FC<ComboboxPesquisavelProps> = ({
  value,
  onChange,
  options,
  placeholder = 'Selecione uma opção...',
  searchPlaceholder = 'Digitar para pesquisar...',
  emptyText = 'Nenhum resultado encontrado.',
  className,
  triggerClassName,
  contentClassName,
  disabled = false,
  allowClear = true,
  id,
  'aria-label': ariaLabel,
}) => {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState('')

  const selectedOption = React.useMemo(() => {
    if (!value || value === 'none' || value === 'nenhum' || value === 'nenhuma') {
      return null
    }
    return options.find((opt) => opt.id === value) || null
  }, [value, options])

  // Normalização e filtro sob demanda
  const filteredOptions = React.useMemo(() => {
    const q = normalizarTexto(search)
    if (!q) return options

    return options.filter((opt) => {
      const labelNorm = normalizarTexto(opt.label)
      const subNorm = opt.sublabel ? normalizarTexto(opt.sublabel) : ''
      const keywordsNorm = opt.keywords ? opt.keywords.map(normalizarTexto).join(' ') : ''
      return (
        labelNorm.includes(q) ||
        subNorm.includes(q) ||
        keywordsNorm.includes(q) ||
        opt.id.toLowerCase().includes(q)
      )
    })
  }, [options, search])

  const handleSelect = React.useCallback(
    (optId: string) => {
      if (optId === value) {
        // Clicar no mesmo selecionado fecha ou mantém
        setOpen(false)
        return
      }
      onChange(optId)
      setOpen(false)
      setSearch('')
    },
    [onChange, value],
  )

  const handleClear = React.useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onChange('')
      setSearch('')
    },
    [onChange],
  )

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label={ariaLabel || placeholder}
          disabled={disabled}
          className={cn(
            'w-full justify-between font-normal text-left h-9 px-3 text-xs bg-white border-input hover:bg-accent/40 focus:ring-2 focus:ring-ring focus:ring-offset-1',
            !selectedOption && 'text-muted-foreground',
            triggerClassName,
            className,
          )}
        >
          <span className="truncate flex-1 pr-2">
            {selectedOption ? (
              <span className="text-foreground font-medium">
                {selectedOption.label}
                {selectedOption.sublabel && (
                  <span className="ml-1.5 text-muted-foreground font-normal text-[11px]">
                    ({selectedOption.sublabel})
                  </span>
                )}
              </span>
            ) : (
              placeholder
            )}
          </span>

          <div className="flex items-center gap-1 shrink-0">
            {allowClear && selectedOption && !disabled && (
              <span
                role="button"
                tabIndex={0}
                onClick={handleClear}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    e.stopPropagation()
                    onChange('')
                  }
                }}
                className="rounded p-0.5 text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer transition-colors"
                title="Limpar seleção"
                aria-label="Limpar seleção"
              >
                <X className="h-3.5 w-3.5" />
              </span>
            )}
            <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground opacity-60" />
          </div>
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        className={cn(
          'p-0 w-[--radix-popover-trigger-width] min-w-[260px] max-w-[90vw] z-50 bg-popover text-popover-foreground shadow-lg border rounded-lg overflow-hidden',
          contentClassName,
        )}
      >
        <Command
          shouldFilter={false} // Usamos nosso próprio filtro normalizado sem acento
          className="w-full"
        >
          <CommandInput
            placeholder={searchPlaceholder}
            value={search}
            onValueChange={setSearch}
            className="h-9 text-xs"
          />
          <CommandList className="max-h-64 overflow-y-auto">
            {filteredOptions.length === 0 ? (
              <CommandEmpty className="py-4 text-center text-xs text-muted-foreground">
                {emptyText}
              </CommandEmpty>
            ) : (
              <CommandGroup>
                {filteredOptions.map((opt) => {
                  const isSelected = opt.id === value
                  return (
                    <CommandItem
                      key={opt.id}
                      value={opt.id}
                      disabled={opt.disabled}
                      onSelect={() => handleSelect(opt.id)}
                      className="text-xs py-2 px-2.5 flex items-center justify-between cursor-pointer data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground"
                    >
                      <div className="flex flex-col min-w-0 pr-2">
                        <span
                          className={cn('truncate', isSelected && 'font-semibold text-primary')}
                        >
                          {opt.label}
                        </span>
                        {opt.sublabel && (
                          <span className="text-[10px] text-muted-foreground truncate">
                            {opt.sublabel}
                          </span>
                        )}
                      </div>
                      <Check
                        className={cn(
                          'h-4 w-4 shrink-0 transition-opacity',
                          isSelected ? 'opacity-100 text-teal-600' : 'opacity-0',
                        )}
                      />
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

export default ComboboxPesquisavel
