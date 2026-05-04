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

  const provider = health.ai_provider?.toUpperCase() ?? 'OLLAMA'
  const model = health.ai_model ?? ''

  if (health.ai_connected) {
    return (
      <div className="flex items-center gap-2 text-xs text-green-600 bg-green-50 border border-green-200 rounded-md px-3 py-1.5">
        <Wifi className="h-3.5 w-3.5 shrink-0" />
        <span>
          {provider} connected
          {model ? ` — ${model}` : ''}
          {' — AI analysis enabled'}
        </span>
      </div>
    )
  }

  const hint =
    health.ai_provider === 'groq'
      ? 'Check your GROQ_API_KEY'
      : `Not reachable at ${health.ollama_url}`

  return (
    <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-1.5">
      <WifiOff className="h-3.5 w-3.5 shrink-0" />
      <span>
        {provider} not connected ({hint}) — documents will be parsed but AI analysis will be skipped
      </span>
    </div>
  )
}

export function OllamaWarningModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { data: health } = useQuery({
    queryKey: ['health'],
    queryFn: apiClient.health,
    refetchInterval: 30000,
  })

  if (!isOpen) return null

  const isGroq = health?.ai_provider === 'groq'

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
      <div className="bg-white rounded-lg p-6 max-w-md mx-4 shadow-xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
          </div>
          <h2 className="text-lg font-semibold">
            {isGroq ? 'Groq Not Connected' : 'Ollama Not Connected'}
          </h2>
        </div>
        <p className="text-sm text-gray-600 mb-4">
          The AI analysis engine ({isGroq ? 'Groq' : 'Ollama'}) is not reachable. Your document
          will still be uploaded and parsed, but compliance analysis requires a working AI provider.
        </p>
        {isGroq ? (
          <div className="bg-gray-50 rounded-md p-3 text-xs font-mono text-gray-700 mb-4">
            AI_PROVIDER=groq{'\n'}GROQ_API_KEY=gsk_...
          </div>
        ) : (
          <div className="bg-gray-50 rounded-md p-3 text-xs font-mono text-gray-700 mb-4">
            ollama serve
          </div>
        )}
        {!isGroq && (
          <p className="text-xs text-gray-500 mb-4">
            Make sure Ollama is installed and running on your machine, then try again.
            You can download it from <span className="font-medium">ollama.ai</span>
          </p>
        )}
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
