import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getPortfolioAnalytics } from "../services/analytics";

const ranges = [
  { label: "7 days", value: "7d" },
  { label: "30 days", value: "30d" },
];

function MetricCard({ label, value, note, icon }) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-[#101612] p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[#A7B5AC]">{label}</p>
        <span className="grid size-9 place-items-center rounded-xl bg-emerald-400/10 text-lg text-[#5AFFB7]">{icon}</span>
      </div>
      <p className="mt-4 text-3xl font-bold tracking-tight text-white">{value ?? "—"}</p>
      <p className="mt-1 text-xs text-[#718078]">{note}</p>
    </div>
  );
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString();
}

export default function AnalyticsPage() {
  const navigate = useNavigate();
  const [range, setRange] = useState("7d");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await getPortfolioAnalytics(range);
      setData(result);
    } catch (err) {
      setError(err.message || "Unable to load analytics.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    if (!sessionStorage.getItem("access_token")) {
      navigate("/login", { replace: true });
      return;
    }
    const timer = window.setTimeout(loadAnalytics, 0);
    return () => window.clearTimeout(timer);
  }, [navigate, loadAnalytics]);

  const visits = useMemo(() => Array.isArray(data?.daily_visits) ? data.daily_visits : [], [data]);
  const maxVisits = Math.max(1, ...visits.map((item) => Number(item.visits || 0)));
  const topProjects = Array.isArray(data?.top_projects) ? data.top_projects : [];

  return (
    <div className="min-h-screen bg-[#080B09] text-[#F5F7F5]">
      <header className="border-b border-white/[0.08] bg-[#0A100D] px-5 py-4 lg:px-8">
        <Link to="/dashboard" className="text-lg font-bold">Portfolio<span className="text-[#00D68F]">Forge.</span></Link>
      </header>
      <main className="mx-auto max-w-7xl px-5 py-8 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#5AFFB7]">Your workspace</p>
            <h1 className="mt-2 text-3xl font-bold">Portfolio analytics</h1>
            <p className="mt-2 text-sm text-[#9EAAA2]">Understand how people discover and view your portfolio.</p>
          </div>
          <div className="flex items-center gap-2">
            {ranges.map((item) => (
              <button key={item.value} type="button" onClick={() => setRange(item.value)} className={`rounded-xl border px-4 py-2 text-sm font-semibold transition ${range === item.value ? "border-emerald-400 bg-emerald-400/15 text-[#5AFFB7]" : "border-white/10 text-[#A7B5AC] hover:border-white/20"}`}>{item.label}</button>
            ))}
            <button type="button" onClick={loadAnalytics} disabled={loading} className="rounded-xl bg-[#00D68F] px-4 py-2 text-sm font-bold text-[#041109] disabled:opacity-50">{loading ? "Loading…" : "Refresh"}</button>
          </div>
        </div>

        {error && (
          <div className="mt-7 rounded-2xl border border-amber-400/30 bg-amber-400/[0.07] p-5">
            <p className="font-semibold text-amber-200">Analytics are not connected yet</p>
            <p className="mt-2 text-sm leading-6 text-[#C5CEC8]">{error}</p>
            <p className="mt-2 text-sm text-[#9EAAA2]">The analytics screen is ready. The backend still needs the visitor-tracking and analytics endpoints before real numbers can appear.</p>
            <Link to="/dashboard" className="mt-4 inline-flex text-sm font-semibold text-[#5AFFB7]">← Back to dashboard</Link>
          </div>
        )}

        {loading && !data && !error && <p className="mt-8 text-sm text-[#9EAAA2]">Loading your analytics…</p>}

        {data && !error && (
          <>
            <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <MetricCard label="Total portfolio visitors" value={formatNumber(data.total_visitors)} note="All-time unique visitors" icon="◎" />
              <MetricCard label="Daily visits" value={formatNumber(data.daily_visits_total)} note="Today" icon="◷" />
              <MetricCard label="Weekly visits" value={formatNumber(data.weekly_visits_total)} note="Last 7 days" icon="▦" />
            </section>

            <section className="mt-6 grid gap-6 xl:grid-cols-[1.6fr_1fr]">
              <div className="rounded-2xl border border-white/[0.08] bg-[#101612] p-5 sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div><h2 className="text-lg font-bold">Visitor trends</h2><p className="mt-1 text-sm text-[#87968D]">Visits over the selected period</p></div>
                  <span className="rounded-full bg-emerald-400/10 px-3 py-1 text-xs text-[#5AFFB7]">{range === "7d" ? "Last 7 days" : "Last 30 days"}</span>
                </div>
                {visits.length ? (
                  <div className="mt-7 flex h-56 items-end gap-2 sm:gap-3">
                    {visits.map((item, index) => (
                      <div key={`${item.date || item.label || index}`} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2">
                        <span className="text-[10px] text-[#9EAAA2] sm:text-xs">{formatNumber(item.visits)}</span>
                        <div className="flex w-full flex-1 items-end"><div title={`${item.visits} visits`} className="w-full rounded-t-md bg-gradient-to-t from-emerald-600 to-emerald-300" style={{ height: `${Math.max(3, (Number(item.visits || 0) / maxVisits) * 100)}%` }} /></div>
                        <span className="max-w-full truncate text-[10px] text-[#87968D] sm:text-xs">{item.label || item.date || ""}</span>
                      </div>
                    ))}
                  </div>
                ) : <p className="mt-8 text-sm text-[#87968D]">No visitor activity recorded for this period yet.</p>}
              </div>

              <div className="rounded-2xl border border-white/[0.08] bg-[#101612] p-5 sm:p-6">
                <h2 className="text-lg font-bold">Most viewed projects</h2>
                <p className="mt-1 text-sm text-[#87968D]">Projects visitors open most often</p>
                {topProjects.length ? (
                  <div className="mt-5 space-y-4">
                    {topProjects.map((project, index) => {
                      const max = Math.max(1, ...topProjects.map((item) => Number(item.views || 0)));
                      return <div key={project.project_id || project.id || `${project.title}-${index}`}>
                        <div className="mb-2 flex items-center justify-between gap-3 text-sm"><span className="truncate font-medium text-[#E8EEE9]">{project.title || "Untitled project"}</span><span className="shrink-0 text-[#9EAAA2]">{formatNumber(project.views)} views</span></div>
                        <div className="h-2 overflow-hidden rounded-full bg-white/[0.07]"><div className="h-full rounded-full bg-[#00D68F]" style={{ width: `${(Number(project.views || 0) / max) * 100}%` }} /></div>
                      </div>;
                    })}
                  </div>
                ) : <p className="mt-5 text-sm text-[#87968D]">No project views recorded yet.</p>}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
