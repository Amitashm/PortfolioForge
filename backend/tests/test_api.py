import asyncio
import json
import os
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest import TestCase
from unittest.mock import patch
from urllib.parse import urlsplit

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

with patch.dict(os.environ, {
    "DATABASE_URL": "sqlite://",
    "SECRET_KEY": "test-only-secret-do-not-use-in-deployment",
    "GOOGLE_CLIENT_ID": "test-client",
}):
    from app import main
    from app.database import Base


class ApiTests(TestCase):
    def setUp(self):
        directory = TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        engine = create_engine(f"sqlite:///{Path(directory.name, 'test.db').as_posix()}")
        self.addCleanup(engine.dispose)
        Base.metadata.create_all(engine)
        session_factory = sessionmaker(bind=engine)

        def get_test_db():
            with session_factory() as session:
                yield session

        overrides = patch.dict(main.app.dependency_overrides, {main.get_db: get_test_db})
        overrides.start()
        self.addCleanup(overrides.stop)

    def request(self, method, url, expected, payload=None, token=None, headers=None):
        target = urlsplit(url)
        request_headers = {"host": "testserver", **(headers or {})}
        body = b""
        if payload is not None:
            body = json.dumps(payload).encode()
            request_headers["content-type"] = "application/json"
        if token:
            request_headers["authorization"] = f"Bearer {token}"
        messages = []

        async def receive():
            return {"type": "http.request", "body": body}

        async def send(message):
            messages.append(message)

        asyncio.run(main.app({
            "type": "http", "method": method, "path": target.path,
            "query_string": target.query.encode(), "scheme": "http",
            "headers": [(k.encode(), v.encode()) for k, v in request_headers.items()],
            "client": ("127.0.0.1", 1234), "server": ("testserver", 80),
        }, receive, send))
        response_body = b"".join(message.get("body", b"") for message in messages)
        self.assertEqual(messages[0]["status"], expected, (method, url, response_body))
        self.response_headers = dict(messages[0]["headers"])
        if response_body and b"application/json" in self.response_headers.get(b"content-type", b""):
            return json.loads(response_body)

    def create_user(self, email="tester@example.com"):
        credentials = {"email": email, "password": "test-password"}
        self.request("POST", "/api/auth/signup", 201, {**credentials, "full_name": "Test User"})
        return self.request("POST", "/api/auth/login", 200, credentials)["access_token"]

    def test_health_and_cors(self):
        self.request("GET", "/", 200)
        self.assertEqual(self.request("GET", "/api/health", 200), {"status": "ok"})
        for origin, expected in (
            ("https://portfolio-forge-ten.vercel.app", 200),
            ("http://localhost:5173", 200),
            ("https://unrelated.example", 400),
        ):
            with self.subTest(origin=origin):
                self.request("OPTIONS", "/api/portfolios", expected, headers={
                    "origin": origin, "access-control-request-method": "GET",
                    "access-control-request-headers": "authorization,content-type",
                })
                self.assertEqual(
                    self.response_headers.get(b"access-control-allow-origin"),
                    origin.encode() if expected == 200 else None,
                )

    def test_password_authentication(self):
        self.request("GET", "/api/portfolios", 401)
        self.request("POST", "/api/auth/signup", 422, {})
        token = self.create_user()
        self.request("POST", "/api/auth/signup", 409, {
            "email": "tester@example.com", "password": "test-password", "full_name": "Duplicate",
        })
        self.request("POST", "/api/auth/login", 401, {
            "email": "tester@example.com", "password": "incorrect",
        })
        self.request("GET", "/api/dashboard/progress", 200, token=token)

    def test_google_authentication_with_mocked_token_verifier(self):
        payload = {"credential": "test-credential-placeholder"}
        claims = {"email": "google-user@example.com", "email_verified": True, "sub": "test-subject"}
        with patch.object(main.google_id_token, "verify_oauth2_token", return_value=claims):
            first = self.request("POST", "/api/auth/google", 200, payload)
            second = self.request("POST", "/api/auth/google", 200, payload)
            self.assertEqual(first["user"]["id"], second["user"]["id"])
        with patch.object(main.google_id_token, "verify_oauth2_token", side_effect=ValueError):
            self.request("POST", "/api/auth/google", 401, payload)

    def test_project_and_job_crud(self):
        token = self.create_user()
        for url, data, changes in (
            ("/api/projects", {"title": "Demo", "description": "Demo project"}, {"title": "Updated"}),
            ("/api/job-applications", {"company": "Demo", "role": "Developer"}, {"status": "Applied"}),
        ):
            with self.subTest(url=url):
                record = self.request("POST", url, 201, data, token=token)
                item_url = f"{url}/{record['id']}"
                self.assertEqual(len(self.request("GET", url, 200, token=token)), 1)
                updated = self.request("PUT", item_url, 200, {**data, **changes}, token=token)
                for key, value in changes.items():
                    self.assertEqual(updated[key], value)
                self.request("DELETE", item_url, 204, token=token)
                self.assertEqual(self.request("GET", url, 200, token=token), [])

    def test_portfolio_lifecycle_and_analytics(self):
        token = self.create_user()
        other_token = self.create_user("other@example.com")
        self.assertEqual(self.request("GET", "/api/portfolios", 200, token=token), [])
        data = {"template": "minimal", "portfolio_data": {"name": "Test User"}}
        record = self.request("POST", "/api/portfolios", 201, data, token=token)
        url = f"/api/portfolios/{record['id']}"
        self.request("GET", url, 404, token=other_token)
        self.request("GET", url, 200, token=token)
        self.request("PUT", url, 200, {**data, "template": "dark"}, token=token)
        self.request("POST", url + "/publish", 200, {"slug": "test-portfolio"}, token=token)
        self.request("GET", "/api/portfolio/public/test-portfolio", 200)
        self.request("POST", "/api/analytics/track", 202, {"slug": "test-portfolio"})
        self.request("POST", "/api/analytics/track", 202, {
            "slug": "test-portfolio", "event_type": "project_view", "project_title": "Demo",
        })
        for days in (7, 30):
            analytics = self.request("GET", f"/api/analytics/overview?range={days}d", 200, token=token)
            self.assertEqual(analytics["total_visitors"], 1)
            self.assertEqual(len(analytics["daily_visits"]), days)
            self.assertEqual(sum(day["visits"] for day in analytics["daily_visits"]), 1)
            self.assertEqual(analytics["top_projects"], [{"title": "Demo", "views": 1}])
        self.request("GET", "/api/analytics/overview?range=invalid", 400, token=token)
        self.request("DELETE", url + "/publish", 200, token=token)
        self.request("GET", "/api/portfolio/public/test-portfolio", 404)
        for expected in (201, 201, 409):
            self.request("POST", "/api/portfolios", expected, data, token=token)
        self.request("DELETE", url, 204, token=token)

    def test_legacy_portfolio_lifecycle(self):
        token = self.create_user()
        self.request("GET", "/api/portfolio/me", 200, token=token)
        self.request("PUT", "/api/portfolio/me", 200, {"template": "minimal"}, token=token)
        self.request("POST", "/api/portfolio/publish", 200, {"slug": "legacy-test"}, token=token)
        status = self.request("GET", "/api/portfolio/publish/status", 200, token=token)
        self.assertTrue(status["is_published"])
        self.request("DELETE", "/api/portfolio/publish", 200, token=token)
