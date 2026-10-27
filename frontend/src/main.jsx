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

function Settings({ theme, setTheme, density, setDensity }) {
  return <><PageHeader eyebrow="SETTINGS" title="Preferences" subtitle="Tune GitQuality to match your workflow." /><div className="settings-list"><section className="settings-row"><div><strong>Appearance</strong><small>Choose the interface theme.</small></div><ThemeControl theme={theme} setTheme={setTheme} /></section><section className="settings-row"><div><strong>Interface density</strong><small>Control how much information fits on screen.</small></div><div className="segmented">{["comfortable", "compact"].map((item) => <button className={density === item ? "selected" : ""} key={item} onClick={() => setDensity(item)}>{item[0].toUpperCase() + item.slice(1)}</button>)}</div></section><section className="settings-row"><div><strong>Keyboard shortcuts</strong><small>⌘ K command palette · ⌘ 1–5 navigation · Esc close dialogs</small></div><kbd>⌘ K</kbd></section><section className="settings-row"><div><strong>Data handling</strong><small>Repositories are analyzed temporarily. History is stored locally in this browser.</small></div></section></div></>;
}

function statusClass(value) {
  return String(value || "").toLowerCase().replace(/\s/g, "-");
}

function healthLabel(module) {
  if (module.priority_level === "Critical") return "Critical";
  if (module.risk >= 60 || module.cluster === "Risky") return "High Risk";
  if (module.risk >= 30 || module.cluster === "Moderate") return "Moderate";
  return "Healthy";
}

function InfoTip({ text }) {
  return <span className="info-tip" title={text} aria-label={text}>i</span>;
}

function Logo() {
  return <div className="brand"><span className="brand-mark">◈</span> Git<span>Quality</span></div>;
}

function ThemeControl({ theme, setTheme }) {
  return <label className="theme-control" title="Choose theme"><span>{theme === "dark" ? "☾" : theme === "light" ? "☀" : "◐"}</span><select value={theme} onChange={(event) => setTheme(event.target.value)} aria-label="Theme"><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select></label>;
}

function CommandPalette({ onClose, setPage, setTheme, onNewAnalysis, modules }) {
  const [query, setQuery] = useState("");
  const actions = [
    ["Navigation", [["Open Overview", () => setPage("overview")], ["Search Modules", () => setPage("modules")], ["Open Architecture", () => setPage("architecture")], ["Open Health Map", () => setPage("clusters")], ["Open Insights", () => setPage("insights")], ["Open Recommendations", () => setPage("recommendations")], ["Open History", () => setPage("history")], ["Open Settings", () => setPage("settings")]]],
    ["Repository", [["Analyze New Repository", onNewAnalysis]]],
    ["Appearance", [["Light Mode", () => setTheme("light")], ["Dark Mode", () => setTheme("dark")], ["System Mode", () => setTheme("system")]]],
  ];
  const moduleMatches = modules.filter((module) => module.file.toLowerCase().includes(query.toLowerCase())).slice(0, 5);
  const results = query ? [["Search results", moduleMatches.map((module) => [`Open ${module.file}`, () => setPage("modules")])]] : actions;
  return <div className="modal-backdrop command-backdrop" onClick={onClose}><section className="command-palette" role="dialog" aria-modal="true" aria-label="Command palette" onClick={(event) => event.stopPropagation()}><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search GitQuality…" aria-label="Search GitQuality" /><div className="command-results">{results.map(([category, items]) => <React.Fragment key={category}><small className="command-category">{category}</small>{items.map(([label, action]) => <button key={label} onClick={() => { action(); onClose(); }}><span>→</span>{label}</button>)}</React.Fragment>)}{query && !moduleMatches.length && <small>No modules found.</small>}</div><footer><kbd>esc</kbd> close <kbd>↵</kbd> select</footer></section></div>;
}

