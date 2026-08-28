import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router";
import AppLayout from "./layout/AppLayout";
import { ScrollToTop } from "./components/common/ScrollToTop";
import DeveloperView from "./pages/DeveloperView";
import Console from "./pages/Console";
import LivePipeline from "./pages/LivePipeline";
import Traceability from "./pages/Traceability";
import KnowledgeGraph from "./pages/KnowledgeGraph";
import KnowledgeManagement from "./pages/KnowledgeManagement";
import NotBuilt from "./pages/NotBuilt";
import Portfolio from "./pages/Portfolio";
import Strategy from "./pages/Strategy";
import { Analytics, Initiatives, RiskRegister } from "./pages/ExecStubs";
import NotFound from "./pages/OtherPage/NotFound";
import Login from "./pages/Login";

function RequireAuth({ children }: { children: React.ReactNode }) {
  if (!localStorage.getItem("demo_role")) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

function RoleIndex() {
  const role = localStorage.getItem("demo_role");
  return <Navigate to={role === "user_executive" ? "/portfolio" : "/knowledge-management"} replace />;
}

export default function App() {
  return (
    <Router>
      <ScrollToTop />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
          <Route index path="/" element={<RoleIndex />} />
          <Route path="/tasks" element={<DeveloperView />} />
          <Route path="/delivery" element={<Console />} />
          <Route path="/live" element={<LivePipeline />} />
          <Route path="/traceability" element={<Traceability />} />
          <Route path="/graph" element={<KnowledgeGraph />} />
          <Route path="/knowledge-management" element={<KnowledgeManagement />} />
          <Route path="/portfolio" element={<Portfolio />} />
          <Route path="/strategy" element={<Strategy />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/initiatives" element={<Initiatives />} />
          <Route path="/risk" element={<RiskRegister />} />
          <Route
            path="/settings"
            element={<NotBuilt title="Settings" blurb="Workspace, connectors and notification preferences." />}
          />
          <Route
            path="/support"
            element={<NotBuilt title="Support" blurb="Raise an issue with the platform team." />}
          />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Router>
  );
}
