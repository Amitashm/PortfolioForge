import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createPortfolio, deletePortfolio, getPortfolios, publishPortfolio, unpublishPortfolio } from "../services/portfolio";

export default function MyPortfoliosPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [slugDrafts, setSlugDrafts] = useState({});

  const refresh = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const result = await getPortfolios();
      const rows = Array.isArray(result) ? result : (result.portfolios || result.items || []);
      setItems(rows);
      setSlugDrafts(Object.fromEntries(rows.map((p) => [p.id, p.slug || (p.portfolio_data?.name || "portfolio").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")])));
    } catch (e) { setError(e.message || "Could not load your portfolios."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (!sessionStorage.getItem("access_token")) { navigate("/login", { replace: true }); return; }
    refresh();
  }, [navigate, refresh]);

  async function handleCreate() {
    setBusy("create"); setError("");
    try {
      const result = await createPortfolio({ template: "minimal", portfolio_data: { name: "", role: "", headline: "", about: "", email: "", phone: "", location: "", website: "", projects: [], education: [], experience: [], skills: [] } });
      const id = result.id ?? result.portfolio?.id;
      if (!id) throw new Error("The server created a portfolio but did not return its ID.");
      navigate(`/create-portfolio?portfolioId=${encodeURIComponent(id)}`);
    } catch (e) { setError(e.message || "Could not create a portfolio."); }
    finally { setBusy(""); }
  }

  async function togglePublish(p) {
    setBusy(String(p.id)); setError("");
    try {
      if (p.is_published) await unpublishPortfolio(p.id);
      else {
        const slug = (slugDrafts[p.id] || "").trim();
        if (!slug) throw new Error("Enter a URL name before publishing.");
        await publishPortfolio(p.id, slug);
      }
      await refresh();
    } catch (e) { setError(e.message || "Could not update publishing status."); }
    finally { setBusy(""); }
  }

  async function handleDelete(p) {
    if (!window.confirm(`Delete “${p.portfolio_data?.name || p.name || "this portfolio"}”? This cannot be undone.`)) return;
    setBusy(String(p.id)); setError("");
    try { await deletePortfolio(p.id); await refresh(); }
    catch (e) { setError(e.message || "Could not delete this portfolio."); }
    finally { setBusy(""); }
  }

  async function copyUrl(slug) {
    const url = `${window.location.origin}/u/${slug}`;
    try { await navigator.clipboard.writeText(url); }
    catch { setError("Clipboard access failed. Copy this URL manually: " + url); }
  }

  return <main className="min-h-screen bg-[#080B09] px-4 py-8 text-[#F5F7F5] sm:px-8 lg:px-12">
    <div className="mx-auto max-w-6xl">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div><Link to="/dashboard" className="text-sm text-white/50 hover:text-white">← Dashboard</Link><h1 className="mt-3 text-3xl font-bold">My Portfolios</h1><p className="mt-2 text-sm text-white/55">Create and manage up to 3 separate portfolio websites.</p></div>
        <button onClick={handleCreate} disabled={items.length >= 3 || busy === "create" || loading} className="rounded-xl bg-[#00D68F] px-5 py-3 font-semibold text-[#06130D] disabled:cursor-not-allowed disabled:opacity-40">{busy === "create" ? "Creating…" : "+ Create portfolio"}</button>
      </div>
      <div className="mb-5 flex items-center justify-between text-sm text-white/50"><span>{items.length} of 3 portfolios used</span><span>{3 - items.length} remaining</span></div>
      <div className="h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-[#00D68F]" style={{ width: `${Math.min(100, items.length / 3 * 100)}%` }} /></div>
      {error && <p className="mt-5 rounded-xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-200">{error}</p>}
      {loading ? <p className="py-16 text-center text-white/50">Loading your portfolios…</p> : items.length === 0 ? <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-12 text-center"><h2 className="text-xl font-semibold">No portfolios yet</h2><p className="mt-2 text-white/50">Create your first portfolio website to get started.</p><button onClick={handleCreate} className="mt-6 rounded-xl bg-[#00D68F] px-5 py-3 font-semibold text-[#06130D]">Create your first portfolio</button></div> : <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">{items.map((p, index) => {
        const slug = p.slug || ""; const name = p.portfolio_data?.name || p.name || `Portfolio ${index + 1}`; const url = slug ? `${window.location.origin}/u/${slug}` : "";
        return <article key={p.id} className="rounded-2xl border border-white/10 bg-[#101512] p-5 shadow-xl shadow-black/10">
          <div className="flex items-start justify-between gap-3"><div><p className="text-xs uppercase tracking-[0.18em] text-white/40">Portfolio {index + 1}</p><h2 className="mt-2 text-xl font-semibold">{name}</h2><p className="mt-1 text-sm capitalize text-white/45">{p.template || "minimal"} template</p></div><span className={`rounded-full px-3 py-1 text-xs ${p.is_published ? "bg-emerald-400/15 text-emerald-300" : "bg-white/10 text-white/50"}`}>{p.is_published ? "Published" : "Private"}</span></div>
          <div className="mt-5"><label className="mb-2 block text-xs text-white/50">Public URL name</label><div className="flex items-center rounded-lg border border-white/10 bg-black/20 px-3"><span className="text-xs text-white/35">/u/</span><input value={slugDrafts[p.id] || ""} onChange={(e) => setSlugDrafts((v) => ({ ...v, [p.id]: e.target.value }))} disabled={p.is_published} className="min-w-0 flex-1 bg-transparent px-2 py-2.5 text-sm outline-none disabled:text-white/40" placeholder="your-name" /></div></div>
          <div className="mt-5 grid grid-cols-2 gap-2"><button onClick={() => navigate(`/create-portfolio?portfolioId=${encodeURIComponent(p.id)}`)} className="rounded-lg border border-white/15 px-3 py-2.5 text-sm hover:bg-white/5">Edit</button><button onClick={() => togglePublish(p)} disabled={busy === String(p.id)} className="rounded-lg bg-[#00D68F] px-3 py-2.5 text-sm font-semibold text-[#06130D] disabled:opacity-50">{busy === String(p.id) ? "Please wait…" : p.is_published ? "Unpublish" : "Publish"}</button></div>
          {p.is_published && slug && <div className="mt-3 flex items-center justify-between gap-2 text-xs"><a href={url} target="_blank" rel="noreferrer" className="truncate text-emerald-300 hover:underline">{url}</a><button onClick={() => copyUrl(slug)} className="shrink-0 text-white/60 hover:text-white">Copy</button></div>}
          <button onClick={() => handleDelete(p)} disabled={busy === String(p.id)} className="mt-5 text-xs text-red-300/70 hover:text-red-300">Delete portfolio</button>
        </article>;
      })}</div>}
      <p className="mt-8 text-xs text-white/35">Each portfolio has its own content, template, publishing URL and analytics.</p>
    </div>
  </main>;
}
