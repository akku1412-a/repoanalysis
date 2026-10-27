from __future__ import annotations

import ast
import json
import math
import os
import re
import shutil
import sqlite3
import subprocess
import tempfile
import uuid
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

try:
    import networkx as nx
    from sklearn.cluster import KMeans
    from sklearn.preprocessing import StandardScaler
except ImportError:  # pragma: no cover - dependencies are installed in normal usage
    nx = KMeans = StandardScaler = None

from fastapi import BackgroundTasks, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, HttpUrl

SUPPORTED = {".py": "Python", ".js": "JavaScript", ".jsx": "JavaScript", ".ts": "TypeScript", ".tsx": "TypeScript"}
IGNORED = {".git", "node_modules", "dist", "build", "coverage", ".venv", "venv", "__pycache__", ".next", "target", "vendor"}
MAX_FILE_BYTES = 1_000_000
DB_PATH = Path(os.getenv("GITQUALITY_DB", Path(__file__).resolve().parents[1] / "gitquality.db"))


class AnalyzeRequest(BaseModel):
    repository_url: HttpUrl


class AnalyzeResponse(BaseModel):
    analysis_id: str
    status: str


def _db() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("CREATE TABLE IF NOT EXISTS analyses (id TEXT PRIMARY KEY, created_at TEXT NOT NULL, payload TEXT NOT NULL)")
    return conn


def _save(payload: dict[str, Any]) -> None:
    with _db() as conn:
        conn.execute("INSERT OR REPLACE INTO analyses VALUES (?, datetime('now'), ?)", (payload["id"], json.dumps(payload)))


def _repo_parts(url: str) -> tuple[str, str]:
    match = re.fullmatch(r"https?://github\.com/([^/]+)/([^/#?]+?)(?:\.git)?/?", url)
    if not match:
        raise ValueError("Enter a public GitHub repository URL.")
    return match.group(1), match.group(2)


def _clone(url: str, destination: Path) -> None:
    result = subprocess.run(["git", "clone", "--depth", "1", "--", url, str(destination)], capture_output=True, text=True, timeout=120)
    if result.returncode:
        raise RuntimeError("We couldn't access this repository. Make sure it is public and the URL is correct.")


def _walk_files(root: Path) -> tuple[list[Path], int]:
    files, excluded = [], 0
    for path in root.rglob("*"):
        if not path.is_file():
            continue
        if any(part in IGNORED for part in path.relative_to(root).parts):
            excluded += 1
            continue
        if path.stat().st_size > MAX_FILE_BYTES or path.suffix.lower() not in SUPPORTED:
            excluded += 1
            continue
        files.append(path)
    return files, excluded


def _complexity(node: ast.AST) -> int:
    return 1 + sum(isinstance(n, (ast.If, ast.For, ast.While, ast.Try, ast.With, ast.BoolOp, ast.IfExp, ast.comprehension)) for n in ast.walk(node))


def _python_metrics(path: Path, text: str) -> dict[str, Any]:
    try:
        tree = ast.parse(text)
    except SyntaxError:
        return {"functions": 0, "classes": 0, "imports": [], "complexity": 1, "max_function_complexity": 1, "long_functions": 0, "nesting": 0}
    funcs = [n for n in ast.walk(tree) if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef))]
    imports = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            imports.extend(alias.name for alias in node.names)
        elif isinstance(node, ast.ImportFrom) and node.module:
            imports.append(node.module)
    for parent in ast.walk(tree):
        for child in ast.iter_child_nodes(parent):
            child._parent = parent
    depths = []
    for node in ast.walk(tree):
        if isinstance(node, (ast.If, ast.For, ast.While, ast.Try, ast.With)):
            depth = 0
            parent = getattr(node, "_parent", None)
            while parent:
                depth += int(isinstance(parent, (ast.If, ast.For, ast.While, ast.Try, ast.With)))
                parent = getattr(parent, "_parent", None)
            depths.append(depth)
    complexities = [_complexity(n) for n in funcs] or [_complexity(tree)]
    return {"functions": len(funcs), "classes": sum(isinstance(n, ast.ClassDef) for n in ast.walk(tree)), "imports": imports,
            "complexity": sum(complexities), "max_function_complexity": max(complexities), "long_functions": sum((n.end_lineno - n.lineno + 1) > 50 for n in funcs), "nesting": max(depths or [0])}


