import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { publishMyPortfolio, unpublishMyPortfolio } from "../services/portfolio";

const navigation = [
  { label: "Dashboard", icon: "▦", path: "/dashboard" },
  { label: "My Portfolios", icon: "▤", path: "/my-portfolios" },
  { label: "Personal Information", icon: "♙", path: "/create-portfolio?step=personal" },
  { label: "Choose Template", icon: "▧", path: "/create-portfolio?step=template" },
  { label: "Projects", icon: "▣", path: "/create-portfolio?step=projects" },
  { label: "Education", icon: "◇", path: "/create-portfolio?step=education" },
  { label: "Experience", icon: "▱", path: "/create-portfolio?step=experience" },
  { label: "Skills", icon: "✳", path: "/create-portfolio?step=skills" },
  { label: "Job Tracker", icon: "▤", path: "/job-tracker" },
  { label: "Analytics", icon: "▥", path: "/analytics" },
];

const sections = [
  { key: "personal", label: "Personal information", path: "/create-portfolio?step=personal" },
  { key: "education", label: "Education", path: "/create-portfolio?step=education" },
  { key: "projects", label: "Projects", path: "/create-portfolio?step=projects" },
  { key: "experience", label: "Experience", path: "/create-portfolio?step=experience" },
  { key: "skills", label: "Skills", path: "/create-portfolio?step=skills" },
];

const dataKeys = [
  "portfolio", "portfolioData", "portfolio_data", "portfolioForm",
  "portfolioFormData", "portfolioDetails", "personalInfo",
  "personalInformation", "education", "projects", "experience",
  "skills", "selectedTemplate",
];

function readSavedData() {
  const result = {};
  for (const store of [window.localStorage, window.sessionStorage]) {
    for (const key of dataKeys) {
      const raw = store.getItem(key);
      if (raw) {
        try { result[key] = JSON.parse(raw); }
        catch { result[key] = raw; }
      }
    }
    for (let i = 0; i < store.length; i += 1) {
      const key = store.key(i);
      if (!key || /token|password|auth|user/i.test(key)) continue;
      if (/portfolio|personal.?info|education|projects|experience|skills|template/i.test(key)) {
        const raw = store.getItem(key);
        if (raw) {
          try { result[key] = JSON.parse(raw); }
          catch { result[key] = raw; }
        }
      }
    }
  }
  return result;
}

