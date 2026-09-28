/* 404 Page - Displays when a user attempts to access a non-existent route - translate to the language of the user */
import { useLocation } from 'react-router-dom'
import { useEffect } from 'react'

const NotFound = () => {
  const location = useLocation()

  useEffect(() => {
    console.error('404 Error: User attempted to access non-existent route:', location.pathname)
  }, [location.pathname])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">404</h1>
        <p className="text-xl text-gray-600 mb-4">Página não encontrada</p>
        <div className="flex justify-center items-center gap-4">
          <a href="/" className="text-teal-700 hover:text-teal-900 underline font-medium text-sm">
            Voltar para o Início
          </a>
          <span className="text-gray-300">|</span>
          <a
            href="/login"
            className="text-teal-700 hover:text-teal-900 underline font-medium text-sm"
          >
            Entrar no ERP
          </a>
        </div>
      </div>
    </div>
  )
}

export default NotFound
