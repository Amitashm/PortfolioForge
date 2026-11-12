import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import TemplateRenderer from "../components/templates/TemplateRenderer";
import { getPublicPortfolio } from "../services/portfolio";
import { trackPortfolioVisit } from "../services/analytics";

const emptyPortfolio = {
  name: "", role: "", about: "", email: "", phone: "", location: "", website: "",
  projects: [], education: [], experience: [], skills: [],
};

export default function PublicPortfolioPage() {
  const { slug } = useParams();
  const [portfolio, setPortfolio] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    getPublicPortfolio(slug)
      .then((result) => {
        if (!active) return;
        const data = result.portfolio_data || {};
        trackPortfolioVisit(slug);
        setPortfolio({
          template: result.template || "minimal",
          data: {
            ...emptyPortfolio,
            ...data,
            projects: Array.isArray(data.projects) ? data.projects : [],
            education: Array.isArray(data.education) ? data.education : [],
            experience: Array.isArray(data.experience) ? data.experience : [],
            skills: Array.isArray(data.skills) ? data.skills : [],
          },
        });
      })
      .catch((err) => { if (active) setError(err.message || "This portfolio could not be found."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [slug]);

  if (loading) return <main className="grid min-h-screen place-items-center bg-[#070908] text-white">Loading portfolio...</main>;
  if (error || !portfolio) return (
    <main className="grid min-h-screen place-items-center bg-[#070908] px-5 text-center text-white">
      <div className="max-w-md">
        <p className="text-5xl">⌁</p>
        <h1 className="mt-4 text-3xl font-bold">Portfolio unavailable</h1>
        <p className="mt-3 text-[#A4B0A8]">{error || "This portfolio may not be published yet."}</p>
        <Link to="/" className="mt-6 inline-flex rounded-xl bg-[#00D68F] px-5 py-3 font-bold text-[#041109]">Visit PortfolioForge</Link>
      </div>
    </main>
  );
  return (
    <>
      <div className="fixed bottom-4 right-4 z-50 rounded-full border border-white/10 bg-[#080B09]/90 px-3 py-2 text-xs text-white/80 shadow-lg backdrop-blur">
        Made with <Link to="/" className="font-bold text-[#5AFFB7]">PortfolioForge</Link>
      </div>
      <TemplateRenderer template={portfolio.template} data={portfolio.data} />
    </>
  );
}
