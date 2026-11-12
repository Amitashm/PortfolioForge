const API_BASE_URL = "http://127.0.0.1:8000";

async function analyticsRequest(endpoint, options = {}) {
  const token = sessionStorage.getItem("access_token");
  if (!token) throw new Error("Please log in to view your analytics.");
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
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
    if (response.status === 404) throw new Error("Analytics API is not installed in the backend yet.");
    throw new Error(data.detail || "Unable to load portfolio analytics.");
  }
  return data;
}

export function getPortfolioAnalytics(range = "7d") {
  return analyticsRequest(`/api/analytics/overview?range=${encodeURIComponent(range)}`);
}

// Called by public portfolio pages. Tracking errors must never prevent a portfolio from loading.
export async function trackPortfolioVisit(slug) {
  try {
    await fetch(`${API_BASE_URL}/api/analytics/track`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, event_type: "portfolio_view" }),
      keepalive: true,
    });
  } catch {
    // Analytics is best-effort; the public portfolio remains available if tracking is offline.
  }
}
