# PortfolioForge backend update (existing APIs preserved)

This package is based on the original uploaded backend and retains its existing authentication, project, portfolio-save, and dashboard-progress endpoints. It adds portfolio publishing and public portfolio lookup, and allows common Vite localhost origins through CORS.

## Before replacing files
1. Back up `E:\Coding\Portfolio\backend\app`.
2. In Neon SQL Editor, run `MIGRATION_NEON.sql` once. This is required because `Base.metadata.create_all()` does not add columns to an existing table.
3. Copy the `app` folder from this package into `E:\Coding\Portfolio\backend\app`, replacing the matching files. Do not replace your `.env` file and do not share it.
4. Restart the backend:

```powershell
cd E:\Coding\Portfolio\backend
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

## New endpoints
- `POST /api/portfolio/publish` (login required), JSON: `{"slug":"amit-mishra"}`
- `DELETE /api/portfolio/publish` (login required)
- `GET /api/portfolio/public/{slug}` (public; no login required)

The existing `GET /api/portfolio/me` and `PUT /api/portfolio/me` remain available.

For deployment, optionally add `PUBLIC_FRONTEND_URL=https://your-actual-frontend-domain` to `backend/.env`. For local development this is not needed. Never overwrite or expose the existing database URL or JWT secret.


## Portfolio Analytics (v1)

1. Run the updated `MIGRATION_NEON.sql` in the Neon SQL Editor. It is additive and does not delete existing data.
2. Restart the backend.
3. Public portfolio page views are recorded at `POST /api/analytics/track`.
4. Authenticated owners can read their own summary at `GET /api/analytics/overview?range=7d` or `30d`.

The total visitor metric counts distinct anonymous browser network/user-agent keys for portfolio page views.
Daily and weekly metrics count page views. Project ranking is populated when a project-view event is sent with a `project_title`; the current frontend tracker sends portfolio page views only, so project rankings remain empty until project-click tracking is added to the frontend.
