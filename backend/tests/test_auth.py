from fastapi.testclient import TestClient


def test_health_public(client: TestClient):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_login_success_sets_httponly_cookie(client: TestClient):
    # Bootstrap a user first via setup
    r0 = client.post("/api/auth/setup", json={"username": "tester", "password": "testpass1"})
    assert r0.status_code == 201
    # Drop the setup cookie so we exercise the login path
    client.cookies.clear()
    r = client.post("/api/auth/login", json={"username": "tester", "password": "testpass1"})
    assert r.status_code == 200
    cookie = r.cookies.get("sierra_session")
    assert cookie is not None
    set_cookie = r.headers.get("set-cookie", "")
    assert "httponly" in set_cookie.lower()
    assert "samesite=strict" in set_cookie.lower()


def test_login_wrong_password_returns_401(client: TestClient):
    r0 = client.post("/api/auth/setup", json={"username": "tester", "password": "testpass1"})
    assert r0.status_code == 201
    client.cookies.clear()
    r = client.post("/api/auth/login", json={"username": "tester", "password": "wrong"})
    assert r.status_code == 401
    assert r.json()["detail"] == "Invalid credentials"


def test_login_unknown_user_returns_401(client: TestClient):
    r = client.post("/api/auth/login", json={"username": "admin", "password": "correct-password"})
    assert r.status_code == 401
    assert r.json()["detail"] == "Invalid credentials"


def test_login_error_does_not_distinguish_user_vs_password(client: TestClient):
    r0 = client.post("/api/auth/setup", json={"username": "tester", "password": "testpass1"})
    assert r0.status_code == 201
    client.cookies.clear()
    r1 = client.post("/api/auth/login", json={"username": "tester", "password": "wrong"})
    r2 = client.post("/api/auth/login", json={"username": "nobody", "password": "testpass1"})
    assert r1.json()["detail"] == r2.json()["detail"]


def test_me_without_session_returns_401(client: TestClient):
    r = client.get("/api/auth/me")
    assert r.status_code == 401


def test_me_with_session_returns_username(auth_client: TestClient):
    r = auth_client.get("/api/auth/me")
    assert r.status_code == 200
    assert r.json()["username"] == "tester"


def test_logout_invalidates_session(auth_client: TestClient):
    auth_client.post("/api/auth/logout")
    r = auth_client.get("/api/auth/me")
    assert r.status_code == 401


def test_logout_without_session_returns_401(client: TestClient):
    r = client.post("/api/auth/logout")
    assert r.status_code == 401


def test_security_headers_present(client: TestClient):
    r = client.get("/health")
    assert "nosniff" in r.headers.get("x-content-type-options", "")
    assert "DENY" in r.headers.get("x-frame-options", "")
    assert "no-referrer" in r.headers.get("referrer-policy", "")
    assert "default-src" in r.headers.get("content-security-policy", "")


def test_cors_not_wildcard(client: TestClient):
    r = client.get("/health", headers={"Origin": "https://evil.example.com"})
    acao = r.headers.get("access-control-allow-origin", "")
    assert acao != "*"


def test_login_empty_username_rejected(client: TestClient):
    r = client.post("/api/auth/login", json={"username": "", "password": "correct-password"})
    assert r.status_code == 422


def test_login_empty_password_rejected(client: TestClient):
    r = client.post("/api/auth/login", json={"username": "tester", "password": ""})
    assert r.status_code == 422


def test_login_oversized_password_rejected(client: TestClient):
    r = client.post("/api/auth/login", json={"username": "tester", "password": "x" * 300})
    assert r.status_code == 422