function Icon({ name }) {
  const paths = {
    overview: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z",
    modules: "M4 5h16M4 12h16M4 19h16",
    architecture: "M5 18l6-6 4 4 4-9M5 18h15",
    clusters: "M7 7a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm10 6a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM9 10l6 4",
    recommendations: "M12 3a7 7 0 0 0-4 12c.7.5 1 1.2 1 2h6c0-.8.3-1.5 1-2a7 7 0 0 0-4-12zM9 21h6M10 18h4",
    history: "M12 7v5l3 2M21 12a9 9 0 1 1-3-6.7",
    settings: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm0-5v2m0 14v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M3 12h2m14 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4",
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

function ChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const module = payload[0].payload;
  return <div className="chart-tooltip">
    <strong>{module.file}</strong>
    <span>Priority <b>{module.priority}</b></span>
    <span>Risk <b>{module.risk}</b></span>
    <span>PageRank <b>{module.pagerank}</b></span>
    <span>Complexity <b>{module.complexity}</b></span>
    <span>Status: <b>{module.status}</b></span>
  </div>;
}

function MethodologyModal({ onClose }) {
  return <div className="modal-backdrop" onClick={onClose}><section className="methodology-modal" role="dialog" aria-modal="true" aria-labelledby="methodology-title" onClick={(event) => event.stopPropagation()}>
    <button className="close" onClick={onClose} aria-label="Close methodology">×</button>
    <p className="eyebrow">METHODOLOGY</p><h2 id="methodology-title">How scores are calculated</h2>
    <p className="modal-intro">Every value is derived deterministically from the repository contents. No scores or module results are fabricated.</p>
    <h3>Overall quality</h3><div className="modal-formula"><span>25%</span> Code Quality <span>20%</span> Complexity <span>15%</span> Documentation <span>20%</span> Testing <span>20%</span> Maintainability</div>
    <h3>Module priority</h3><div className="modal-formula"><span>40%</span> Risk <span>40%</span> PageRank importance <span>20%</span> Complexity risk</div>
    <h3>Terms</h3><p className="modal-copy"><b>Risk</b> measures how problematic a module is. <b>PageRank</b> measures architectural importance within the dependency graph. <b>Priority</b> combines both with complexity to identify what should be reviewed first.</p>
  </section></div>;
}

function RecommendedActions({ data, onSelect }) {
  const recommendations = data.recommendations.slice(0, 3);
  return <section className="recommendations-section"><div className="section-heading compact"><div><p className="eyebrow">NEXT STEPS</p><h2>Recommended actions</h2><p>Practical improvements generated from this analysis.</p></div></div>{recommendations.length ? <div className="recommendation-cards">{recommendations.map((recommendation, index) => {
    const module = data.modules.find((item) => item.file === recommendation.file);
    return <button className="recommendation-card" key={recommendation.file} onClick={() => onSelect(module)}>
      <span className="recommendation-index">{index + 1}</span><div><strong>{recommendation.file}</strong><p>{recommendation.message}</p><small><b>Suggested action:</b> {module?.complexity > 10 ? "Break complex logic into smaller functions and add automated tests." : module?.documentation_score < 20 ? "Add function and class documentation." : "Review this module before making cross-cutting changes."}</small></div><b className="recommendation-arrow">→</b>
    </button>;
  })}</div> : <div className="panel quiet">No critical issues found. Your repository currently looks healthy.</div>}</section>;
}

function RepositoryInsights({ data, onSelect }) {
  const top = data.modules[0];
  const insights = [];
  if (top && top.risk >= 60 && top.pagerank_importance >= 60) insights.push(["High-impact risk detected", `${top.file} has high architectural importance and elevated risk.`, top]);
  if (data.testing.test_files === 0 || data.testing.test_source_ratio < 0.3) insights.push(["Testing opportunity", "Several important modules have relatively low testing signals.", data.modules.find((module) => module.pagerank_importance >= 60)]);
  if (data.dimensions.documentation < data.dimensions.code_quality) insights.push(["Documentation gap", "Documentation quality is lower than the repository's code quality score.", null]);
  if (data.dimensions.complexity < 50) insights.push(["Complexity is the constraint", "Complexity is currently the lowest quality dimension and should guide refactoring.", null]);
  return <section className="insights-section"><div className="section-heading compact"><div><p className="eyebrow">SIGNALS FROM YOUR ANALYSIS</p><h2>Repository insights</h2><p>Automatically generated from the repository metrics.</p></div></div><div className="insight-grid">{insights.slice(0, 4).map(([title, copy, module]) => <button className="insight-card" key={title} onClick={() => module && onSelect(module)}><span className="insight-spark">✦</span><div><strong>{title}</strong><p>{copy}</p></div><span className="recommendation-arrow">→</span></button>)}</div></section>;
}

function InsightsPage({ data, onSelect }) {
  return <><PageHeader eyebrow="INSIGHTS" title="Repository insights" subtitle="Signals generated from the metrics and relationships found in this analysis." /><RepositoryInsights data={data} onSelect={onSelect} /></>;
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
  const [showMethodology, setShowMethodology] = useState(false);
  const chart = data.modules.slice().sort((a, b) => b.priority - a.priority).slice(0, 7).map((module) => ({ file: module.file, name: module.file.split("/").pop(), priority: module.priority, risk: module.risk, pagerank: module.pagerank_importance, complexity: module.complexity, status: healthLabel(module) }));
  const attention = data.modules.filter((module) => module.priority >= 40).slice(0, 4);
  const statistics = { "Files analyzed": data.modules.length, "Lines of code": data.modules.reduce((total, module) => total + module.loc, 0).toLocaleString(), Languages: new Set(data.modules.map((module) => module.language)).size, "Test files": data.testing.test_files };
  const descriptions = { code_quality: "Smells, structure, and maintainability signals.", complexity: "Cyclomatic complexity, function size, and nesting.", documentation: "README, comments, setup, and project metadata.", testing: "Test files, frameworks, and source coverage signals.", maintainability: "A combined view of quality, complexity, and docs." };
  const insight = chart[0];
  return <>{showMethodology && <MethodologyModal onClose={() => setShowMethodology(false)} />}<PageHeader eyebrow="OVERVIEW" title={`${data.repository.owner} / ${data.repository.name}`} subtitle="Analysis complete · Last analyzed just now" action={<Button variant="secondary" onClick={() => setPage("modules")}>Explore modules</Button>} /><section className="quality-hero"><div><p className="eyebrow">REPOSITORY HEALTH</p><div className="quality-score">{data.overall_score}<small>/ 100</small></div><Badge>{scoreLabel(data.overall_score)}</Badge><p className="quality-summary">{data.overall_score >= 65 ? `Your repository is generally healthy, but ${attention.length} modules need attention.` : "There are several opportunities to improve quality and reduce engineering risk."}</p></div><div className="quality-bars">{Object.entries(data.dimensions).map(([key, value]) => <ScoreBar key={key} label={key.replace("_", " ")} value={value} description={descriptions[key]} />)}</div></section><section className="stats-strip">{Object.entries(statistics).map(([label, value]) => <div key={label}><strong>{value}</strong><span>{label}</span></div>)}<div><strong>{data.dependencies.length}</strong><span>Dependencies</span></div></section><div className="section-heading"><div><p className="eyebrow">SIGNATURE SIGNAL</p><h2>Needs attention</h2><p>The modules most likely to benefit from refactoring.</p></div><button className="text-button" onClick={() => setPage("modules")}>View all modules →</button></div><div className="attention-grid">{attention.length ? attention.map((module) => <button className="attention-card" key={module.file} onClick={() => onSelect(module)}><div className="attention-top"><div><strong>{module.file}</strong><small>{module.language} · {healthLabel(module)}</small></div><span className={`priority-number ${statusClass(module.priority_level)}`}>{module.priority}</span></div><div className="attention-meta"><span>Risk <b>{module.risk}</b></span><span>PageRank <b>{module.pagerank_importance}</b></span><span>Complexity <b>{module.complexity}</b></span></div><div className="attention-foot"><Badge>{healthLabel(module)}</Badge><span>View analysis →</span></div></button>) : <div className="panel quiet">No critical issues found. Your repository currently looks healthy.</div>}</div><div className="two-column"><section className="panel chart-panel"><div className="panel-heading"><div><h2>Modules that need attention <InfoTip text="Priority combines module risk, architectural importance (PageRank), and complexity." /></h2><p>Highest-priority modules based on risk, architectural importance, and complexity.</p></div></div><div className="chart-explainer">Priority combines module risk, architectural importance (PageRank), and complexity to determine which modules should be reviewed first.</div><div className="chart-legend"><span><i className="legend-priority" /> Priority</span><span><i className="legend-risk" /> Risk</span></div><ResponsiveContainer width="100%" height={310}><BarChart data={chart} layout="vertical" margin={{ left: 10, right: 24 }}>  <CartesianGrid horizontal={false} stroke="var(--chart-grid)" /><XAxis type="number" domain={[0, 100]} hide /><YAxis dataKey="name" type="category" width={105} tick={{ fontSize: 11, fill: "var(--chart-label)" }} /><Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--chart-hover)" }} /><Bar dataKey="priority" name="Priority" fill="var(--accent)" radius={[0, 4, 4, 0]} /><Bar dataKey="risk" name="Risk" fill="var(--warning)" radius={[0, 4, 4, 0]} /></BarChart></ResponsiveContainer><button className="text-button" onClick={() => setPage("modules")}>View all modules →</button></section><section className="side-insights"><section className="panel key-insight"><p className="eyebrow">KEY INSIGHT</p><h2>{insight?.file || "No priority modules"}</h2><p>currently has the highest priority score.</p><h4>Why?</h4><p>High risk combined with elevated complexity.</p><h4>Recommended action</h4><button className="text-button" onClick={() => insight && onSelect(data.modules.find((module) => module.file === insight.file))}>Review and refactor complex logic →</button></section><section className="panel methodology-card"><div className="panel-heading"><div><h2>How scores are calculated</h2><p>A transparent scoring model.</p></div></div><div className="formula"><span>Overall Quality</span><b>25%</b> Code Quality · <b>20%</b> Complexity · <b>15%</b> Documentation · <b>20%</b> Testing · <b>20%</b> Maintainability</div><div className="formula"><span>Module Priority</span><b>40%</b> Risk · <b>40%</b> PageRank Importance · <b>20%</b> Complexity Risk</div><button className="text-button" onClick={() => setShowMethodology(true)}>Learn how it works →</button></section></section></div><RecommendedActions data={data} onSelect={onSelect} /><RepositoryInsights data={data} onSelect={onSelect} /></>;
}

