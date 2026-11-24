# Google Sign-In setup (PortfolioForge)

1. Keep your existing `backend/.env` file and its current `DATABASE_URL` and `SECRET_KEY`.
2. Add this setting to that same backend `.env` file:

   ```env
   GOOGLE_CLIENT_ID=YOUR_GOOGLE_OAUTH_CLIENT_ID
   ```

3. Use the same OAuth Client ID in the frontend `frontend/.env` as `VITE_GOOGLE_CLIENT_ID`.
4. Install the new backend dependency from the backend folder:

   ```powershell
   .\.venv\Scripts\python.exe -m pip install -r requirements.txt
   ```

5. Restart the API:

   ```powershell
   .\.venv\Scripts\python.exe -m uvicorn app.main:app --reload
   ```

The frontend sends the Google Identity Services ID token to `POST /api/auth/google`.
The API verifies the token signature, issuer, expiry and audience with Google's
verified token library, requires a verified email, then returns the existing
PortfolioForge bearer-token response shape.

No database migration is required for Google sign-in. Existing email/password
authentication and existing database rows are retained.

For local development, your Google OAuth client's Authorized JavaScript origin
must include `http://localhost:5173`, and your Google account must be listed as
a test user while the consent screen is in Testing mode.

For hosted sign-in, register https://portfolio-forge-ten.vercel.app under Authorized JavaScript origins on the Web application OAuth client used by VITE_GOOGLE_CLIENT_ID. Preview deployments link to that stable origin for Google sign-in.
