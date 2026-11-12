import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import NotFoundPage from "./pages/NotFoundPage";
import PortfolioPage from "./pages/PortfolioPage";
import PublicPortfolioPage from "./pages/PublicPortfolioPage";
import CreatePortfolioPage from "./pages/CreatePortfolioPage";
import DashboardPage from "./pages/DashboardPage";
import ProjectsPage from "./pages/ProjectsPage";
import JobTrackerPage from "./pages/JobTrackerPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import MyPortfoliosPage from "./pages/MyPortfoliosPage";
import ThemeToggle from "./components/common/ThemeToggle";

function App() {
  return (
    <BrowserRouter>
      <ThemeToggle />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />

        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/my-portfolios" element={<MyPortfoliosPage />} />
        <Route path="/job-tracker" element={<JobTrackerPage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />

        <Route path="/portfolio" element={<PortfolioPage />} />
        <Route path="/u/:slug" element={<PublicPortfolioPage />} />
        <Route
          path="/create-portfolio"
          element={<CreatePortfolioPage />}
        />

        <Route path="*" element={<NotFoundPage />} />
        <Route path="/projects" element={<ProjectsPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;