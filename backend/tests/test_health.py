def test_root_envelope(client):
    r = client.get("/")
    assert r.status_code == 200
    body = r.json()
    assert body["success"] is True
    assert body["data"]["name"] == "GateSphere"


def test_healthz(client):
    r = client.get("/healthz")
    assert r.status_code == 200
    assert r.json()["success"] is True


def test_login_rejects_bad_credentials(client):
    r = client.post("/api/v1/auth/login", json={"email": "nobody@x.com", "password": "wrong"})
    assert r.status_code == 401
    body = r.json()
    assert body["success"] is False
    assert body["error"]["code"] == "INVALID_CREDENTIALS"


def test_me_requires_auth(client):
    r = client.get("/api/v1/auth/me")
    assert r.status_code == 401
    assert r.json()["error"]["code"] == "NOT_AUTHENTICATED"
