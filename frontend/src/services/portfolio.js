import { API_BASE_URL } from "./apiConfig";

async function portfolioRequest(endpoint, options = {}) {
  const token = sessionStorage.getItem("access_token");

  if (!token) {
    throw new Error("Please log in to edit your portfolio.");
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });

  const data = await response.json().catch(() => ({}));

  if (response.status === 401) {
    sessionStorage.removeItem("access_token");
    sessionStorage.removeItem("user");
    window.location.href = "/login";
    throw new Error("Your session expired. Please log in again.");
  }

  if (!response.ok) {
    throw new Error(
      data.detail || "Unable to process your portfolio request."
    );
  }

  return data;
}

export function getMyPortfolio() {
  return portfolioRequest("/api/portfolio/me", {
    method: "GET",
  });
}

export function saveMyPortfolio({ template, portfolio_data }) {
  return portfolioRequest("/api/portfolio/me", {
    method: "PUT",
    body: JSON.stringify({
      template,
      portfolio_data,
    }),
  });
}


// Publishing endpoints are handled by the backend. Public portfolio reads do not require login.
export function publishMyPortfolio(slug) {
  return portfolioRequest("/api/portfolio/publish", {
    method: "POST",
    body: JSON.stringify({ slug }),
  });
}

export function unpublishMyPortfolio() {
  return portfolioRequest("/api/portfolio/publish", { method: "DELETE" });
}

export async function getPublicPortfolio(slug) {
  const response = await fetch(`${API_BASE_URL}/api/portfolio/public/${encodeURIComponent(slug)}`);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.detail || "This portfolio is not published or does not exist.");
  return data;
}

// Multi-portfolio management (requires the matching backend endpoints).
export function getPortfolios() {
  return portfolioRequest("/api/portfolios", { method: "GET" });
}

export function createPortfolio(payload = {}) {
  return portfolioRequest("/api/portfolios", { method: "POST", body: JSON.stringify(payload) });
}

export function getPortfolioById(id) {
  return portfolioRequest(`/api/portfolios/${encodeURIComponent(id)}`, { method: "GET" });
}

export function savePortfolioById(id, payload) {
  return portfolioRequest(`/api/portfolios/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(payload) });
}

export function deletePortfolio(id) {
  return portfolioRequest(`/api/portfolios/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export function publishPortfolio(id, slug) {
  return portfolioRequest(`/api/portfolios/${encodeURIComponent(id)}/publish`, { method: "POST", body: JSON.stringify({ slug }) });
}

export function unpublishPortfolio(id) {
  return portfolioRequest(`/api/portfolios/${encodeURIComponent(id)}/publish`, { method: "DELETE" });
}
