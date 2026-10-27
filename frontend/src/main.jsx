import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Scatter, ScatterChart,
  Tooltip, XAxis, YAxis,
} from "recharts";
import "./styles.css";

const API = "http://localhost:8000";
const stages = ["Repository connected", "Source files scanned", "Metrics calculated", "Dependency graph built", "PageRank and K-Means complete", "Insights generated"];

function scoreLabel(value) {
  return value >= 80 ? "Excellent" : value >= 65 ? "Good" : value >= 45 ? "Fair" : "Needs attention";
}

function statusClass(value) {
  return String(value || "").toLowerCase().replace(/\s/g, "-");
}

function Icon({ name }) {
  const paths = {
    overview: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z",
    modules: "M4 5h16M4 12h16M4 19h16",
    architecture: "M5 18l6-6 4 4 4-9M5 18h15",
    clusters: "M7 7a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm10 6a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM9 10l6 4",
    recommendations: "M12 3a7 7 0 0 0-4 12c.7.5 1 1.2 1 2h6c0-.8.3-1.5 1-2a7 7 0 0 0-4-12zM9 21h6M10 18h4",
    history: "M12 7v5l3 2M21 12a9 9 0 1 1-3-6.7",
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d={paths[name]} /></svg>;
}

function Button({ children, variant = "primary", ...props }) {
  return <button className={`button ${variant}`} {...props}>{children}</button>;
}

function Badge({ children }) {
  return <span className={`badge ${statusClass(children)}`}>{children}</span>;
}

function ScoreBar({ label, value, description }) {
  return <div className="score-row">
    <div className="score-row-top"><span>{label}</span><strong>{value}</strong></div>
    <div className="progress"><i style={{ width: `${value}%` }} /></div>
    {description && <small>{description}</small>}
  </div>;
}

function EmptyState({ onAnalyze }) {
  return <section className="empty-state"><div className="empty-mark">⌁</div><h1>No repository analyzed yet.</h1><p>Enter a public GitHub repository to understand its quality, architecture, and risk.</p><Button onClick={onAnalyze}>Analyze a repository</Button></section>;
}

function LoadingState({ stage }) {
  return <section className="loading-state"><div className="loading-orbit"><span /></div><p className="eyebrow">ANALYSIS IN PROGRESS</p><h1>Understanding your codebase.</h1><p className="muted">Static analysis only. Repository code is never executed.</p><div className="stage-list">{stages.map((item, index) => <div className={index < stage ? "done" : index === stage ? "active" : ""} key={item}><span>{index < stage ? "✓" : index === stage ? "●" : "○"}</span>{item}</div>)}</div></section>;
}

function Landing({ url, setUrl, onAnalyze, error, loading }) {
  return <section className="landing"><div className="landing-copy"><p className="eyebrow">REPOSITORY INTELLIGENCE FOR BETTER SOFTWARE</p><h1>Understand<br /><em>your codebase.</em></h1><p className="landing-lead">Analyze complexity, quality, testing, and architectural risk in seconds.</p><form onSubmit={onAnalyze}><label htmlFor="repository-url">Public GitHub repository</label><div className="url-input"><span>github.com/</span><input id="repository-url" value={url.replace("https://github.com/", "")} onChange={(event) => setUrl(`https://github.com/${event.target.value}`)} placeholder="owner/repository" /><Button disabled={loading}>{loading ? "Analyzing…" : "Analyze"}</Button></div></form>{error && <div className="error-state"><strong>Unable to access repository.</strong><span>{error}</span></div>}<p className="example">Try a public repository, for example <button type="button" onClick={() => setUrl("https://github.com/psf/requests")}>psf/requests</button></p></div><div className="concepts">{[["01", "Quality", "A clear signal for the health of your codebase."], ["02", "Complexity", "Find code that is hard to change with confidence."], ["03", "Architecture", "See which modules shape your system."], ["04", "Risk", "Focus attention where it matters most."]].map(([number, title, copy]) => <div className="concept" key={title}><span>{number}</span><strong>{title}</strong><p>{copy}</p></div>)}</div></section>;
}

function Overview({ data, onSelect, setPage }) {
  const chart = data.modules.slice(0, 7).map((module) => ({ name: module.file.split("/").pop(), priority: module.priority, risk: module.risk }));
  const attention = data.modules.filter((module) => module.priority >= 40).slice(0, 4);
  const descriptions = { code_quality: "Smells, structure, and maintainability signals.", complexity: "Cyclomatic complexity, function size, and nesting.", documentation: "README, comments, setup, and project metadata.", testing: "Test files, frameworks, and source coverage signals.", maintainability: "A combined view of quality, complexity, and docs." };
  return <><PageHeader eyebrow="OVERVIEW" title={`${data.repository.owner} / ${data.repository.name}`} subtitle={`${data.modules.length} modules analyzed · ${data.excluded_files} files excluded`} action={<Button variant="secondary" onClick={() => setPage("modules")}>Explore modules</Button>} /><section className="quality-hero"><div><p className="eyebrow">REPOSITORY QUALITY</p><div className="quality-score">{data.overall_score}<small>/ 100</small></div><Badge>{scoreLabel(data.overall_score)}</Badge><p className="quality-summary">{data.overall_score >= 65 ? "Your repository is generally healthy, but several modules need attention." : "There are several opportunities to improve quality and reduce engineering risk."}</p></div><div className="quality-bars">{Object.entries(data.dimensions).map(([key, value]) => <ScoreBar key={key} label={key.replace("_", " ")} value={value} description={descriptions[key]} />)}</div></section><div className="section-heading"><div><p className="eyebrow">SIGNATURE SIGNAL</p><h2>Needs attention</h2><p>Modules most likely to benefit from refactoring.</p></div><button className="text-button" onClick={() => setPage("modules")}>View all modules →</button></div><div className="attention-grid">{attention.length ? attention.map((module) => <button className="attention-card" key={module.file} onClick={() => onSelect(module)}><div className="attention-top"><div><strong>{module.file}</strong><small>{module.language} · {module.cluster}</small></div><span className={`priority-number ${statusClass(module.priority_level)}`}>{module.priority}</span></div><div className="attention-meta"><span>Risk <b>{module.risk}</b></span><span>PageRank <b>{module.pagerank_importance}</b></span><span>Complexity <b>{module.complexity}</b></span></div><div className="attention-foot"><Badge>{module.priority_level}</Badge><span>View analysis →</span></div></button>) : <div className="panel quiet">No critical issues found. Your repository currently looks healthy.</div>}</div><div className="two-column"><section className="panel"><div className="panel-heading"><div><h2>Risk and priority</h2><p>Highest-priority modules at a glance.</p></div></div><ResponsiveContainer width="100%" height={250}><BarChart data={chart} layout="vertical" margin={{ left: 10, right: 12 }}><CartesianGrid horizontal={false} stroke="#edf0f4" /><XAxis type="number" domain={[0, 100]} hide /><YAxis dataKey="name" type="category" width={90} tick={{ fontSize: 11, fill: "#718096" }} /><Tooltip cursor={{ fill: "#f7f9fc" }} /><Bar dataKey="priority" name="Priority" fill="#1769e0" radius={[0, 4, 4, 0]} /><Bar dataKey="risk" name="Risk" fill="#d9a441" radius={[0, 4, 4, 0]} /></BarChart></ResponsiveContainer></section><section className="panel"><div className="panel-heading"><div><h2>Methodology</h2><p>How the score is calculated.</p></div></div><div className="formula"><span>Overall quality</span><b>25%</b> quality · <b>20%</b> complexity · <b>15%</b> documentation · <b>20%</b> testing · <b>20%</b> maintainability</div><div className="formula"><span>Module priority</span><b>40%</b> risk · <b>40%</b> PageRank importance · <b>20%</b> complexity risk</div><button className="text-button" onClick={() => setPage("architecture")}>Explore architecture →</button></section></div></>;
}

function PageHeader({ eyebrow, title, subtitle, action }) {
  return <div className="page-header"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1>{subtitle && <p className="muted">{subtitle}</p>}</div>{action}</div>;
}

function Modules({ data, onSelect }) {
  const [query, setQuery] = useState(""); const [filter, setFilter] = useState("All"); const [sort, setSort] = useState("priority");
  const filtered = useMemo(() => data.modules.filter((module) => `${module.file} ${module.language}`.toLowerCase().includes(query.toLowerCase()) && (filter === "All" || module.priority_level === filter || module.cluster === filter || module.language === filter)).sort((a, b) => b[sort] - a[sort]), [data.modules, filter, query, sort]);
  return <><PageHeader eyebrow="MODULES" title="Module explorer" subtitle={`${filtered.length} of ${data.modules.length} modules`} /><section className="panel module-panel"><div className="module-toolbar"><input className="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search files…" aria-label="Search modules" /><div className="filters">{["All", "Critical", "High", "Risky", "Healthy", "Python", "JavaScript", "TypeScript"].map((item) => <button className={filter === item ? "selected" : ""} key={item} onClick={() => setFilter(item)}>{item}</button>)}</div><label className="sort">Sort <select value={sort} onChange={(event) => setSort(event.target.value)}><option value="priority">Priority</option><option value="risk">Risk</option><option value="complexity">Complexity</option><option value="loc">LOC</option><option value="pagerank_importance">PageRank</option></select></label></div><div className="table-scroll"><table><thead><tr>{["File", "Language", "LOC", "Complexity", "Risk", "PageRank", "Cluster", "Priority"].map((heading) => <th key={heading}>{heading}</th>)}</tr></thead><tbody>{filtered.map((module) => <tr key={module.file} onClick={() => onSelect(module)} tabIndex="0" onKeyDown={(event) => event.key === "Enter" && onSelect(module)}><td><strong>{module.file}</strong></td><td>{module.language}</td><td>{module.loc}</td><td>{module.complexity}</td><td>{module.risk}</td><td>{module.pagerank}</td><td><Badge>{module.cluster}</Badge></td><td><strong className={statusClass(module.priority_level)}>{module.priority}</strong></td></tr>)}</tbody></table>{!filtered.length && <div className="table-empty">No modules match these filters.</div>}</div></section></>;
}

function Architecture({ data, onSelect }) {
  const nodes = data.modules.slice().sort((a, b) => b.pagerank - a.pagerank).slice(0, 30);
  const nodeMap = Object.fromEntries(nodes.map((node, index) => [node.file, { ...node, x: 70 + (index % 5) * 145, y: 58 + Math.floor(index / 5) * 78 }]));
  const edges = data.dependencies.filter((edge) => nodeMap[edge.source] && nodeMap[edge.target]);
  return <><PageHeader eyebrow="ARCHITECTURE" title="Structural importance" subtitle="Explore how modules depend on one another. Showing the top 30 modules by PageRank." /><div className="architecture-layout"><section className="panel graph-panel"><div className="panel-heading"><div><h2>Dependency graph</h2><p>Higher PageRank modules are larger and more prominent.</p></div></div><div className="graph"><svg viewBox="0 0 700 560" role="img" aria-label="Module dependency graph">{edges.map((edge) => <line key={`${edge.source}-${edge.target}`} x1={nodeMap[edge.source].x} y1={nodeMap[edge.source].y} x2={nodeMap[edge.target].x} y2={nodeMap[edge.target].y} />)}{nodes.map((node) => <g className="graph-node" key={node.file} onClick={() => onSelect(node)}><circle cx={nodeMap[node.file].x} cy={nodeMap[node.file].y} r={Math.max(7, 7 + node.pagerank_importance / 13)} /><text x={nodeMap[node.file].x} y={nodeMap[node.file].y + 24} textAnchor="middle">{node.file.split("/").pop().slice(0, 18)}</text></g>)}</svg></div></section><section className="panel ranking-panel"><div className="panel-heading"><div><h2>Architectural importance</h2><p>PageRank identifies structurally important modules.</p></div></div>{nodes.slice(0, 8).map((node, index) => <button className="ranking-row" key={node.file} onClick={() => onSelect(node)}><span>{String(index + 1).padStart(2, "0")}</span><strong>{node.file}</strong><b>{node.pagerank}</b></button>)}</section></div></>;
}

function Clusters({ data, onSelect }) {
  const points = data.modules.map((module) => ({ ...module, x: module.complexity, y: module.risk }));
  const counts = ["Healthy", "Moderate", "Risky"].map((name) => [name, data.modules.filter((module) => module.cluster === name).length]);
  return <><PageHeader eyebrow="MODULE HEALTH MAP" title="Patterns in your codebase" subtitle="Modules grouped by similarity in software-quality characteristics." /><section className="panel chart-panel"><ResponsiveContainer width="100%" height={420}><ScatterChart margin={{ top: 20, right: 30, bottom: 20, left: 10 }}><CartesianGrid stroke="#edf0f4" /><XAxis type="number" dataKey="x" name="Complexity" tick={{ fill: "#718096", fontSize: 12 }} /><YAxis type="number" dataKey="y" name="Risk" tick={{ fill: "#718096", fontSize: 12 }} /><Tooltip cursor={{ strokeDasharray: "3 3" }} content={({ active, payload }) => active && payload?.length ? <div className="chart-tooltip"><strong>{payload[0].payload.file}</strong><span>Risk {payload[0].payload.risk} · Complexity {payload[0].payload.complexity}</span><span>{payload[0].payload.cluster} · Priority {payload[0].payload.priority}</span></div> : null} /><Scatter name="Modules" data={points} fill="#1769e0" onClick={(point) => onSelect(point)} /></ScatterChart></ResponsiveContainer></section><div className="cluster-summary">{counts.map(([name, count]) => <div className="cluster-card" key={name}><span className={`dot ${statusClass(name)}`} /><strong>{name}</strong><b>{count}</b><small>modules</small></div>)}</div></>;
}

function Recommendations({ data, onSelect }) {
  const groups = ["Critical", "High", "Medium", "Low"].map((level) => [level, data.recommendations.filter((recommendation) => data.modules.find((module) => module.file === recommendation.file)?.priority_level === level)]);
  return <><PageHeader eyebrow="RECOMMENDATIONS" title="Actionable next steps" subtitle="Generated from the metrics and relationships found in this analysis." /><div className="recommendation-list">{groups.map(([level, items]) => items.length ? <section key={level}><div className="section-heading compact"><div><Badge>{level}</Badge><p>{level === "Critical" ? "Risk and architectural importance are both elevated." : "A focused improvement opportunity."}</p></div></div>{items.map((item) => <button className="recommendation" key={item.file} onClick={() => onSelect(data.modules.find((module) => module.file === item.file))}><strong>{item.file}</strong><span>{item.message}</span><b>→</b></button>)}</section> : null)}{!data.recommendations.length && <div className="panel quiet">No critical issues found. Your repository currently looks healthy.</div>}</div></>;
}

function ModuleDetail({ module, onClose }) {
  if (!module) return null;
  return <div className="drawer-backdrop" onClick={onClose}><aside className="drawer" onClick={(event) => event.stopPropagation()}><button className="close" onClick={onClose} aria-label="Close module details">×</button><p className="eyebrow">MODULE DETAIL</p><h2>{module.file}</h2><p className="muted">{module.language} · {module.cluster}</p><div className="drawer-score"><span>Priority</span><strong>{module.priority}</strong><Badge>{module.priority_level}</Badge></div><div className="drawer-metrics"><span>Risk <b>{module.risk}</b></span><span>PageRank <b>{module.pagerank_importance}</b></span><span>Complexity <b>{module.complexity}</b></span><span>LOC <b>{module.loc}</b></span></div><h3>Why this module needs attention</h3><ul>{module.complexity > 10 && <li>High cyclomatic complexity and difficult-to-change logic.</li>}{module.smells > 0 && <li>Detected {module.smells} basic code smell{module.smells > 1 ? "s" : ""}.</li>}{module.documentation_score < 20 && <li>Limited inline documentation.</li>}{module.pagerank_importance >= 60 && <li>High architectural importance within the dependency graph.</li>}{module.risk < 40 && module.pagerank_importance < 60 && <li>No major risk signal was detected.</li>}</ul><h3>Recommended action</h3><p className="drawer-recommendation">{module.priority_level === "Critical" ? "Prioritize this module for refactoring because it is both risky and architecturally important." : module.complexity > 10 ? "Break complex logic into smaller functions and add targeted tests." : "Keep this module under review as the repository evolves."}</p></aside></div>;
}

function App() {
  const [url, setUrl] = useState("https://github.com/"); const [data, setData] = useState(null); const [error, setError] = useState(""); const [loading, setLoading] = useState(false); const [stage, setStage] = useState(0); const [page, setPage] = useState("overview"); const [selected, setSelected] = useState(null); const [history, setHistory] = useState(() => JSON.parse(localStorage.getItem("gitquality-history") || "[]"));
  useEffect(() => { if (!loading) return undefined; const timer = setInterval(() => setStage((current) => Math.min(current + 1, stages.length - 1)), 650); return () => clearInterval(timer); }, [loading]);
  async function analyze(event) {
    event?.preventDefault(); setLoading(true); setError(""); setData(null); setStage(0);
    try { const response = await fetch(`${API}/api/analyze`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ repository_url: url }) }); const body = await response.json(); if (!response.ok) throw new Error(body.detail || "Analysis failed."); const result = await fetch(`${API}/api/analysis/${body.analysis_id}`); const payload = await result.json(); setData(payload); setPage("overview"); const entry = { id: payload.id, repository: `${payload.repository.owner}/${payload.repository.name}`, date: new Date().toISOString(), score: payload.overall_score, modules: payload.modules.length, payload }; const next = [entry, ...history.filter((item) => item.repository !== entry.repository)].slice(0, 10); setHistory(next); localStorage.setItem("gitquality-history", JSON.stringify(next)); } catch (caught) { setError(caught.message); } finally { setLoading(false); }
  }
  if (loading) return <main className="public-shell"><LoadingState stage={stage} /></main>;
  if (!data) return <main className="public-shell"><header className="public-header"><div className="brand">Git<span>Quality</span></div><span>Repository intelligence for better software</span></header><Landing {...{ url, setUrl, onAnalyze: analyze, error, loading }} /></main>;
  const nav = [["overview", "Overview"], ["modules", "Modules"], ["architecture", "Architecture"], ["clusters", "Health map"], ["recommendations", "Recommendations"], ["history", "History"]];
  return <><div className="app-shell"><aside className="sidebar"><div className="brand">Git<span>Quality</span></div><div className="repo-switcher"><span className="repo-dot" /><div><strong>{data.repository.name}</strong><small>{data.repository.owner}</small></div></div><nav>{nav.map(([key, label]) => <button className={page === key ? "active" : ""} onClick={() => setPage(key)} key={key}><Icon name={key} />{label}{key === "recommendations" && data.recommendations.length > 0 && <i>{data.recommendations.length}</i>}</button>)}</nav><div className="sidebar-bottom"><button onClick={() => setData(null)}><span>＋</span> New analysis</button><small>Real repository data<br />No code execution</small></div></aside><main className="app-content"><div className="mobile-top"><div className="brand">Git<span>Quality</span></div><button onClick={() => setPage(page === "overview" ? "modules" : "overview")}>☰</button></div>{page === "overview" && <Overview data={data} onSelect={setSelected} setPage={setPage} />}{page === "modules" && <Modules data={data} onSelect={setSelected} />}{page === "architecture" && <Architecture data={data} onSelect={setSelected} />}{page === "clusters" && <Clusters data={data} onSelect={setSelected} />}{page === "recommendations" && <Recommendations data={data} onSelect={setSelected} />}{page === "history" && <History entries={history} onOpen={(entry) => { setData(entry.payload); setPage("overview"); }} />}</main></div><ModuleDetail module={selected} onClose={() => setSelected(null)} /></>;
}

function History({ entries, onOpen }) {
  return <><PageHeader eyebrow="HISTORY" title="Previous analyses" subtitle="Your recent repository quality reports, stored locally in this browser." />{entries.length ? <div className="history-list">{entries.map((entry) => <button className="history-row" key={entry.id} onClick={() => onOpen(entry)}><div><strong>{entry.repository}</strong><small>{new Date(entry.date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })} · {entry.modules} modules</small></div><b>{entry.score}<small>/ 100</small></b><span>Open report →</span></button>)}</div> : <div className="panel quiet">No analysis history yet. Run an analysis to see it here.</div>}</>;
}

createRoot(document.getElementById("root")).render(<App />);