function PageHeader({ eyebrow, title, subtitle, action }) {
  return <div className="page-header"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1>{subtitle && <p className="muted">{subtitle}</p>}</div>{action}</div>;
}

function Modules({ data, onSelect }) {
  const [query, setQuery] = useState(""); const [filter, setFilter] = useState("All"); const [sort, setSort] = useState("priority");
  const filtered = useMemo(() => data.modules.filter((module) => `${module.file} ${module.language}`.toLowerCase().includes(query.toLowerCase()) && (filter === "All" || healthLabel(module) === filter || module.language === filter)).sort((a, b) => b[sort] - a[sort]), [data.modules, filter, query, sort]);
  return <><PageHeader eyebrow="MODULES" title="Module explorer" subtitle={`${filtered.length} of ${data.modules.length} modules`} /><section className="panel module-panel"><div className="module-toolbar"><input className="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search files…" aria-label="Search modules" /><div className="filters">{["All", "Critical", "High Risk", "Moderate", "Healthy", "Python", "JavaScript", "TypeScript"].map((item) => <button className={filter === item ? "selected" : ""} key={item} onClick={() => setFilter(item)}>{item}</button>)}</div><label className="sort">Sort <select value={sort} onChange={(event) => setSort(event.target.value)}><option value="priority">Priority</option><option value="risk">Risk</option><option value="complexity">Complexity</option><option value="loc">LOC</option><option value="pagerank_importance">PageRank</option></select></label></div><div className="table-scroll"><table><thead><tr>{["File", "Language", "LOC", "Complexity", "Risk", "PageRank", "Health", "Priority"].map((heading) => <th key={heading}>{heading}</th>)}</tr></thead><tbody>{filtered.map((module) => <tr key={module.file} onClick={() => onSelect(module)} tabIndex="0" onKeyDown={(event) => event.key === "Enter" && onSelect(module)}><td><strong>{module.file}</strong></td><td>{module.language}</td><td>{module.loc}</td><td>{module.complexity}</td><td>{module.risk}</td><td>{module.pagerank}</td><td><Badge>{healthLabel(module)}</Badge></td><td><strong className={statusClass(module.priority_level)}>{module.priority}</strong></td></tr>)}</tbody></table>{!filtered.length && <div className="table-empty">No modules match these filters.</div>}</div></section></>;
}

