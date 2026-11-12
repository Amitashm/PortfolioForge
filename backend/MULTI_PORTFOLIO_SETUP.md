# Multi-portfolio update (Backend)

This backend update adds support for up to **3 separate portfolios per account**. Each portfolio has its own content, template, slug/public URL, publish state, and analytics events.

## Important: run the database migration first

1. Open your Neon project and select the SQL Editor.
2. Open `MIGRATION_NEON.sql` from this Backend folder.
3. Run the complete SQL script. It adds/ensures the publishing and analytics schema and removes the old unique constraint that limited each user to one portfolio.
4. Existing portfolio rows, public slugs, and published states are preserved.

Do not delete or recreate your Neon database.

## Install and start

Replace the files in your existing `E:\Coding\Portfolio\backend` folder with the contents of this `Backend` folder. Keep your existing `.env` file and `.venv` folder; do not overwrite or share `.env`.

In the VS Code terminal:

```powershell
cd E:\Coding\Portfolio\backend
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

API docs: `http://127.0.0.1:8000/docs`

## Added endpoints

- `GET /api/portfolios` — list your portfolios
- `POST /api/portfolios` — create a portfolio (maximum 3)
- `GET /api/portfolios/{id}` — load one portfolio
- `PUT /api/portfolios/{id}` — save one portfolio
- `DELETE /api/portfolios/{id}` — delete one portfolio
- `POST /api/portfolios/{id}/publish` — publish one portfolio with its own slug
- `DELETE /api/portfolios/{id}/publish` — unpublish one portfolio

The existing `/api/portfolio/me` and `/api/portfolio/publish` routes remain for compatibility and operate on the oldest portfolio. The public URL route remains `/api/portfolio/public/{slug}`.

Analytics can now be selected by `portfolio_id` query parameter, e.g. `/api/analytics/overview?range=7d&portfolio_id=12`. Omitting it retains the legacy first-portfolio behavior.

## Notes

- Portfolio content is stored independently in each row's `portfolio_data` JSON field.
- The existing separate Projects page/API remains user-scoped, as it was before this update. Projects embedded in each portfolio's JSON remain portfolio-specific.
- The backend enforces the three-portfolio limit and checks portfolio ownership on ID-based routes.
