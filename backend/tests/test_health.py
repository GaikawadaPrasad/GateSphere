def test_healthz(client):
    r = client.get("/healthz")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_login_rejects_bad_credentials(client):
    r = client.post("/api/v1/auth/login", json={"email": "nobody@x.com", "password": "wrong"})
    assert r.status_code == 401
