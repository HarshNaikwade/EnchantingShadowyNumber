import { Routes, Route } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import AnalysisWorkspace from './pages/AnalysisWorkspace'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/analysis/:id" element={<AnalysisWorkspace />} />
    </Routes>
  )
}