function Architecture({ data, onSelect }) {
  const nodes = data.modules.slice().sort((a, b) => b.pagerank - a.pagerank).slice(0, 30);
  const nodeMap = Object.fromEntries(nodes.map((node, index) => [node.file, { ...node, x: 70 + (index % 5) * 145, y: 58 + Math.floor(index / 5) * 78 }]));
  const edges = data.dependencies.filter((edge) => nodeMap[edge.source] && nodeMap[edge.target]);
  return <><PageHeader eyebrow="ARCHITECTURE" title="Structural importance" subtitle="Explore how modules depend on one another. Showing the top 30 modules by PageRank." /><div className="architecture-layout"><section className="panel graph-panel"><div className="panel-heading"><div><h2>Dependency graph</h2><p>Higher PageRank modules are larger and more prominent.</p></div><div className="graph-tools"><button>＋</button><button>−</button><button>Fit</button><button>Reset</button></div></div><div className="graph"><svg viewBox="0 0 700 560" role="img" aria-label="Module dependency graph">{edges.map((edge) => <line key={`${edge.source}-${edge.target}`} x1={nodeMap[edge.source].x} y1={nodeMap[edge.source].y} x2={nodeMap[edge.target].x} y2={nodeMap[edge.target].y} />)}{nodes.map((node) => <g className="graph-node" key={node.file} onClick={() => onSelect(node)}><circle cx={nodeMap[node.file].x} cy={nodeMap[node.file].y} r={Math.max(7, 7 + node.pagerank_importance / 13)} /><text x={nodeMap[node.file].x} y={nodeMap[node.file].y + 24} textAnchor="middle">{node.file.split("/").pop().slice(0, 18)}</text></g>)}</svg></div></section><section className="panel ranking-panel"><div className="panel-heading"><div><h2>Architectural importance</h2><p>PageRank identifies modules that are highly connected or influential within the repository's dependency structure.</p></div></div>{nodes.slice(0, 8).map((node, index) => <button className="ranking-row" key={node.file} onClick={() => onSelect(node)}><span>{String(index + 1).padStart(2, "0")}</span><strong>{node.file}</strong><b>{node.pagerank}</b></button>)}</section></div></>;
}

