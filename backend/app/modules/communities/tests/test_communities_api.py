"""Integration tests — full router -> service -> DB, incl. RBAC + tenant scope."""

from __future__ import annotations

P = "/api/v1/communities"


def test_health_envelope(client):
    r = client.get(f"{P}/health")
    assert r.status_code == 200
    assert r.json()["data"]["module"] == "communities"


def test_list_requires_auth(client):
    r = client.get(P)
    assert r.status_code == 401
    assert r.json()["error"]["code"] == "NOT_AUTHENTICATED"


def test_resident_cannot_create_community(as_role, unique_code):
    r = as_role("resident").post(P, json={"code": unique_code, "name": "X"})
    assert r.status_code == 403
    assert r.json()["error"]["code"] == "PERMISSION_DENIED"


def test_superadmin_full_property_hierarchy(auth_client, unique_code):
    # community
    r = auth_client.post(P, json={"code": unique_code, "name": "Test Community"})
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["success"] and body["message"] == "Community created"
    community_id = body["data"]["id"]

    # duplicate code -> 409
    r = auth_client.post(P, json={"code": unique_code, "name": "Dup"})
    assert r.status_code == 409
    assert r.json()["error"]["code"] == "COMMUNITY_CODE_TAKEN"

    # unknown field -> 422 (extra=forbid)
    r = auth_client.post(P, json={"code": unique_code + "z", "name": "Y", "nope": 1})
    assert r.status_code == 422

    # gate
    r = auth_client.post(f"{P}/{community_id}/gates", json={"code": "G1", "name": "Main Gate"})
    assert r.status_code == 201, r.text

    # tower -> floor -> unit
    r = auth_client.post(f"{P}/{community_id}/towers", json={"code": "TA", "name": "Tower A"})
    assert r.status_code == 201, r.text
    tower_id = r.json()["data"]["id"]

    r = auth_client.post(f"{P}/floors", json={"tower_id": tower_id, "floor_number": 1})
    assert r.status_code == 201, r.text
    floor_id = r.json()["data"]["id"]

    r = auth_client.post(
        f"{P}/units", json={"floor_id": floor_id, "unit_number": "A-101", "bedrooms": 3}
    )
    assert r.status_code == 201, r.text
    unit = r.json()["data"]
    assert unit["community_id"] == community_id
    assert unit["tower_id"] == tower_id

    # list units on the floor -> envelope with meta
    r = auth_client.get(f"{P}/floors/{floor_id}/units")
    assert r.status_code == 200
    body = r.json()
    assert body["meta"]["total"] == 1
    assert body["data"][0]["unit_number"] == "A-101"

    # cleanup
    assert auth_client.delete(f"{P}/{community_id}").status_code == 204


def test_community_admin_is_scoped_to_own_community(as_role, seed_ids, unique_code):
    ca = as_role("community_admin")

    # can create a tower in their own community
    own = seed_ids["community_id"]
    r = ca.post(
        f"{P}/{own}/towers", json={"code": unique_code[:8], "name": f"Tower {unique_code[:6]}"}
    )
    assert r.status_code == 201, r.text

    # cannot create a community (global-only) -> 403
    r = ca.post(P, json={"code": unique_code, "name": "X"})
    assert r.status_code == 403
    assert r.json()["error"]["code"] == "GLOBAL_ONLY"

    # another community is not found for them -> 404, never 403
    other = seed_ids["other_community_id"]
    r = ca.get(f"{P}/{other}")
    assert r.status_code == 404
    r = ca.post(f"{P}/{other}/towers", json={"code": "ZZ", "name": "Nope"})
    assert r.status_code == 404


def test_auditor_can_view_but_not_create(as_role, seed_ids):
    auditor = as_role("auditor")
    r = auditor.get(P)
    assert r.status_code == 200
    r = auditor.post(P, json={"code": "auditx", "name": "X"})
    assert r.status_code == 403


def test_property_full_crud_and_community_units_list(auth_client, unique_code):
    # 1. Create community
    r = auth_client.post(P, json={"code": f"c_{unique_code}", "name": "CRUD Community"})
    assert r.status_code == 201
    cid = r.json()["data"]["id"]

    try:
        # 2. Gate CRUD
        r = auth_client.post(f"{P}/{cid}/gates", json={"code": "G_MAIN", "name": "Main Gate"})
        assert r.status_code == 201
        gid = r.json()["data"]["id"]

        r = auth_client.get(f"{P}/gates/{gid}")
        assert r.status_code == 200
        assert r.json()["data"]["name"] == "Main Gate"

        r = auth_client.patch(f"{P}/gates/{gid}", json={"name": "North Main Gate"})
        assert r.status_code == 200
        assert r.json()["data"]["name"] == "North Main Gate"

        # 3. Tower CRUD
        r = auth_client.post(f"{P}/{cid}/towers", json={"code": "T1", "name": "Tower One"})
        assert r.status_code == 201
        tid = r.json()["data"]["id"]

        r = auth_client.patch(f"{P}/towers/{tid}", json={"name": "Tower Alpha"})
        assert r.status_code == 200
        assert r.json()["data"]["name"] == "Tower Alpha"

        # 4. Floor CRUD
        r = auth_client.post(f"{P}/floors", json={"tower_id": tid, "floor_number": 2, "label": "2nd Floor"})
        assert r.status_code == 201
        fid = r.json()["data"]["id"]

        r = auth_client.get(f"{P}/floors/{fid}")
        assert r.status_code == 200

        r = auth_client.patch(f"{P}/floors/{fid}", json={"label": "Level 2"})
        assert r.status_code == 200
        assert r.json()["data"]["label"] == "Level 2"

        # 5. Unit CRUD & Community-wide listing
        r = auth_client.post(f"{P}/units", json={"floor_id": fid, "unit_number": "A-201", "bedrooms": 2})
        assert r.status_code == 201
        uid = r.json()["data"]["id"]

        r = auth_client.get(f"{P}/units/{uid}")
        assert r.status_code == 200

        r = auth_client.patch(f"{P}/units/{uid}", json={"bedrooms": 3})
        assert r.status_code == 200
        assert r.json()["data"]["bedrooms"] == 3

        # Community-wide units endpoint
        r = auth_client.get(f"{P}/{cid}/units")
        assert r.status_code == 200
        body = r.json()
        assert body["success"] is True
        assert body["meta"]["total"] >= 1
        assert any(u["id"] == uid for u in body["data"])

        # Filtered by tower
        r = auth_client.get(f"{P}/{cid}/units?tower_id={tid}")
        assert r.status_code == 200
        assert r.json()["meta"]["total"] >= 1

        # Delete Unit
        assert auth_client.delete(f"{P}/units/{uid}").status_code == 204
        assert auth_client.get(f"{P}/units/{uid}").status_code == 404

        # Delete Floor
        assert auth_client.delete(f"{P}/floors/{fid}").status_code == 204
        assert auth_client.get(f"{P}/floors/{fid}").status_code == 404

        # Delete Tower
        assert auth_client.delete(f"{P}/towers/{tid}").status_code == 204
        assert auth_client.get(f"{P}/towers/{tid}").status_code == 404

        # Delete Gate
        assert auth_client.delete(f"{P}/gates/{gid}").status_code == 204
        assert auth_client.get(f"{P}/gates/{gid}").status_code == 404

    finally:
        auth_client.delete(f"{P}/{cid}")
