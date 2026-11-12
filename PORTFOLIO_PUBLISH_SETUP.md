# PortfolioForge public portfolio frontend update

This update adds a public route `/u/:slug` and a Publish/Copy link/Unpublish panel on the dashboard.

## Backend endpoints required
The frontend expects these FastAPI endpoints (not included in this frontend ZIP):
- `POST /api/portfolio/publish` authenticated Bearer token, JSON `{ "slug": "your-name" }`; returns `{ "slug": "your-name", "public_url": "http://localhost:5173/u/your-name", "is_published": true }`. The backend must reject duplicate slugs and publish the signed-in user's saved portfolio.
- `DELETE /api/portfolio/publish` authenticated Bearer token; unpublishes the signed-in user's portfolio.
- `GET /api/portfolio/public/{slug}` public/no auth; returns `{ "template": "minimal", "portfolio_data": { ... } }` only if published.

The public URL will work on the internet only after deploying the frontend and backend and configuring the frontend's API base URL for the deployed backend.