function Clusters({ data, onSelect }) {
  const points = data.modules.map((module) => ({ ...module, x: module.complexity, y: module.risk }));
  const counts = ["Healthy", "Moderate", "High Risk"].map((name) => [name, data.modules.filter((module) => healthLabel(module) === name).length]);
  return <><PageHeader eyebrow="MODULE HEALTH MAP" title="Patterns in your codebase" subtitle="K-Means groups modules with similar software-quality characteristics." /><section className="panel chart-panel"><p className="chart-explainer">K-Means groups modules based on similarities in their software metrics.</p><ResponsiveContainer width="100%" height={420}><ScatterChart margin={{ top: 20, right: 30, bottom: 20, left: 10 }}>  <CartesianGrid stroke="var(--chart-grid)" /><XAxis type="number" dataKey="x" name="Complexity" tick={{ fill: "var(--chart-label)", fontSize: 12 }} /><YAxis type="number" dataKey="y" name="Risk" tick={{ fill: "var(--chart-label)", fontSize: 12 }} /><Tooltip cursor={{ strokeDasharray: "3 3" }} content={({ active, payload }) => active && payload?.length ? <div className="chart-tooltip"><strong>{payload[0].payload.file}</strong><span>Risk {payload[0].payload.risk} · Complexity {payload[0].payload.complexity}</span><span>{healthLabel(payload[0].payload)} · Priority {payload[0].payload.priority}</span></div> : null} />  <Scatter name="Modules" data={points} fill="var(--accent)" onClick={(point) => onSelect(point)} /></ScatterChart></ResponsiveContainer></section><div className="cluster-summary">{counts.map(([name, count]) => <div className="cluster-card" key={name}><span className={`dot ${statusClass(name)}`} /><strong>{name}</strong><b>{count}</b><small>modules</small></div>)}</div></>;
}

function Recommendations({ data, onSelect }) {
  const groups = ["Critical", "High", "Medium", "Low"].map((level) => [level, data.recommendations.filter((recommendation) => data.modules.find((module) => module.file === recommendation.file)?.priority_level === level)]);
  return <><PageHeader eyebrow="RECOMMENDATIONS" title="Actionable next steps" subtitle="Generated from the metrics and relationships found in this analysis." /><div className="recommendation-list">{groups.map(([level, items]) => items.length ? <section key={level}><div className="section-heading compact"><div><Badge>{level}</Badge><p>{level === "Critical" ? "Risk and architectural importance are both elevated." : "A focused improvement opportunity."}</p></div></div>{items.map((item) => <button className="recommendation" key={item.file} onClick={() => onSelect(data.modules.find((module) => module.file === item.file))}><strong>{item.file}</strong><span>{item.message}</span><b>→</b></button>)}</section> : null)}{!data.recommendations.length && <div className="panel quiet">No critical issues found. Your repository currently looks healthy.</div>}</div></>;
}

