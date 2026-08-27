def test_module_health(client):
    r = client.get("/api/v1/notifications/health")
    assert r.status_code == 200
    assert r.json()["module"] == "notifications"