function useful(value) {
  if (value === null || value === undefined || value === "") return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return true;
  if (typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.some(useful);
  if (typeof value === "object") return Object.values(value).some(useful);
  return false;
}

function findData(data, keys) {
  const wanted = keys.map((key) => key.toLowerCase().replace(/[^a-z0-9]/g, ""));
  const seen = new Set();
  function visit(value, depth = 0) {
    if (!value || typeof value !== "object" || depth > 5 || seen.has(value)) return undefined;
    seen.add(value);
    for (const [key, child] of Object.entries(value)) {
      if (wanted.includes(key.toLowerCase().replace(/[^a-z0-9]/g, "")) && useful(child)) return child;
    }
    for (const child of Object.values(value)) {
      const result = visit(child, depth + 1);
      if (result !== undefined) return result;
    }
    return undefined;
  }
  return visit(data);
}

function sectionComplete(section, data, user) {
  if (section === "personal") {
    return Boolean(
      user?.full_name || user?.name || user?.email ||
      findData(data, ["fullName", "name", "email", "bio", "about", "profession", "jobTitle"])
    );
  }
  const aliases = {
    education: ["education", "educationEntries", "educationList", "educations"],
    projects: ["projects", "projectEntries", "projectList", "portfolioProjects"],
    experience: ["experience", "experiences", "experienceEntries", "experienceList", "workExperience"],
    skills: ["skills", "skillList", "technicalSkills"],
  };
  return useful(findData(data, aliases[section] || [section]));
}

function countEntries(data, section) {
  const aliases = {
    projects: ["projects", "projectEntries", "projectList", "portfolioProjects"],
    education: ["education", "educationEntries", "educationList", "educations"],
    experience: ["experience", "experiences", "experienceEntries", "experienceList", "workExperience"],
  };
  const value = findData(data, aliases[section] || [section]);
  if (Array.isArray(value)) return value.filter(useful).length;
  return useful(value) ? 1 : 0;
}

function DashboardPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [savedData, setSavedData] = useState({});
  const [publishSlug, setPublishSlug] = useState("");
  const [publishedUrl, setPublishedUrl] = useState("");
  const [isPublished, setIsPublished] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishMessage, setPublishMessage] = useState("");

  const refreshSavedData = useCallback(() => setSavedData(readSavedData()), []);

  useEffect(() => {
    const token = sessionStorage.getItem("access_token");
    const savedUser = sessionStorage.getItem("user");
    if (!token) {
      navigate("/login", { replace: true });
      return;
    }
    try { setUser(savedUser ? JSON.parse(savedUser) : {}); }
    catch { setUser({}); }

    const initialName = (JSON.parse(savedUser || "{}")?.username || JSON.parse(savedUser || "{}")?.full_name || JSON.parse(savedUser || "{}")?.name || "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    setPublishSlug(initialName);
    refreshSavedData();
    window.addEventListener("focus", refreshSavedData);
    window.addEventListener("storage", refreshSavedData);
    return () => {
      window.removeEventListener("focus", refreshSavedData);
      window.removeEventListener("storage", refreshSavedData);
    };
  }, [navigate, refreshSavedData]);

  async function handlePublish(event) {
    event.preventDefault();
    setPublishing(true);
    setPublishMessage("");
    try {
      const result = await publishMyPortfolio(publishSlug.trim());
      const slug = result.slug || publishSlug.trim();
      const url = result.public_url || `${window.location.origin}/u/${slug}`;
      setPublishSlug(slug);
      setPublishedUrl(url);
      setIsPublished(true);
      setPublishMessage("Your portfolio is published and ready to share!");
    } catch (err) {
      setPublishMessage(err.message || "Could not publish your portfolio. Please try again.");
    } finally {
      setPublishing(false);
    }
  }

  async function handleUnpublish() {
    setPublishing(true);
    setPublishMessage("");
    try {
      await unpublishMyPortfolio();
      setIsPublished(false);
      setPublishedUrl("");
      setPublishMessage("Your portfolio is now private.");
    } catch (err) {
      setPublishMessage(err.message || "Could not unpublish your portfolio.");
    } finally {
      setPublishing(false);
    }
  }

  async function handleCopyUrl() {
    try {
      await navigator.clipboard.writeText(publishedUrl);
      setPublishMessage("Link copied to clipboard!");
    } catch {
      setPublishMessage("Copy failed. Please select and copy the link manually.");
    }
  }

  function handleLogout() {
    sessionStorage.removeItem("access_token");
    sessionStorage.removeItem("user");
    navigate("/login", { replace: true });
  }

  if (!user) return null;

  const displayName = user.full_name || user.name || user.username || user.email?.split("@")[0] || "there";
  const initials = displayName.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  const currentStep = new URLSearchParams(location.search).get("step");
  const stepMap = {
    "Personal Information": "personal", "Choose Template": "template",
    Projects: "projects", Education: "education", Experience: "experience", Skills: "skills",
  };
  const completion = sections.map((section) => ({
    ...section, complete: sectionComplete(section.key, savedData, user),
  }));
  const completedCount = completion.filter((item) => item.complete).length;
  const progress = Math.round((completedCount / sections.length) * 100);
  const nextSection = completion.find((item) => !item.complete) || sections[0];
  const portfolioData = findData(savedData, ["portfolioData", "portfolio_data"]) || savedData.portfolioData || savedData;
  const profileName = portfolioData?.name || portfolioData?.full_name || displayName;
  const profileRole = portfolioData?.role || portfolioData?.headline || portfolioData?.profession || "Add your professional headline";
  const profileAbout = portfolioData?.about || portfolioData?.bio || "Add a short introduction so visitors understand what you do.";
  const profileSkills = Array.isArray(portfolioData?.skills) ? portfolioData.skills : [];
  const healthScore = Math.min(100, Math.round((completedCount / sections.length) * 100));
  const stats = [
    { label: "Portfolios", value: "Up to 3", detail: "Manage your websites", icon: "▤", color: "text-emerald-400", path: "/my-portfolios" },
    { label: "Projects", value: countEntries(savedData, "projects"), detail: "Projects added", icon: "▣", color: "text-violet-400", path: "/create-portfolio?step=projects" },
    { label: "Education", value: countEntries(savedData, "education"), detail: "Education entries", icon: "◇", color: "text-sky-400", path: "/create-portfolio?step=education" },
    { label: "Experience", value: countEntries(savedData, "experience"), detail: "Experience entries", icon: "▱", color: "text-orange-400", path: "/create-portfolio?step=experience" },
  ];

  return (
    <div className="min-h-screen bg-[#080B09] text-[#F5F7F5]">
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-white/[0.08] bg-[#080B09]/95 px-4 backdrop-blur-lg lg:hidden">
        <button type="button" onClick={() => setMenuOpen((open) => !open)} aria-label={menuOpen ? "Close navigation" : "Open navigation"} aria-expanded={menuOpen} className="rounded-lg border border-white/10 px-3 py-2 text-lg">{menuOpen ? "✕" : "☰"}</button>
        <Link to="/dashboard" className="text-lg font-bold tracking-tight">Portfolio<span className="text-[#00D68F]">Forge.</span></Link>
        <div className="grid size-9 place-items-center rounded-full bg-violet-400/20 text-sm font-bold text-violet-200">{initials}</div>
      </header>

      <div className="flex min-h-screen">
        <aside className={`${menuOpen ? "translate-x-0" : "-translate-x-full"} fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-white/[0.08] bg-[#0A100D] transition-transform duration-300 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0`}>
          <Link to="/dashboard" onClick={() => setMenuOpen(false)} className="flex h-16 shrink-0 items-center gap-3 border-b border-white/[0.08] px-6">
            <span className="grid size-9 place-items-center rounded-xl border border-emerald-400/30 bg-emerald-400/10 text-xl font-bold text-[#00D68F]">P</span>
            <span className="text-lg font-bold">Portfolio<span className="text-[#00D68F]">Forge.</span></span>
          </Link>
          <nav aria-label="Dashboard navigation" className="flex-1 space-y-1 overflow-y-auto px-4 py-5">
            {navigation.map((item) => {
              const active = item.label === "Dashboard" ? location.pathname === "/dashboard" : item.path === "/analytics" || item.path === "/job-tracker" ? location.pathname === item.path : location.pathname === "/create-portfolio" && currentStep === stepMap[item.label];
              return <Link key={item.label} to={item.path} onClick={() => setMenuOpen(false)} aria-current={active ? "page" : undefined} className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm transition ${active ? "bg-emerald-400/15 font-semibold text-[#5AFFB7]" : "text-gray-300 hover:bg-white/[0.04] hover:text-white"}`}><span className="w-5 text-center text-lg">{item.icon}</span>{item.label}</Link>;
            })}
          </nav>
          <div className="shrink-0 border-t border-white/[0.08] p-4">
            <Link to="/settings" onClick={() => setMenuOpen(false)} className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm text-gray-300 transition hover:bg-white/[0.04] hover:text-white"><span className="w-5 text-center text-lg">⚙</span>Settings</Link>
            <button type="button" onClick={handleLogout} className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm text-rose-300 transition hover:bg-rose-400/10"><span className="w-5 text-center text-lg">↪</span>Logout</button>
          </div>
        </aside>

        {menuOpen && <button type="button" aria-label="Close navigation" onClick={() => setMenuOpen(false)} className="fixed inset-0 z-30 bg-black/60 lg:hidden" />}

        <main className="min-w-0 flex-1">
          <header className="hidden h-16 items-center justify-between border-b border-white/[0.08] px-8 lg:flex">
            <p className="text-sm text-gray-400">Your workspace</p>
            <div className="flex items-center gap-3"><span className="text-sm text-gray-300">{displayName}</span><div className="grid size-9 place-items-center rounded-full bg-violet-400/20 text-sm font-bold text-violet-200">{initials}</div></div>
          </header>

          <div className="mx-auto max-w-[1600px] space-y-7 p-4 sm:p-6 lg:p-8">
            <section className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
              <div><p className="text-xs font-bold uppercase tracking-[0.2em] text-[#5AFFB7]">✦ Your workspace</p><h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">Welcome back, {displayName}!</h1><p className="mt-2 text-sm leading-6 text-gray-400">Build, personalize, and share your professional portfolio.</p></div>
              <Link to="/create-portfolio" className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#00D68F] px-5 py-3 text-sm font-bold text-[#041109] transition hover:bg-[#5AFFB7]">Continue editing <span>↗</span></Link>
            </section>

            <section aria-labelledby="portfolio-progress-heading" className="rounded-2xl border border-emerald-400/20 bg-[#101511] p-5 sm:p-6">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div><h2 id="portfolio-progress-heading" className="font-bold">Your portfolio progress</h2><p className="mt-1 text-sm text-gray-400">{completedCount} of {sections.length} sections marked complete</p></div>
                <p className="text-2xl font-bold text-[#5AFFB7]">{progress}%</p>
              </div>
              <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-label="Portfolio completion" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
                <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-[#5AFFB7] transition-all duration-500" style={{ width: `${progress}%` }} />
              </div>
              <p className="mt-3 text-sm text-gray-400">{completedCount === sections.length ? "Great work! All sections have information saved." : `Next up: add your ${nextSection.label.toLowerCase()}.`}</p>
            </section>

            <section aria-label="Portfolio overview" className="grid grid-cols-2 gap-3 xl:grid-cols-4 xl:gap-5">
              {stats.map((stat) => <Link key={stat.label} to={stat.path} className="group rounded-2xl border border-white/[0.08] bg-[#101511] p-4 transition hover:-translate-y-0.5 hover:border-emerald-400/30 hover:bg-[#121A15] sm:p-5">
                <div className="flex items-center justify-between"><span className="text-sm text-gray-300">{stat.label}</span><span className={`text-xl ${stat.color}`}>{stat.icon}</span></div>
                <p className="mt-4 text-3xl font-bold">{stat.value}</p><p className="mt-1 text-xs text-gray-500">{stat.detail}</p>
              </Link>)}
            </section>

            <section className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
              <div className="rounded-2xl border border-white/[0.08] bg-[#101511] p-5 sm:p-6">
                <div className="flex items-center justify-between gap-3"><div><h2 className="font-bold">Live portfolio preview</h2><p className="mt-1 text-sm text-gray-400">A quick look at the information saved to your portfolio.</p></div><Link to="/create-portfolio" className="text-sm font-semibold text-[#5AFFB7] hover:underline">Edit ↗</Link></div>
                <div className="mt-4 rounded-xl border border-emerald-400/15 bg-[radial-gradient(ellipse_at_top_right,rgba(0,214,143,0.12),transparent_55%),#080B09] p-5 sm:p-6">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#5AFFB7]">{profileRole}</p>
                  <h3 className="mt-3 text-2xl font-bold">{profileName}</h3>
                  <p className="mt-2 line-clamp-3 max-w-2xl text-sm leading-6 text-gray-400">{profileAbout}</p>
                  <div className="mt-4 flex flex-wrap gap-2">{profileSkills.slice(0, 6).map((skill, index) => <span key={`${typeof skill === "string" ? skill : skill.name || index}`} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-gray-300">{typeof skill === "string" ? skill : skill.name || skill.title || "Skill"}</span>)}{profileSkills.length === 0 && <span className="text-xs text-gray-500">Your saved skills will appear here.</span>}</div>
                  <div className="mt-5 flex flex-wrap gap-2"><Link to="/create-portfolio?step=personal" className="rounded-lg bg-[#00D68F] px-3 py-2 text-xs font-bold text-[#041109] hover:bg-[#5AFFB7]">Update profile</Link><button type="button" onClick={() => window.print()} className="rounded-lg border border-white/15 px-3 py-2 text-xs font-semibold text-gray-200 hover:bg-white/5">Print / save as PDF</button></div>
                </div>
              </div>
              <div className="rounded-2xl border border-white/[0.08] bg-[#101511] p-5 sm:p-6">
                <div className="flex items-center justify-between"><div><h2 className="font-bold">Portfolio health</h2><p className="mt-1 text-sm text-gray-400">Based on your completed sections.</p></div><span className="text-2xl font-bold text-[#5AFFB7]">{healthScore}%</span></div>
                <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-[#5AFFB7] transition-all" style={{width:`${healthScore}%`}} /></div>
                <p className="mt-3 text-sm text-gray-300">{healthScore === 100 ? "Your core portfolio sections are complete." : `${sections.length - completedCount} section${sections.length - completedCount === 1 ? "" : "s"} still need attention.`}</p>
                <div className="mt-5 space-y-2">{completion.map(item => <div key={item.key} className="flex items-center justify-between text-sm"><span className="text-gray-400">{item.label}</span><span className={item.complete ? "text-emerald-300" : "text-gray-500"}>{item.complete ? "Ready" : "Incomplete"}</span></div>)}</div>
                <Link to={nextSection.path} className="mt-5 inline-flex text-sm font-semibold text-[#5AFFB7] hover:underline">Improve next section →</Link>
              </div>
            </section>

            <section className="grid gap-5 md:grid-cols-2">
              <div className="rounded-2xl border border-white/[0.08] bg-[#101511] p-5"><h2 className="font-bold">Quick actions</h2><p className="mt-1 text-sm text-gray-400">Jump straight to the work you want to do.</p><div className="mt-4 grid grid-cols-2 gap-2"><Link to="/create-portfolio?step=projects" className="rounded-xl border border-white/10 p-3 text-sm text-gray-200 hover:border-emerald-400/30 hover:bg-white/[0.03]">＋ Add project</Link><Link to="/create-portfolio?step=skills" className="rounded-xl border border-white/10 p-3 text-sm text-gray-200 hover:border-emerald-400/30 hover:bg-white/[0.03]">✳ Update skills</Link><Link to="/create-portfolio?step=experience" className="rounded-xl border border-white/10 p-3 text-sm text-gray-200 hover:border-emerald-400/30 hover:bg-white/[0.03]">＋ Add experience</Link><Link to="/job-tracker" className="rounded-xl border border-white/10 p-3 text-sm text-gray-200 hover:border-emerald-400/30 hover:bg-white/[0.03]">▤ Track applications</Link></div></div>
              <div className="rounded-2xl border border-white/[0.08] bg-[#101511] p-5"><h2 className="font-bold">Career snapshot</h2><p className="mt-1 text-sm text-gray-400">A share-ready contact card based on your saved profile.</p><div className="mt-4 rounded-xl border border-emerald-400/15 bg-[#0B100D] p-4"><div className="flex items-center gap-3"><div className="grid size-11 place-items-center rounded-full bg-emerald-400/15 font-bold text-[#5AFFB7]">{initials}</div><div className="min-w-0"><p className="truncate font-semibold">{profileName}</p><p className="truncate text-xs text-gray-400">{profileRole}</p></div></div><p className="mt-3 break-all text-xs text-gray-400">{portfolioData?.email || user.email || "Add an email address to your profile"}</p><button type="button" onClick={async () => { const card = `${profileName}
${profileRole}
${portfolioData?.email || user.email || ""}
${window.location.origin}/u/${publishSlug}`; try { await navigator.clipboard.writeText(card); setPublishMessage("Career card details copied!"); } catch { setPublishMessage("Clipboard access is unavailable in this browser."); } }} className="mt-3 rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-gray-200 hover:bg-white/5">Copy contact card</button></div></div>
            </section>

            <section className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
              <div className="rounded-2xl border border-white/[0.08] bg-[#101511] p-4 sm:p-6">
                <div className="flex items-center justify-between gap-3"><h2 className="font-bold">Your portfolio</h2><span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-xs text-amber-300">Draft</span></div>
                <div className="mt-5 flex min-h-64 flex-col justify-between rounded-xl border border-emerald-400/10 bg-[radial-gradient(ellipse_at_top_right,rgba(0,214,143,0.12),transparent_55%),#080B09] p-6 sm:p-8">
                  <div><p className="text-xs font-bold uppercase tracking-[0.2em] text-[#5AFFB7]">{displayName}</p><h3 className="mt-6 max-w-md text-3xl font-bold tracking-tight sm:text-4xl">{progress === 100 ? "Your portfolio is taking shape." : "Your story starts here."}</h3><p className="mt-3 max-w-md text-sm leading-6 text-gray-400">Add your background, skills, and projects to create your personal portfolio.</p></div>
                  <div className="mt-6 flex flex-wrap gap-3"><Link to="/create-portfolio" className="rounded-lg bg-[#00D68F] px-4 py-2.5 text-sm font-semibold text-[#041109] hover:bg-[#5AFFB7]">Edit portfolio</Link><Link to="/create-portfolio" className="rounded-lg border border-white/10 px-4 py-2.5 text-sm font-semibold text-gray-200 hover:bg-white/[0.04]">Open editor</Link></div>
                </div>
                <div className="mt-5 rounded-xl border border-white/10 bg-[#0B100D] p-4 sm:p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div><h3 className="font-semibold">Publish your portfolio</h3><p className="mt-1 text-sm text-gray-400">Create a personal link that anyone can open.</p></div>
                    <span className={`rounded-full border px-3 py-1 text-xs ${isPublished ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-300" : "border-white/10 bg-white/5 text-gray-400"}`}>{isPublished ? "Published" : "Not published"}</span>
                  </div>
                  <form onSubmit={handlePublish} className="mt-4 space-y-3">
                    <label className="block text-sm font-medium text-gray-300" htmlFor="portfolio-slug">Your unique link name</label>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <span className="text-xs text-gray-500 sm:whitespace-nowrap">{window.location.origin}/u/</span>
                      <input id="portfolio-slug" value={publishSlug} onChange={(event) => setPublishSlug(event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "").replace(/--+/g, "-").replace(/^-+|-+$/g, ""))} minLength={3} maxLength={40} pattern="[a-z0-9-]+" required disabled={publishing || isPublished} placeholder="your-name" className="min-w-0 flex-1 rounded-lg border border-white/10 bg-[#111713] px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-400" />
                      {!isPublished && <button type="submit" disabled={publishing || publishSlug.trim().length < 3} className="rounded-lg bg-[#00D68F] px-4 py-2.5 text-sm font-bold text-[#041109] disabled:cursor-not-allowed disabled:opacity-50">{publishing ? "Publishing..." : "Publish"}</button>}
                    </div>
                  </form>
                  {isPublished && publishedUrl && <div className="mt-3 flex flex-col gap-2 sm:flex-row"><a href={publishedUrl} target="_blank" rel="noreferrer" className="min-w-0 flex-1 break-all rounded-lg border border-white/10 px-3 py-2.5 text-sm text-[#5AFFB7] hover:bg-white/5">{publishedUrl}</a><button type="button" onClick={handleCopyUrl} className="rounded-lg border border-white/15 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/5">Copy link</button><button type="button" onClick={handleUnpublish} disabled={publishing} className="rounded-lg border border-red-400/20 px-4 py-2.5 text-sm font-semibold text-red-300 hover:bg-red-400/10">{publishing ? "Working..." : "Unpublish"}</button></div>}
                  {publishMessage && <p role="status" className="mt-3 text-sm text-[#8AFFC1]">{publishMessage}</p>}
                </div>
              </div>

              <div className="rounded-2xl border border-white/[0.08] bg-[#101511] p-4 sm:p-6">
                <h2 className="font-bold">Complete your portfolio</h2><p className="mt-2 text-sm leading-6 text-gray-400">Your progress updates based on details saved in browser storage.</p>
                <div className="mt-5 space-y-2">
                  {completion.map((item) => <Link key={item.key} to={item.path} className="group flex items-center gap-3 rounded-xl px-2 py-3 transition hover:bg-white/[0.04]">
                    <span className={`grid size-7 shrink-0 place-items-center rounded-full border text-sm ${item.complete ? "border-emerald-400/40 bg-emerald-400/10 text-[#5AFFB7]" : "border-white/15 text-gray-500"}`}>{item.complete ? "✓" : "○"}</span>
                    <span className="flex-1 text-sm text-gray-200">{item.label}</span><span className={`text-xs ${item.complete ? "text-emerald-300" : "text-gray-500 group-hover:text-emerald-300"}`}>{item.complete ? "Complete" : "Add details"}</span>
                  </Link>)}
                </div>
                <Link to={nextSection.path} className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-[#00D68F] px-4 py-3 font-bold text-[#041109] transition hover:bg-[#5AFFB7]">{completedCount === sections.length ? "Review your portfolio" : `Continue: ${nextSection.label}`} <span>→</span></Link>
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}

export default DashboardPage;
