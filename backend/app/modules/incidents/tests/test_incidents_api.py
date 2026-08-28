"""Integration tests — Incidents router, RBAC, tenant scope."""

from __future__ import annotations

import uuid

P = "/api/v1/incidents"


def test_health(client):
    assert client.get(f"{P}/health").json()["data"]["module"] == "incidents"


def test_list_needs_auth(client):
    assert client.get(P).status_code == 401


def test_resident_reports_supervisor_handles(as_role, seed_ids):
    resident = as_role("resident")
    r = resident.post(
        P,
        json={
            "incident_type": "lift_entrapment",
            "severity": "critical",
            "location_text": "Tower A lift 2",
            "community_id": seed_ids["community_id"],
        },
    )
    assert r.status_code == 201, r.text
    iid = r.json()["data"]["id"]

    sup = as_role("security_supervisor")
    assert sup.post(f"{P}/{iid}/transition", json={"status": "acknowledged"}).status_code == 200
    assert sup.post(f"{P}/{iid}/actions", json={"action_type": "dispatch"}).status_code == 201
    resolve = sup.post(
        f"{P}/{iid}/transition",
        json={"status": "responding"},
    )
    assert resolve.status_code == 200
    done = sup.post(
        f"{P}/{iid}/transition",
        json={"status": "resolved", "resolution_summary": "Freed occupants"},
    )
    assert done.status_code == 200 and done.json()["data"]["status"] == "resolved"


def test_resident_cannot_transition(as_role, seed_ids):
    resident = as_role("resident")
    iid = resident.post(
        P,
        json={"incident_type": "other", "community_id": seed_ids["community_id"]},
    ).json()["data"]["id"]
    assert (
        resident.post(f"{P}/{iid}/transition", json={"status": "acknowledged"}).status_code == 403
    )


def test_cross_community_gate_reference_is_404(as_role, seed_ids):
    sup = as_role("security_supervisor")
    r = sup.post(
        P,
        json={
            "incident_type": "breach",
            "gate_id": str(uuid.uuid4()),
            "community_id": seed_ids["community_id"],
        },
    )
    assert r.status_code == 404


def test_incident_attachments(as_role, seed_ids):
    resident = as_role("resident")
    iid = resident.post(
        P, json={"incident_type": "other", "community_id": seed_ids["community_id"]}
    ).json()["data"]["id"]
    sup = as_role("security_supervisor")
    _u = "http://localhost:9000/gatesphere-local/incidents/evidence/x/x.png"
    r = sup.post(f"{P}/{iid}/attachments", json={"file_url": _u, "file_name": "x.png"})
    assert r.status_code == 201, r.text
    assert sup.get(f"{P}/{iid}/attachments").json()["data"][0]["file_name"] == "x.png"
