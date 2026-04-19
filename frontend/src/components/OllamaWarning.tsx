import { AlertTriangle, Wifi, WifiOff } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import apiClient from '@/lib/api'

export function OllamaStatusBar() {
  const { data: health } = useQuery({
    queryKey: ['health'],
    queryFn: apiClient.health,
    refetchInterval: 30000,
  })

  if (!health) return null

  if (health.ollama_connected) {
    return (
      <div className="flex items-center gap-2 text-xs text-green-600 bg-green-50 border border-green-200 rounded-md px-3 py-1.5">
        <Wifi className="h-3.5 w-3.5" />
        <span>Ollama connected — AI analysis enabled</span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-1.5">
      <WifiOff className="h-3.5 w-3.5" />
      <span>Ollama not reachable at {health.ollama_url} — documents will be parsed but AI analysis will be skipped</span>
    </div>
  )
}

export function OllamaWarningModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  if (!isOpen) return null
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
      <div className="bg-white rounded-lg p-6 max-w-md mx-4 shadow-xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
          </div>
          <h2 className="text-lg font-semibold">Ollama Not Connected</h2>
        </div>
        <p className="text-sm text-gray-600 mb-4">
          The AI analysis engine (Ollama) is not reachable. Your document will still be uploaded and parsed,
          but compliance analysis requires Ollama running locally.
        </p>
        <div className="bg-gray-50 rounded-md p-3 text-xs font-mono text-gray-700 mb-4">
          ollama serve
        </div>
        <p className="text-xs text-gray-500 mb-4">
          Make sure Ollama is installed and running on your machine, then try again.
          You can download it from <span className="font-medium">ollama.ai</span>
        </p>
        <button
          onClick={onClose}
          className="w-full bg-primary text-white rounded-md py-2 text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          Continue Anyway
        </button>
      </div>
    </div>
  )
}
