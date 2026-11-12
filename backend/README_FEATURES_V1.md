# PortfolioForge Backend Features V1

This update is based on the uploaded original backend. It preserves the existing authentication, projects, portfolio save/load, and dashboard progress routes.

## Added features
- Job Application Tracker: authenticated list/create/update/delete endpoints under `/api/job-applications`.
- Portfolio publishing: authenticated publish, unpublish, and publish-status endpoints.
- Public portfolio lookup at `/api/portfolio/public/{slug}` (no login required).
- Portfolio model fields `slug` and `is_published`.
- `PUBLIC_FRONTEND_URL` optional setting for deployed sites.

## Important: database migration
Before replacing the backend files, run `MIGRATION_NEON.sql` once in the Neon SQL Editor. This adds the publishing columns and creates the job application table. SQLAlchemy `create_all()` does not add columns to an existing table.

## Install
1. Back up `E:\Coding\Portfolio\backend\app`.
2. Stop the backend with Ctrl+C.
3. Run `MIGRATION_NEON.sql` in Neon SQL Editor.
4. Extract this ZIP and copy its `Backend\app` folder into `E:\Coding\Portfolio\backend\app`, replacing files.
5. Keep your existing `backend\.env` unchanged. Never upload or share it.
6. Start the backend:

```powershell
cd E:\Coding\Portfolio\backend
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

## Endpoints added

### Job applications (login required)
- `GET /api/job-applications`
- `POST /api/job-applications`
- `PUT /api/job-applications/{application_id}`
- `DELETE /api/job-applications/{application_id}`

Accepted statuses: `Interested`, `Applied`, `Interview`, `Offer`, `Rejected`.

Example create body:
```json
{
  "company": "Example Company",
  "role": "Frontend Developer",
  "location": "Remote",
  "status": "Applied",
  "applied_date": "2026-11-09",
  "job_url": "https://example.com/jobs/123",
  "notes": "Follow up next week"
}
```

### Portfolio publishing
- `GET /api/portfolio/publish/status` (login required)
- `POST /api/portfolio/publish` (login required), body `{"slug":"your-name"}`
- `DELETE /api/portfolio/publish` (login required)
- `GET /api/portfolio/public/{slug}` (public)

The public endpoint exposes the saved portfolio data to anyone. Only publish information intended to be public.

For production, set `PUBLIC_FRONTEND_URL=https://your-frontend-domain` in your existing `.env`. For local development the API uses the request Origin header when available.

## Verification
Python files were syntax-compiled. This package has not been run against your live Neon database or connected to your frontend in this environment.