function ModuleDetail({ module, onClose }) {
  if (!module) return null;
  return <div className="drawer-backdrop" onClick={onClose}><aside className="drawer" onClick={(event) => event.stopPropagation()}><button className="close" onClick={onClose} aria-label="Close module details">×</button><p className="eyebrow">MODULE DETAIL</p><h2>{module.file}</h2><p className="muted">{module.language} · {healthLabel(module)}</p><div className="drawer-score"><span>Priority</span><strong>{module.priority}</strong><Badge>{healthLabel(module)}</Badge></div><div className="drawer-metrics"><span>Risk <b>{module.risk}</b><small>How problematic</small></span><span>PageRank <b>{module.pagerank_importance}</b><small>Architectural importance</small></span><span>Complexity <b>{module.complexity}</b><small>Independent paths</small></span><span>LOC <b>{module.loc}</b><small>Lines of code</small></span></div><h3>Why was this flagged?</h3><ul>{module.complexity > 10 && <li>High cyclomatic complexity and difficult-to-change logic.</li>}{module.smells > 0 && <li>Detected {module.smells} basic code smell{module.smells > 1 ? "s" : ""}.</li>}{module.documentation_score < 20 && <li>Limited inline documentation.</li>}{module.pagerank_importance >= 60 && <li>High architectural importance within the dependency graph.</li>}{module.risk < 40 && module.pagerank_importance < 60 && <li>No major risk signal was detected.</li>}</ul><h3>Recommended action</h3><p className="drawer-recommendation">{module.priority_level === "Critical" ? "Prioritize this module for refactoring because it is both risky and architecturally important." : module.complexity > 10 ? "Break complex logic into smaller functions and add targeted tests." : "Keep this module under review as the repository evolves."}</p><div className="drawer-actions"><button onClick={() => navigator.clipboard?.writeText(module.file)}>Copy module path</button><button onClick={onClose}>View dependencies →</button><button onClick={onClose}>View recommendations →</button></div></aside></div>;
}

