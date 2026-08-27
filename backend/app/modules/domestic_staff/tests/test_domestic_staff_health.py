def test_module_health(client):
    r = client.get("/api/v1/domestic_staff/health")
    assert r.status_code == 200
    assert r.json()["module"] == "domestic_staff"
