def test_module_health(client):
    r = client.get("/api/v1/residents/health")
    assert r.status_code == 200
    assert r.json()["data"]["module"] == "residents"
