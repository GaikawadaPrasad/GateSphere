def test_module_health(client):
    r = client.get("/api/v1/communities/health")
    assert r.status_code == 200
    assert r.json()["module"] == "communities"
