def test_module_health(client):
    r = client.get("/api/v1/visitors/health")
    assert r.status_code == 200
    assert r.json()["module"] == "visitors"
