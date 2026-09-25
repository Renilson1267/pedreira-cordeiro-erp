import React from 'react'

export function PageLoadingFallback() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] w-full p-6 animate-in fade-in duration-300">
      <div className="relative flex items-center justify-center">
        {/* Spinner animado com as cores da identidade visual do ERP NovaGest */}
        <div className="w-12 h-12 rounded-full border-4 border-[#E2E8F0] border-t-teal-700 animate-spin" />
        <div className="absolute w-6 h-6 rounded-full bg-teal-50" />
      </div>
      <p className="mt-4 text-xs font-medium text-gray-500 tracking-wide uppercase">
        Carregando módulo...
      </p>
    </div>
  )
}