def _metrics(path: Path, root: Path) -> dict[str, Any]:
    text = path.read_text(encoding="utf-8", errors="ignore")
    lines = text.splitlines()
    comments = sum(1 for line in lines if line.strip().startswith(("#", "//", "/*", "*")))
    todos = len(re.findall(r"\b(?:TODO|FIXME)\b", text, re.I))
    data = _python_metrics(path, text) if path.suffix == ".py" else {
        "functions": len(re.findall(r"\b(?:function|def)\s+\w+|(?:const|let|var)\s+\w+\s*=\s*(?:async\s*)?\(", text)),
        "classes": len(re.findall(r"\bclass\s+\w+", text)), "imports": re.findall(r"(?:import|require)\s*[({]?\s*['\"]([^'\"]+)", text),
        "complexity": 1 + len(re.findall(r"\b(?:if|for|while|catch|case)\b|&&|\|\|", text)),
        "max_function_complexity": 1 + len(re.findall(r"\b(?:if|for|while|catch|case)\b", text)), "long_functions": 0,
        "nesting": max((len(line) - len(line.lstrip())) // 2 for line in lines) if lines else 0}
    rel = str(path.relative_to(root))
    return {"file": rel, "language": SUPPORTED[path.suffix.lower()], "loc": len(lines), "size_bytes": path.stat().st_size,
            "comment_lines": comments, "comment_ratio": round(comments / max(len(lines), 1), 3), "todos": todos,
            "smells": todos + int(len(lines) > 400) + int(data["nesting"] > 5) + int(data["max_function_complexity"] > 10),
            **data}


def _documentation(root: Path, modules: list[dict[str, Any]]) -> dict[str, Any]:
    readme = next((p for p in root.iterdir() if p.name.lower().startswith("readme")), None)
    text = readme.read_text(encoding="utf-8", errors="ignore") if readme else ""
    score = (25 if readme else 0) + min(25, len(text) // 80) + (20 if re.search(r"install|setup", text, re.I) else 0) + (20 if re.search(r"usage|example", text, re.I) else 0)
    score += 10 if any(p.name.lower().startswith(("license", "copying")) for p in root.iterdir()) else 0
    for module in modules:
        module["documentation_score"] = round(module["comment_ratio"] * 100)
    return {"score": min(score, 100), "readme": bool(readme), "readme_length": len(text)}


def _tests(root: Path, modules: list[dict[str, Any]]) -> dict[str, Any]:
    test_files = [p for p in root.rglob("*") if p.is_file() and (p.name.startswith("test_") or ".test." in p.name or ".spec." in p.name or "tests" in p.parts)]
    frameworks = []
    all_text = "\n".join(p.read_text(encoding="utf-8", errors="ignore") for p in test_files[:100])
    for name, pattern in (("pytest", r"\bpytest\b"), ("Jest", r"\bjest\b"), ("unittest", r"\bunittest\b"), ("Mocha", r"\bmocha\b")):
        if re.search(pattern, all_text, re.I):
            frameworks.append(name)
    ratio = len(test_files) / max(len(modules), 1)
    return {"test_files": len(test_files), "test_source_ratio": round(ratio, 3), "frameworks": frameworks, "coverage": None}


def _dependency_graph(modules: list[dict[str, Any]]) -> tuple[dict[str, float], list[dict[str, str]]]:
    names = {Path(m["file"]).stem: m["file"] for m in modules}
    graph = nx.DiGraph() if nx else None
    if graph is None:
        return {m["file"]: 1 / max(len(modules), 1) for m in modules}, []
    graph.add_nodes_from(m["file"] for m in modules)
    edges = []
    for module in modules:
        for dependency in module["imports"]:
            target = names.get(Path(dependency).stem)
            if target and target != module["file"]:
                graph.add_edge(module["file"], target)
                edges.append({"source": module["file"], "target": target})
    ranks = nx.pagerank(graph, alpha=0.85) if graph else {}
    return ranks, edges


def _cluster_and_score(modules: list[dict[str, Any]], doc: dict[str, Any], tests: dict[str, Any], ranks: dict[str, float]) -> None:
    features = [[m["loc"], m["complexity"], m["functions"], len(m["imports"]), m["comment_ratio"], m["smells"], m["documentation_score"]] for m in modules]
    labels = [0] * len(modules)
    if len(modules) >= 3 and KMeans and StandardScaler:
        scaled = StandardScaler().fit_transform(features)
        k = min(3, len(modules))
        labels = KMeans(n_clusters=k, random_state=42, n_init=10).fit_predict(scaled).tolist()
        averages = {label: sum(features[i][1] + features[i][0] / 100 + features[i][5] * 10 for i, x in enumerate(labels) if x == label) / max(labels.count(label), 1) for label in set(labels)}
        ordered = sorted(averages, key=averages.get)
        names = {label: ("Healthy" if i == 0 else "Risky" if i == len(ordered) - 1 else "Moderate") for i, label in enumerate(ordered)}
    else:
        names = {0: "Moderate"}
    max_rank = max(ranks.values() or [1])
    max_complexity = max((m["complexity"] for m in modules), default=1)
    for i, module in enumerate(modules):
        complexity_risk = min(100, module["complexity"] / max_complexity * 100)
        size_risk = min(100, module["loc"] / 400 * 100)
        testing_risk = 0 if tests["test_files"] else 100
        risk = round(.30 * complexity_risk + .20 * min(100, module["smells"] * 20) + .15 * size_risk + .15 * (100 - module["documentation_score"]) + .20 * testing_risk)
        importance = ranks.get(module["file"], 0) / max_rank * 100
        priority = round(.40 * risk + .40 * importance + .20 * complexity_risk)
        module.update({"risk": risk, "pagerank": round(ranks.get(module["file"], 0), 6), "pagerank_importance": round(importance), "priority": priority, "cluster": names.get(labels[i], "Moderate"),
                       "priority_level": "Critical" if risk >= 60 and importance >= 60 else "High" if priority >= 60 else "Medium" if priority >= 40 else "Low"})


def analyze_repository(url: str) -> dict[str, Any]:
    owner, repo = _repo_parts(url)
    with tempfile.TemporaryDirectory(prefix="gitquality-") as temp:
        root = Path(temp) / "repo"
        _clone(url, root)
        files, excluded = _walk_files(root)
        modules = [_metrics(path, root) for path in files]
        if not modules:
            raise ValueError("This repository has no supported source files.")
        doc, tests = _documentation(root, modules), _tests(root, modules)
        ranks, edges = _dependency_graph(modules)
        _cluster_and_score(modules, doc, tests, ranks)
        dimensions = {"code_quality": round(max(0, 100 - sum(m["smells"] for m in modules) / len(modules) * 15)),
                      "complexity": round(max(0, 100 - sum(m["complexity"] for m in modules) / len(modules) * 5)),
                      "documentation": doc["score"], "testing": min(100, round(tests["test_source_ratio"] * 100 + (20 if tests["frameworks"] else 0))),
                      "maintainability": round((doc["score"] + max(0, 100 - sum(m["complexity"] for m in modules) / len(modules) * 5)) / 2)}
        overall = round(.25 * dimensions["code_quality"] + .20 * dimensions["complexity"] + .15 * dimensions["documentation"] + .20 * dimensions["testing"] + .20 * dimensions["maintainability"])
        recommendations = []
        for module in modules:
            reasons = []
            if module["complexity"] > 10:
                reasons.append("break high-complexity logic into smaller functions")
            if module["documentation_score"] < 20:
                reasons.append("add function/class documentation")
            if module["smells"] > 0:
                reasons.append("resolve TODO/FIXME markers or structural smells")
            if module["pagerank_importance"] >= 60:
                reasons.append("review changes carefully because this module is highly connected")
            if module["priority_level"] == "Critical":
                reasons.append("prioritize refactoring because risk and architectural importance are both high")
            if reasons:
                recommendations.append({"file": module["file"], "message": "; ".join(reasons).capitalize() + "."})
        return {"id": str(uuid.uuid4()), "repository": {"owner": owner, "name": repo, "url": url}, "overall_score": overall, "dimensions": dimensions,
                "documentation": doc, "testing": tests, "modules": sorted(modules, key=lambda x: x["priority"], reverse=True), "dependencies": edges,
                "recommendations": recommendations, "excluded_files": excluded, "methodology": {"overall": "25% code quality + 20% complexity + 15% documentation + 20% testing + 20% maintainability",
                "risk": "30% complexity + 20% smells + 15% size + 15% documentation + 20% testing", "priority": "40% risk + 40% PageRank importance + 20% complexity"}}


app = FastAPI(title="GitQuality API", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"], allow_methods=["*"], allow_headers=["*"])


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/analyze", response_model=AnalyzeResponse)
def create_analysis(request: AnalyzeRequest, background_tasks: BackgroundTasks) -> AnalyzeResponse:
    try:
        analysis = analyze_repository(str(request.repository_url))
    except (ValueError, RuntimeError, subprocess.TimeoutExpired) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    _save(analysis)
    return AnalyzeResponse(analysis_id=analysis["id"], status="complete")


@app.get("/api/analysis/{analysis_id}")
def get_analysis(analysis_id: str) -> dict[str, Any]:
    with _db() as conn:
        row = conn.execute("SELECT payload FROM analyses WHERE id = ?", (analysis_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Analysis not found.")
    return json.loads(row["payload"])


def _section(analysis_id: str, key: str) -> Any:
    return get_analysis(analysis_id).get(key, [])


@app.get("/api/analysis/{analysis_id}/modules")
def get_modules(analysis_id: str) -> list[dict[str, Any]]:
    return _section(analysis_id, "modules")


@app.get("/api/analysis/{analysis_id}/dependencies")
def get_dependencies(analysis_id: str) -> list[dict[str, str]]:
    return _section(analysis_id, "dependencies")


@app.get("/api/analysis/{analysis_id}/clusters")
def get_clusters(analysis_id: str) -> list[dict[str, Any]]:
    return [{"file": module["file"], "cluster": module["cluster"]} for module in _section(analysis_id, "modules")]


@app.get("/api/analysis/{analysis_id}/pagerank")
def get_pagerank(analysis_id: str) -> list[dict[str, Any]]:
    return [{"file": module["file"], "pagerank": module["pagerank"], "importance": module["pagerank_importance"]} for module in _section(analysis_id, "modules")]


@app.get("/api/analysis/{analysis_id}/recommendations")
def get_recommendations(analysis_id: str) -> list[dict[str, str]]:
    return _section(analysis_id, "recommendations")
