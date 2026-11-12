# PortfolioForge backend publishing update

## What this adds
- `POST /api/portfolio/publish` (JWT required): publish current user's portfolio with a unique slug.
- `DELETE /api/portfolio/publish` (JWT required): make the portfolio private.
- `GET /api/portfolio/public/{slug}` (public): retrieve published portfolio data without login.
- Portfolio table fields `slug` and `is_published`.

## Important: update the existing Neon database first
The existing database already has a `portfolios` table. `Base.metadata.create_all()` will NOT add columns to an existing table.
1. Open your Neon project and launch SQL Editor.
2. Open `MIGRATION_NEON.sql` from this ZIP and run its SQL once.
3. Then replace the matching Python files in `backend/app/` with the files in this ZIP.

## Optional deployed URL
For local development, publish returns a relative URL like `/u/rahul`, which the frontend converts to the current site URL.
When deployed, add this optional setting to `backend/.env`:
`PUBLIC_FRONTEND_URL=https://your-real-frontend-domain.example`
Replace that example with your actual deployed frontend domain. Do not include a trailing slash.

## Start backend
From the backend folder:
```powershell
.\.venv\Scripts\Activate.ps1
python -m uvicorn app.main:app --reload
```
If activation fails:
```powershell
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

## API smoke test
After login, use the bearer token:
- `POST /api/portfolio/publish` with JSON `{"slug":"rahul"}`.
- `GET /api/portfolio/public/rahul` without a token.
- `DELETE /api/portfolio/publish` with a token.

Slug uniqueness is enforced in the database. Published portfolio data is publicly visible, so only include details you intend to share.
