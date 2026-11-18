const DEFAULT_API_BASE_URL = import.meta.env.PROD
  ? "https://portfolioforge-production.up.railway.app"
  : "http://127.0.0.1:8000";
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL?.trim() || DEFAULT_API_BASE_URL)
  .replace(/\/+$/, "");

/**
 * Send a request to the FastAPI backend.
 * Converts unsuccessful responses into readable errors.
 */
async function authRequest(endpoint, userData) {
  let response;
  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(userData),
    });
  } catch {
    throw new Error("Unable to reach the server. Please make sure the backend is running.");
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data.detail || "Something went wrong. Please try again."
    );
  }

  return data;
}

/**
 * Register a new PortfolioForge user.
 */
export function signupUser({ full_name, email, password }) {
  return authRequest("/api/auth/signup", {
    full_name,
    email,
    password,
  });
}

/**
 * Log in an existing PortfolioForge user.
 */
export function loginUser({ email, password }) {
  return authRequest("/api/auth/login", {
    email,
    password,
  });
}

/**
 * Exchange a Google Identity Services ID token for a PortfolioForge session.
 * The backend must verify the token with Google's public keys and return
 * the same { access_token, user } shape as the regular login endpoint.
 */
export function loginWithGoogle(credential) {
  return authRequest("/api/auth/google", { credential });
}