function App() {
  const [url, setUrl] = useState("https://github.com/"); const [data, setData] = useState(null); const [error, setError] = useState(""); const [loading, setLoading] = useState(false); const [stage, setStage] = useState(0); const [page, setPage] = useState("overview"); const [selected, setSelected] = useState(null); const [palette, setPalette] = useState(false); const [collapsed, setCollapsed] = useState(false); const [history, setHistory] = useState(() => JSON.parse(localStorage.getItem("gitquality-history") || "[]")); const [theme, setTheme] = useState(() => localStorage.getItem("gitquality-theme") || "dark"); const [density, setDensity] = useState(() => localStorage.getItem("gitquality-density") || "comfortable");
  useEffect(() => { if (!loading) return undefined; const timer = setInterval(() => setStage((current) => Math.min(current + 1, stages.length - 1)), 650); return () => clearInterval(timer); }, [loading]);
  useEffect(() => { localStorage.setItem("gitquality-theme", theme); const dark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches); document.documentElement.dataset.theme = dark ? "dark" : "light"; }, [theme]);
  useEffect(() => { localStorage.setItem("gitquality-density", density); document.documentElement.dataset.density = density; }, [density]);
  useEffect(() => { const onKey = (event) => { const modifier = event.metaKey || event.ctrlKey; if (modifier && event.key.toLowerCase() === "k") { event.preventDefault(); setPalette(true); } if (modifier && ["1", "2", "3", "4", "5", "6"].includes(event.key)) { event.preventDefault(); setPage(["overview", "modules", "architecture", "clusters", "insights", "recommendations"][Number(event.key) - 1]); } if (modifier && event.key === ",") { event.preventDefault(); setPage("settings"); } if (event.key === "Escape") setPalette(false); }; window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey); }, []);
  async function analyze(event) {
    event?.preventDefault(); setLoading(true); setError(""); setData(null); setStage(0);
    try { const response = await fetch(`${API}/api/analyze`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ repository_url: url }) }); const body = await response.json(); if (!response.ok) throw new Error(body.detail || "Analysis failed."); const result = await fetch(`${API}/api/analysis/${body.analysis_id}`); const payload = await result.json(); setData(payload); setPage("overview"); const entry = { id: payload.id, repository: `${payload.repository.owner}/${payload.repository.name}`, date: new Date().toISOString(), score: payload.overall_score, modules: payload.modules.length, payload }; const next = [entry, ...history.filter((item) => item.repository !== entry.repository)].slice(0, 10); setHistory(next); localStorage.setItem("gitquality-history", JSON.stringify(next)); } catch (caught) { setError(caught.message); } finally { setLoading(false); }
  }
  if (loading) return <main className="public-shell"><LoadingState stage={stage} /></main>;
  if (!data) return <main className="public-shell"><header className="public-header"><div className="brand">Git<span>Quality</span></div><span>Repository intelligence for better software</span></header><Landing {...{ url, setUrl, onAnalyze: analyze, error, loading }} /></main>;
  const nav = [["overview", "Overview"], ["modules", "Modules"], ["architecture", "Architecture"], ["clusters", "Health map"], ["insights", "Insights"], ["recommendations", "Recommendations"], ["history", "History"], ["settings", "Settings"]];
  return <>{palette && <CommandPalette onClose={() => setPalette(false)} setPage={setPage} setTheme={setTheme} onNewAnalysis={() => setData(null)} modules={data.modules} />}<div className={`app-shell ${collapsed ? "sidebar-collapsed" : ""}`}><aside className="sidebar"><div className="shell-brand"><Logo /><button className="collapse-button" onClick={() => setCollapsed(!collapsed)} aria-label="Collapse sidebar">‹</button></div><div className="repo-switcher"><span className="repo-dot" /><div><strong>{data.repository.name}</strong><small>{data.repository.owner}</small></div></div><nav>{nav.map(([key, label]) => <button className={page === key ? "active" : ""} onClick={() => setPage(key)} key={key}><Icon name={key} /><span>{label}</span>{key === "recommendations" && data.recommendations.length > 0 && <i>{data.recommendations.length}</i>}</button>)}</nav><div className="sidebar-bottom"><button onClick={() => setData(null)}><span>＋</span><em>New analysis</em></button><small>Real repository data<br />No code execution</small></div></aside><main className="app-content"><header className="topbar"><button className="command-button" onClick={() => setPalette(true)}>Search GitQuality… <kbd>⌘ K</kbd></button><ThemeControl theme={theme} setTheme={setTheme} /></header><div className="mobile-top"><Logo /><button onClick={() => setCollapsed(!collapsed)}>☰</button></div>{page === "overview" && <Overview data={data} onSelect={setSelected} setPage={setPage} />}{page === "modules" && <Modules data={data} onSelect={setSelected} />}{page === "architecture" && <Architecture data={data} onSelect={setSelected} />}{page === "clusters" && <Clusters data={data} onSelect={setSelected} />}{page === "insights" && <InsightsPage data={data} onSelect={setSelected} />}{page === "recommendations" && <Recommendations data={data} onSelect={setSelected} />}{page === "history" && <History entries={history} onOpen={(entry) => { setData(entry.payload); setPage("overview"); }} />}{page === "settings" && <Settings theme={theme} setTheme={setTheme} density={density} setDensity={setDensity} />}</main></div><ModuleDetail module={selected} onClose={() => setSelected(null)} /></>;
}

function History({ entries, onOpen }) {
  return <><PageHeader eyebrow="HISTORY" title="Previous analyses" subtitle="Your recent repository quality reports, stored locally in this browser." />{entries.length ? <div className="history-list">{entries.map((entry) => <button className="history-row" key={entry.id} onClick={() => onOpen(entry)}><div><strong>{entry.repository}</strong><small>{new Date(entry.date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })} · {entry.modules} modules</small></div><b>{entry.score}<small>/ 100</small></b><span>Open report →</span></button>)}</div> : <div className="panel quiet">No analysis history yet. Run an analysis to see it here.</div>}</>;
}

createRoot(document.getElementById("root")).render(<App />);
