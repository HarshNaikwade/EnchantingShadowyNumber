import { Routes, Route } from "react-router-dom";
import SessionsPage from "./features/sessions/SessionsPage";
import WorkspacePage from "./features/documents/WorkspacePage";
import ClausesPage from "./features/clauses/ClausesPage";
import DebugPanel from "./components/DebugPanel";

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<SessionsPage />} />
        <Route path="/analysis/:id" element={<WorkspacePage />} />
        <Route path="/settings/clauses" element={<ClausesPage />} />
      </Routes>
      <DebugPanel />
    </>
  );
}
