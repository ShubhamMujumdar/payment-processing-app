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
import Login, { ROLES } from "./pages/Login";
import ProgramManagerHealth from "./pages/ProgramManagerHealth";
import ProgramManagerDeliverables from "./pages/ProgramManagerDeliverables";
import ProgramManagerKnowledgeBase from "./pages/ProgramManagerKnowledgeBase";
import ProgramManagerTraceability from "./pages/ProgramManagerTraceability";

function RequireAuth({ children }: { children: React.ReactNode }) {
  if (!localStorage.getItem("demo_role")) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

function RoleIndex() {
  // Reads the same landing table the sign-in screen uses, so the two cannot
  // disagree. They had: this sent a program manager to /pm-health while
  // Login sent them to /knowledge-management, and Login won because it
  // navigates straight to the path rather than through here.
  const role = localStorage.getItem("demo_role");
  const landing = ROLES.find((r) => r.id === role)?.defaultPath;
  return <Navigate to={landing ?? "/knowledge-management"} replace />;
}

function BlockProductOps({ children }: { children: React.ReactNode }) {
  const role = localStorage.getItem("demo_role");
  if (role === "user_product_ops") {
    return <Navigate to="/settings" replace />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <Router>
      <ScrollToTop />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
          <Route index path="/" element={<RoleIndex />} />
          <Route path="/tasks" element={<BlockProductOps><DeveloperView /></BlockProductOps>} />
          <Route path="/delivery" element={<BlockProductOps><Console /></BlockProductOps>} />
          <Route path="/live" element={<BlockProductOps><LivePipeline /></BlockProductOps>} />
          <Route path="/traceability" element={<BlockProductOps><Traceability /></BlockProductOps>} />
          <Route path="/graph" element={<BlockProductOps><KnowledgeGraph /></BlockProductOps>} />
          <Route path="/pm-health" element={<ProgramManagerHealth />} />
          <Route path="/pm-deliverables" element={<ProgramManagerDeliverables />} />
          <Route path="/pm-knowledge" element={<ProgramManagerKnowledgeBase />} />
          <Route path="/pm-traceability" element={<ProgramManagerTraceability />} />
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
