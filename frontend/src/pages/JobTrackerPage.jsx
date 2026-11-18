import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

const STORAGE_KEY = "portfolioforge_job_applications";
const STATUSES = ["Interested", "Applied", "Interview", "Offer", "Rejected"];

function JobTrackerPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      return Array.isArray(saved) ? saved : [];
    } catch {
      return [];
    }
  });
  const [form, setForm] = useState({ company: "", role: "", location: "", url: "", date: new Date().toISOString().slice(0, 10), status: "Interested", notes: "" });
  const [filter, setFilter] = useState("All");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!sessionStorage.getItem("access_token")) { navigate("/login", { replace: true }); return; }
  }, [navigate]);

  function persist(next) { setItems(next); localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); }
  function addApplication(event) {
    event.preventDefault();
    if (!form.company.trim() || !form.role.trim()) return;
    persist([{ ...form, id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()), company: form.company.trim(), role: form.role.trim(), createdAt: new Date().toISOString() }, ...items]);
    setForm({ company: "", role: "", location: "", url: "", date: new Date().toISOString().slice(0, 10), status: "Interested", notes: "" });
    setNotice("Application added to your tracker.");
  }
  function updateStatus(id, status) { persist(items.map(item => item.id === id ? { ...item, status } : item)); }
  function removeItem(id) { persist(items.filter(item => item.id !== id)); }
  const visible = useMemo(() => filter === "All" ? items : items.filter(item => item.status === filter), [items, filter]);
  const counts = Object.fromEntries(STATUSES.map(status => [status, items.filter(item => item.status === status).length]));

  return <div className="min-h-screen bg-[#080B09] text-[#F5F7F5]"><header className="border-b border-white/[0.08] bg-[#0A100D] px-5 py-4"><div className="mx-auto flex max-w-6xl items-center justify-between"><Link to="/dashboard" className="text-lg font-bold">Portfolio<span className="text-[#00D68F]">Forge.</span></Link><Link to="/dashboard" className="text-sm text-gray-300 hover:text-[#5AFFB7]">← Back to dashboard</Link></div></header>
    <main className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8"><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-[#5AFFB7]">Career tools</p><h1 className="mt-2 text-3xl font-bold">Job application tracker</h1><p className="mt-2 text-sm text-gray-400">Keep your opportunities, follow-ups and interview progress organized.</p></div>
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">{STATUSES.map(status => <div key={status} className="rounded-xl border border-white/10 bg-[#101511] p-4"><p className="text-xs text-gray-400">{status}</p><p className="mt-2 text-2xl font-bold">{counts[status] || 0}</p></div>)}</section>
      <section className="grid gap-5 lg:grid-cols-[0.85fr_1.15fr]"><form onSubmit={addApplication} className="h-fit space-y-3 rounded-2xl border border-white/10 bg-[#101511] p-5"><h2 className="font-bold">Add an opportunity</h2><label className="block text-xs text-gray-400">Company<input value={form.company} onChange={e=>setForm({...form,company:e.target.value})} required placeholder="Company name" className="mt-1 w-full rounded-lg border border-white/10 bg-[#0B100D] px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-400"/></label><label className="block text-xs text-gray-400">Role<input value={form.role} onChange={e=>setForm({...form,role:e.target.value})} required placeholder="Frontend Developer" className="mt-1 w-full rounded-lg border border-white/10 bg-[#0B100D] px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-400"/></label><label className="block text-xs text-gray-400">Location<input value={form.location} onChange={e=>setForm({...form,location:e.target.value})} placeholder="Remote / City" className="mt-1 w-full rounded-lg border border-white/10 bg-[#0B100D] px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-400"/></label><div className="grid grid-cols-2 gap-3"><label className="text-xs text-gray-400">Date<input type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})} className="mt-1 w-full rounded-lg border border-white/10 bg-[#0B100D] px-2 py-2.5 text-sm text-white"/></label><label className="text-xs text-gray-400">Status<select value={form.status} onChange={e=>setForm({...form,status:e.target.value})} className="mt-1 w-full rounded-lg border border-white/10 bg-[#0B100D] px-2 py-2.5 text-sm text-white">{STATUSES.map(s=><option key={s}>{s}</option>)}</select></label></div><label className="block text-xs text-gray-400">Job posting link<input type="url" value={form.url} onChange={e=>setForm({...form,url:e.target.value})} placeholder="https://..." className="mt-1 w-full rounded-lg border border-white/10 bg-[#0B100D] px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-400"/></label><label className="block text-xs text-gray-400">Notes<textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} rows="3" placeholder="Recruiter contact, follow-up date, interview notes..." className="mt-1 w-full rounded-lg border border-white/10 bg-[#0B100D] px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-400"/></label><button className="w-full rounded-lg bg-[#00D68F] px-4 py-3 text-sm font-bold text-[#041109] hover:bg-[#5AFFB7]">＋ Add application</button>{notice && <p role="status" className="text-xs text-emerald-300">{notice}</p>}<p className="text-[11px] leading-5 text-gray-500">Your tracker is stored in this browser on this device. It is not yet synced to your account or database.</p></form>
      <div className="rounded-2xl border border-white/10 bg-[#101511] p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-bold">Your opportunities</h2><p className="mt-1 text-xs text-gray-400">{items.length} tracked application{items.length===1?"":"s"}</p></div><select value={filter} onChange={e=>setFilter(e.target.value)} className="rounded-lg border border-white/10 bg-[#0B100D] px-3 py-2 text-xs text-white"><option>All</option>{STATUSES.map(s=><option key={s}>{s}</option>)}</select></div><div className="mt-4 space-y-3">{visible.length===0 ? <div className="rounded-xl border border-dashed border-white/10 p-8 text-center"><p className="font-semibold">No opportunities here yet</p><p className="mt-1 text-sm text-gray-500">Add a job application using the form.</p></div> : visible.map(item=><article key={item.id} className="rounded-xl border border-white/10 bg-[#0B100D] p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h3 className="font-semibold">{item.role}</h3><p className="mt-1 text-sm text-gray-300">{item.company}{item.location?` · ${item.location}`:""}</p><p className="mt-1 text-xs text-gray-500">Added date: {item.date || "Not set"}</p></div><button onClick={()=>removeItem(item.id)} className="text-xs text-rose-300 hover:text-rose-200">Remove</button></div>{item.notes && <p className="mt-3 whitespace-pre-wrap text-sm text-gray-400">{item.notes}</p>}<div className="mt-3 flex flex-wrap items-center justify-between gap-2"><select aria-label={`Status for ${item.company}`} value={item.status} onChange={e=>updateStatus(item.id,e.target.value)} className="rounded-lg border border-white/10 bg-[#101511] px-3 py-2 text-xs text-white">{STATUSES.map(s=><option key={s}>{s}</option>)}</select>{item.url && <a href={item.url} target="_blank" rel="noreferrer" className="text-xs font-semibold text-[#5AFFB7] hover:underline">Open job posting ↗</a>}</div></article>)}</div></div></section>
    </main></div>;
}
export default JobTrackerPage;
