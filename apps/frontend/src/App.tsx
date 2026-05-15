import { Navigate, Route, Routes } from "react-router-dom";
import SessionsPage from "./features/sessions/SessionsPage.tsx";
import WorkspacePage from "./features/documents/WorkspacePage.tsx";
import ClausesPage from "./features/clauses/ClausesPage.tsx";
import DebugPanel from "./components/DebugPanel";

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<SessionsPage />} />
        <Route path="/analysis/:id" element={<WorkspacePage />} />
        <Route path="/settings/clauses" element={<ClausesPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <DebugPanel />
    </>
  );
}
