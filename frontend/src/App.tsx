import { Routes, Route } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import AnalysisWorkspace from './pages/AnalysisWorkspace'
import RBIClausesSettings from './pages/RBIClausesSettings'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/analysis/:id" element={<AnalysisWorkspace />} />
      <Route path="/settings/clauses" element={<RBIClausesSettings />} />
    </Routes>
  )
}
