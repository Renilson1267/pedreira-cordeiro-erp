import { useState, useCallback, useRef } from 'react'
import {
  buscarCep,
  buscarCnpj,
  apenasDigitos,
  formatarCep,
  formatarCpfCnpj,
  validarCnpj,
  type EnderecoConsulta,
  type CnpjConsulta,
} from '@/lib/brasilApi'
import { toast } from '@/hooks/use-toast'

export interface UseBrasilDataOptions {
  onSuccessCep?: (dados: EnderecoConsulta) => void
  onSuccessCnpj?: (dados: CnpjConsulta) => void
  silenciarErros?: boolean
}

export function useBrasilData(options: UseBrasilDataOptions = {}) {
  const [loadingCep, setLoadingCep] = useState(false)
  const [loadingCnpj, setLoadingCnpj] = useState(false)
  const [ultimoCepBuscado, setUltimoCepBuscado] = useState<string | null>(null)
  const [ultimoCnpjBuscado, setUltimoCnpjBuscado] = useState<string | null>(null)

  // Ref para evitar buscas duplicadas em curso
  const abortCepRef = useRef(false)
  const abortCnpjRef = useRef(false)

  const consultarCep = useCallback(
    async (cep: string, force = false): Promise<EnderecoConsulta | null> => {
      const clean = apenasDigitos(cep)
      if (clean.length !== 8) {
        return null
      }
      if (!force && clean === ultimoCepBuscado) {
        return null
      }

      setLoadingCep(true)
      try {
        const dados = await buscarCep(clean)
        setUltimoCepBuscado(clean)
        options.onSuccessCep?.(dados)
        toast({
          title: 'CEP localizado!',
          description: `${dados.logradouro ? dados.logradouro + ' - ' : ''}${dados.cidade}/${dados.uf}`,
        })
        return dados
      } catch (err: any) {
        if (!options.silenciarErros) {
          toast({
            title: 'CEP não encontrado',
            description: err.message || 'Verifique o CEP digitado ou continue manualmente.',
            variant: 'destructive',
          })
        }
        return null
      } finally {
        setLoadingCep(false)
      }
    },
    [ultimoCepBuscado, options],
  )

  const consultarCnpj = useCallback(
    async (documento: string, force = false): Promise<CnpjConsulta | null> => {
      const clean = apenasDigitos(documento)
      if (clean.length !== 14) {
        return null
      }
      if (!force && clean === ultimoCnpjBuscado) {
        return null
      }

      if (!validarCnpj(clean)) {
        if (!options.silenciarErros) {
          toast({
            title: 'CNPJ inválido',
            description: 'Os dígitos verificadores do CNPJ informado estão incorretos.',
            variant: 'destructive',
          })
        }
        return null
      }

      setLoadingCnpj(true)
      try {
        const dados = await buscarCnpj(clean)
        setUltimoCnpjBuscado(clean)
        options.onSuccessCnpj?.(dados)
        toast({
          title: 'CNPJ localizado!',
          description: dados.razaoSocial || dados.nomeFantasia || 'Dados da empresa preenchidos.',
        })
        return dados
      } catch (err: any) {
        if (!options.silenciarErros) {
          toast({
            title: 'CNPJ não encontrado',
            description:
              err.message ||
              'Não foi possível obter dados automáticos deste CNPJ. Continue o cadastro manualmente.',
            variant: 'destructive',
          })
        }
        return null
      } finally {
        setLoadingCnpj(false)
      }
    },
    [ultimoCnpjBuscado, options],
  )

  const resetHistorico = useCallback(() => {
    setUltimoCepBuscado(null)
    setUltimoCnpjBuscado(null)
  }, [])

  return {
    loadingCep,
    loadingCnpj,
    consultarCep,
    consultarCnpj,
    resetHistorico,
    formatarCep,
    formatarCpfCnpj,
  }
}
