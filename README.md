# GitQuality

GitQuality is an integrated repository-quality analysis framework combining static metrics, clustering-based risk identification, and graph-based architectural importance ranking. It analyzes public GitHub repositories without executing repository code.

## What it measures

- Python, JavaScript, and TypeScript source modules
- Lines of code, functions, classes, imports, comments, TODO/FIXME markers, complexity, nesting, and basic smells
- README/project documentation and test-file signals
- A dependency graph and deterministic NetworkX PageRank
- StandardScaler + deterministic K-Means clustering (Healthy, Moderate, Risky)
- Transparent risk and Module Priority Scores

The default overall score is `25% code quality + 20% complexity + 15% documentation + 20% testing + 20% maintainability`. Module risk is `30% complexity + 20% smells + 15% size + 15% documentation + 20% testing`; priority is `40% risk + 40% PageRank importance + 20% complexity risk`.

## Run locally

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`, enter a public GitHub URL, and choose **Analyze repository**. The analyzer uses a shallow clone in a temporary directory, excludes generated/vendor/binary content, and removes the clone when analysis finishes. It does not run npm, pip, tests, or application code from the target repository.

## API

- `GET /api/health`
- `POST /api/analyze` with `{"repository_url":"https://github.com/owner/repository"}`
- `GET /api/analysis/{analysis_id}`

## Testing

```bash
cd backend
pytest
```

## Limitations and future work

The MVP uses lightweight AST/lexical analysis for JavaScript and TypeScript and Python AST analysis. Coverage is reported as unavailable unless an existing report is integrated. Future work can add incremental jobs, richer language parsers, persistent module tables, graph visualization, and repository-size quotas.
