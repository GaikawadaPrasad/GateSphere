#!/usr/bin/env python3
"""Generate the GateSphere Postman collection + environment from the LIVE route table.

Run from a machine that can import the backend app (or inside the container):

    docker compose exec backend python docs/postman/build_collection.py

It introspects `app.main.app` — never a hand-written route list — so the collection can
never drift from the code. Re-run it whenever routes change (AGENTS.md rule).

Output:
    docs/postman/GateSphere_API.postman_collection.json
    docs/postman/gate_sphere.postman_environment.json
"""
from __future__ import annotations

import inspect
import json
import pathlib
import re

import app.main as m
from fastapi.routing import APIRoute

HERE = pathlib.Path(__file__).parent

# module -> (folder number/name, default role the smoke request logs in as)
FOLDERS: dict[str, tuple[str, str]] = {
    "ops": ("00 Health", "public"),
    "auth": ("01 Authentication", "public"),
    "rbac": ("02 RBAC", "superadmin"),
    "communities": ("03 Community", "superadmin"),
    "onboarding": ("03 Community", "superadmin"),
    "residents": ("05 Residents", "community_admin"),
    "users": ("02 RBAC", "superadmin"),
    "visitors": ("06 Visitors", "community_admin"),
    "gate": ("07 Gate", "security"),
    "domestic_staff": ("08 Domestic Staff", "community_admin"),
    "deliveries": ("09 Delivery", "security"),
    "vehicles": ("10 Vehicles & Parking", "community_admin"),
    "billing": ("12 Billing", "community_admin"),
    "complaints": ("14 Complaints & SLA", "community_admin"),
    "amenities": ("16 Amenities", "community_admin"),
    "communication": ("17 Communication", "community_admin"),
    "incidents": ("18 Incidents", "security"),
    "notifications": ("19 Notifications", "community_admin"),
    "dashboards": ("20 Dashboards", "community_admin"),
    "audit": ("23 Audit", "auditor"),
    "uploads": ("22 Uploads", "community_admin"),
}

# role slug -> (cookie bucket, X-Session-Role header value, env var prefix)
ROLES = {
    "superadmin": ("superadmin", "super_admin", "superadmin"),
    "community_admin": ("community_admin", "community_admin", "community_admin"),
    "security": ("security", "security_guard", "security"),
    "resident": ("resident", "resident", "resident"),
    "facility_manager": ("facility_manager", "facility_manager", "facility_manager"),
    "auditor": ("auditor", "auditor", "auditor"),
}

# path-param name -> env var it reads from (best-effort; falls back to same name)
PARAM_VARS = {
    "community_id": "community_id",
    "tower_id": "tower_id",
    "floor_id": "floor_id",
    "unit_id": "unit_id",
    "profile_id": "resident_id",
    "request_id": "visitor_request_id",
    "pass_id": "visitor_pass_id",
    "entry_id": "visitor_entry_id",
    "staff_id": "staff_id",
    "assignment_id": "assignment_id",
    "attendance_id": "attendance_id",
    "delivery_id": "delivery_id",
    "vehicle_id": "vehicle_id",
    "allocation_id": "allocation_id",
    "violation_id": "violation_id",
    "invoice_id": "invoice_id",
    "payment_id": "payment_id",
    "charge_head_id": "charge_head_id",
    "ticket_id": "complaint_id",
    "category_id": "category_id",
    "amenity_id": "amenity_id",
    "slot_id": "slot_id",
    "booking_id": "booking_id",
    "announcement_id": "notice_id",
    "poll_id": "poll_id",
    "group_id": "group_id",
    "member_id": "member_id",
    "incident_id": "incident_id",
    "action_id": "action_id",
    "notification_id": "notification_id",
    "roster_id": "roster_id",
    "alert_id": "alert_id",
    "log_id": "log_id",
    "user_id": "user_id",
    "grant_id": "grant_id",
    "contact_id": "contact_id",
    "move_id": "move_id",
    "occupancy_id": "occupancy_id",
    "file_id": "file_id",
    "invitation_id": "invitation_id",
    "code": "perm_code",
    "slug": "role_slug",
    "token": "invitation_token",
}


def _closure_strs(fn):
    out = []
    for cell in getattr(fn, "__closure__", None) or []:
        try:
            v = cell.cell_contents
            if isinstance(v, str):
                out.append(v)
        except ValueError:
            pass
    return out


def _perm(route: APIRoute) -> tuple[str | None, bool, bool]:
    perm, padmin, auth = None, False, False

    def walk(dep):
        nonlocal perm, padmin, auth
        for sub in dep.dependencies:
            qn = getattr(sub.call, "__qualname__", "") or ""
            nm = getattr(sub.call, "__name__", "") or ""
            if "require_permission_async" in qn:
                for s in _closure_strs(sub.call):
                    if ":" in s:
                        perm = s
            if "require_platform_admin" in qn or nm == "require_platform_admin":
                padmin = True
            if nm in ("require_auth_async", "optional_user") or "tenant_scope" in qn or (
                "async_tenant_context" in qn
            ):
                auth = True
            walk(sub)

    walk(route.dependant)
    return perm, padmin, auth


def _url(path: str) -> dict:
    # api prefix is stable (/api/v1); bake it into the segments so there is never a
    # `{{base_url}}//api/v1` double-slash from variable expansion.
    raw_path, _, query = path.partition("?")
    parts = raw_path.strip("/").split("/")
    out_parts, variables = [], []
    for p in parts:
        mt = re.fullmatch(r"\{([a-zA-Z_]+)\}", p)
        if mt:
            var = PARAM_VARS.get(mt.group(1), mt.group(1))
            out_parts.append(f":{mt.group(1)}")
            variables.append({"key": mt.group(1), "value": f"{{{{{var}}}}}"})
        else:
            out_parts.append(p)
    raw = "{{base_url}}/" + "/".join(out_parts)
    u = {"raw": raw + (f"?{query}" if query else ""), "host": ["{{base_url}}"], "path": out_parts}
    if query:
        u["query"] = [
            {"key": k, "value": v}
            for k, _, v in (kv.partition("=") for kv in query.split("&"))
        ]
    if variables:
        u["variable"] = variables
    return u


def _pre_request(role: str) -> list[str]:
    if role == "public":
        return []
    # Newman runs each script in its own sandbox — a function defined in the collection
    # pre-request is NOT visible here. So we pull the helper source from a collection
    # variable and eval it, then call it.
    return [
        "eval(pm.collectionVariables.get('_session_helper'));",
        f"ensureSession('{role}');",
    ]


def _tests(method: str, name: str, status_code) -> list[str]:
    ok = {"POST": [200, 201], "DELETE": [200, 204], "PUT": [200, 201]}.get(method, [200])
    lines = [
        "const ok = pm.response.code < 300;",
        f"pm.test('{name} -> 2xx or a documented 4xx', function () {{",
        "  pm.expect(pm.response.code).to.be.oneOf("
        f"{ok}.concat([400,401,403,404,405,409,422]));",
        "});",
        "if (ok && pm.response.headers.get('content-type') || '' ) {",
        "  try {",
        "    const b = pm.response.json();",
        "    pm.test('canonical envelope', function () {",
        "      pm.expect(b).to.have.property('success');",
        "    });",
        "    const id = b && b.data && (b.data.id || (b.data.data && b.data.data.id));",
        "    if (id && pm.response.code === 201) {",
        f"      pm.collectionVariables.set('_last_{name}_id', id);",
        "    }",
        "  } catch (e) {}",
        "}",
    ]
    return lines


def build():
    routes = [r for r in m.app.routes if isinstance(r, APIRoute)]
    folders: dict[str, dict] = {}
    for r in sorted(routes, key=lambda r: (r.path, sorted(r.methods))):
        mod = r.endpoint.__module__
        module = mod.split(".")[-2] if ".modules." in mod else "ops"
        folder_name, role = FOLDERS.get(module, ("99 Other", "superadmin"))
        perm, padmin, auth = _perm(r)
        if padmin:
            role = "superadmin"
        if r.path in ("/", "/healthz", "/readyz") or r.path.endswith("/health"):
            role = "public"
        if r.path == "/api/v1/auth/login":
            role = "public"
        f = folders.setdefault(
            folder_name,
            {"name": folder_name, "item": []},
        )
        for method in sorted(r.methods - {"HEAD", "OPTIONS"}):
            gate = "platform-admin" if padmin else (perm or ("session" if auth else "public"))
            desc = (
                f"**{method} {r.path}**\n\n"
                f"- Module: `{module}`\n"
                f"- Auth: {'session cookie' if auth or perm or padmin else 'none (public)'}\n"
                f"- Required: `{gate}`\n"
                f"- Session: `{role}`\n\n"
                f"Auto-generated from the live route table by `docs/postman/build_collection.py`. "
                f"Fill the request body / path variables before running individually; the "
                f"`_Workflow` folder wires the ids for a full run."
            )
            item = {
                "name": f"{method} {r.path.replace('/api/v1', '')}",
                "request": {
                    "method": method,
                    "header": (
                        []
                        if role == "public"
                        else [
                            {"key": "X-Session-Role", "value": ROLES[role][1]},
                            {"key": "X-CSRF-Token", "value": "{{csrf}}"},
                        ]
                    ),
                    "url": _url(r.path),
                    "description": desc,
                },
                "event": [
                    {
                        "listen": "prerequest",
                        "script": {"type": "text/javascript", "exec": _pre_request(role)},
                    },
                    {
                        "listen": "test",
                        "script": {
                            "type": "text/javascript",
                            "exec": _tests(method, item_name := f"{method} {r.path}", r.status_code),
                        },
                    },
                ],
            }
            if method in ("POST", "PUT", "PATCH"):
                item["request"]["body"] = {
                    "mode": "raw",
                    "raw": "{}",
                    "options": {"raw": {"language": "json"}},
                }
            f["item"].append(item)

    collection = {
        "info": {
            "name": "GateSphere API",
            "description": (
                "Complete GateSphere backend API — every route, generated from the live "
                "FastAPI app by `docs/postman/build_collection.py`.\n\n"
                "**Multi-role sessions:** each request logs in as its own role via "
                "`ensureSession(role)` (collection pre-request script) and sends "
                "`X-Session-Role`. Sessions live in Postman's cookie jar — no `{{token}}` "
                "variable. Do NOT collapse the roles into one session.\n\n"
                "Run order: `00 Health` -> `01 Authentication` -> `_Workflow` (creates + "
                "saves ids) -> the module folders -> `_Negative`."
            ),
            "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
        },
        "item": [],
        "variable": [
            {"key": "csrf", "value": ""},
            {"key": "_session_helper", "value": _SESSION_HELPER},
        ],
        "event": [
            {
                "listen": "prerequest",
                "script": {
                    "type": "text/javascript",
                    "exec": [
                        "// keep the shared helper source available to every request sandbox",
                        "if (!pm.collectionVariables.get('_session_helper')) {",
                        "  console.log('session helper missing — re-import the collection');",
                        "}",
                    ],
                },
            }
        ],
    }
    # prepend the real per-role login requests to the Authentication folder so Newman's
    # cookie jar is primed before any other folder runs
    auth = folders.setdefault("01 Authentication", {"name": "01 Authentication", "item": []})
    auth["item"] = _auth_folder_items() + auth["item"]

    # deterministic folder order
    for name in sorted(folders):
        collection["item"].append(folders[name])
    collection["item"].append(_workflow_folder())
    collection["item"].append(_negative_folder())

    (HERE / "GateSphere_API.postman_collection.json").write_text(
        json.dumps(collection, indent=2), encoding="utf-8"
    )
    (HERE / "gate_sphere.postman_environment.json").write_text(
        json.dumps(_environment(), indent=2), encoding="utf-8"
    )
    total = sum(len(f["item"]) for f in folders.values())
    print(f"wrote collection ({total} generated requests + workflow + negative) and environment")


_SESSION_HELPER = """
// ------ multi-role session helper (no {{token}} variable) ------
// eval'd into each request pre-request sandbox. Real login requests in folder
// '01 Authentication' populate Newman's cookie jar + the csrf_<role> vars; this only
// points {{csrf}} at the active role.
function ensureSession(key) {
  var t = pm.collectionVariables.get('csrf_' + key);
  if (t) { pm.collectionVariables.set('csrf', t); }
  else { console.log('no session for ' + key + ' - run the 01 Authentication folder first'); }
}
""".strip()


def _login_tests(bucket, key):
    return [
        "pm.test('login ok', () => pm.expect(pm.response.code).to.be.oneOf([200, 429]));",
        "if (pm.response.code === 200) {",
        "  var hs = pm.response.headers.all().filter(h => h.key.toLowerCase() === 'set-cookie');",
        "  var csrf = '';",
        "  hs.forEach(function (h) { var m = h.value.match(/gatesphere_%s_csrf=([^;]+)/); if (m) csrf = m[1]; });" % bucket,
        "  if (csrf) pm.collectionVariables.set('csrf_%s', csrf);" % key,
        "  var b = pm.response.json();",
        "  pm.test('bucket = %s', () => pm.expect(b.data.session_bucket).to.eql('%s'));" % (bucket, bucket),
        "}",
    ]


def _auth_folder_items():
    order = [
        ("superadmin", "superadmin", "super_admin"),
        ("community_admin", "community_admin", "community_admin"),
        ("security", "security", "security_guard"),
        ("resident", "resident", "resident"),
        ("facility_manager", "facility_manager", "facility_manager"),
        ("auditor", "auditor", "auditor"),
    ]
    out = []
    for key, bucket, role in order:
        out.append(_req(
            "Login as " + key, "POST", "/api/v1/auth/login", "public",
            body=json.dumps({"email": "{{%s_email}}" % key, "password": "{{%s_password}}" % key, "role": role}),
            tests=_login_tests(bucket, key),
        ))
    return out



def _environment():
    demo = lambda slug: f"{slug}@Gate2026!"  # noqa: E731
    vals = [
        ("base_url", "http://localhost:8001"),
        ("api_prefix", "/api/v1"),
    ]
    for slug, prefix in [
        ("super_admin", "superadmin"),
        ("community_admin", "community_admin"),
        ("security_guard", "security"),
        ("resident", "resident"),
        ("facility_manager", "facility_manager"),
        ("auditor", "auditor"),
    ]:
        vals.append((f"{prefix}_email", f"{slug}@gatesphere.com"))
        vals.append((f"{prefix}_password", demo(slug)))
    for v in sorted(set(PARAM_VARS.values())):
        vals.append((v, ""))
    for extra in [
        "other_community_id",
        "invitation_token",
    ]:
        vals.append((extra, ""))
    # NB: `csrf` and `csrf_<role>` live ONLY as collection variables — an environment
    # variable of the same name would shadow the value the pre-request script sets.
    return {
        "name": "gate_sphere",
        "values": [
            {"key": k, "value": v, "type": "secret" if "password" in k else "default", "enabled": True}
            for k, v in vals
        ],
        "_postman_variable_scope": "environment",
    }


def _req(name, method, path, role, body=None, tests=None, headers=None):
    headers = headers or []
    custom_csrf = any(h["key"].lower() == "x-csrf-token" for h in headers)
    hdr = [{"key": "X-Session-Role", "value": ROLES[role][1]}] if role != "public" else []
    if method in ("POST", "PUT", "PATCH", "DELETE") and role != "public" and not custom_csrf:
        hdr.append({"key": "X-CSRF-Token", "value": "{{csrf}}"})
    hdr += headers
    item = {
        "name": name,
        "event": [
            {"listen": "prerequest", "script": {"type": "text/javascript", "exec": _pre_request(role)}},
            {"listen": "test", "script": {"type": "text/javascript", "exec": tests or ["pm.test('ok', () => pm.expect(pm.response.code).to.be.below(500));"]}},
        ],
        "request": {"method": method, "header": hdr, "url": _url(path)},
    }
    if body is not None:
        item["request"]["body"] = {"mode": "raw", "raw": body, "options": {"raw": {"language": "json"}}}
    return item


def _workflow_folder():
    save = lambda var, jsonpath: [
        f"const b = pm.response.json();",
        f"pm.test('created', () => pm.expect(pm.response.code).to.be.oneOf([200,201]));",
        f"if (b && b.data) pm.environment.set('{var}', {jsonpath});",
    ]
    items = [
        _req("Health: readyz", "GET", "/readyz", "public",
             tests=["pm.test('ready', () => pm.expect(pm.response.code).to.be.oneOf([200,503]));"]),
        _req("Login super_admin", "POST", "/api/v1/auth/login", "public",
             body='{"email":"{{superadmin_email}}","password":"{{superadmin_password}}","role":"super_admin"}',
             tests=["pm.test('logged in', () => pm.response.to.have.status(200));",
                    "const sc = pm.response.headers.all().filter(h=>h.key.toLowerCase()==='set-cookie');",
                    "let c=''; sc.forEach(x=>{const m=x.value.match(/gatesphere_superadmin_csrf=([^;]+)/); if(m) c=m[1];});",
                    "if(c){pm.collectionVariables.set('csrf_superadmin', c); pm.collectionVariables.set('csrf', c);}"]),
        _req("Create community", "POST", "/api/v1/communities", "superadmin",
             body='{"name":"Postman Community {{$timestamp}}","code":"PM{{$randomInt}}","city":"Test","timezone":"UTC"}',
             tests=save("community_id", "b.data.id")),
        _req("Create tower", "POST", "/api/v1/communities/{{community_id}}/towers", "superadmin",
             body='{"name":"Tower P","code":"TP","total_floors":3}', tests=save("tower_id", "b.data.id")),
        _req("Create floor", "POST", "/api/v1/communities/floors", "superadmin",
             body='{"tower_id":"{{tower_id}}","floor_number":1,"label":"L1"}', tests=save("floor_id", "b.data.id")),
        _req("Create unit", "POST", "/api/v1/communities/units", "superadmin",
             body='{"floor_id":"{{floor_id}}","unit_number":"P-101","unit_type":"apartment","bedrooms":2}',
             tests=save("unit_id", "b.data.id")),
        _req("Create visitor request", "POST", "/api/v1/visitors/requests", "superadmin",
             body='{"unit_id":"{{unit_id}}","visitor":{"full_name":"Guest","phone":"+19999999999"},"visitor_type":"personal_guest"}',
             tests=save("visitor_request_id", "b.data.id")),
        _req("Approve visitor request", "POST", "/api/v1/visitors/requests/{{visitor_request_id}}/decision", "superadmin",
             body='{"decision":"approved"}'),
        _req("Issue pass", "POST", "/api/v1/visitors/requests/{{visitor_request_id}}/passes", "superadmin",
             body='{"pass_type":"qr"}', tests=save("visitor_pass_id", "b.data.id")),
        _req("Create charge head", "POST", "/api/v1/billing/charge-heads?community_id={{community_id}}", "superadmin",
             body='{"code":"MAINT","name":"Maintenance","calculation_type":"flat","default_amount":"1000.00"}',
             tests=save("charge_head_id", "b.data.id")),
        _req("Create invoice", "POST", "/api/v1/billing/invoices?community_id={{community_id}}", "superadmin",
             body='{"unit_id":"{{unit_id}}","items":[{"description":"Jan maintenance","charge_head_id":"{{charge_head_id}}","unit_rate":"1000.00"}]}',
             tests=save("invoice_id", "b.data.id")),
        _req("Post invoice", "POST", "/api/v1/billing/invoices/{{invoice_id}}/post", "superadmin"),
        _req("Record payment", "POST", "/api/v1/billing/payments?community_id={{community_id}}", "superadmin",
             body='{"amount":"1000.00","payment_method":"upi","allocations":[{"invoice_id":"{{invoice_id}}","amount":"1000.00"}]}',
             tests=["var b=pm.response.json();",
                    "pm.test('payment recorded (or 422 if the invoice chain did not post)', () => pm.expect(pm.response.code).to.be.oneOf([201,422]));",
                    "if(b&&b.data&&b.data.id) pm.environment.set('payment_id', b.data.id);"]),
        _req("Create complaint category", "POST", "/api/v1/complaints/categories?community_id={{community_id}}", "superadmin",
             body='{"code":"PLUMB","name":"Plumbing"}', tests=save("category_id", "b.data.id")),
        _req("Create ticket", "POST", "/api/v1/complaints/tickets", "superadmin",
             body='{"unit_id":"{{unit_id}}","category_id":"{{category_id}}","subject":"Leak"}', tests=save("complaint_id", "b.data.id")),
        _req("Transition ticket -> assigned then in_progress", "POST", "/api/v1/complaints/tickets/{{complaint_id}}/transition", "superadmin",
             body='{"status":"assigned"}',
             tests=["pm.test('transition attempted', () => pm.expect(pm.response.code).to.be.below(500));"]),
        _req("Create incident", "POST", "/api/v1/incidents", "superadmin",
             body='{"community_id":"{{community_id}}","incident_type":"breach","severity":"high","location_text":"Gate"}',
             tests=save("incident_id", "b.data.id")),
        _req("Transition incident -> acknowledged", "POST", "/api/v1/incidents/{{incident_id}}/transition", "superadmin",
             body='{"status":"acknowledged"}'),
        _req("Create amenity", "POST", "/api/v1/amenities?community_id={{community_id}}", "superadmin",
             body='{"code":"POOL","name":"Pool","amenity_type":"pool","capacity":10}',
             tests=save("amenity_id", "b.data.id")),
        _req("Create amenity slot", "POST", "/api/v1/amenities/{{amenity_id}}/slots", "superadmin",
             body='{"day_of_week":1,"start_time":"08:00","end_time":"09:00"}', tests=save("slot_id", "b.data.id")),
        _req("Create notice", "POST", "/api/v1/communication/announcements?community_id={{community_id}}", "superadmin",
             body='{"announcement_type":"notice","title":"PM notice","body":"hello","targets":[{"target_all_community":true}]}',
             tests=save("notice_id", "b.data.id")),
        _req("Publish notice -> notify residents", "POST", "/api/v1/communication/announcements/{{notice_id}}/publish", "superadmin"),
    ]
    return {"name": "_Workflow (run first - creates & saves ids)", "item": items,
            "description": "Ordered create-chain. Run this folder once; it populates the "
            "environment ids the module folders reference. Idempotent-ish (uses random codes)."}


def _negative_folder():
    items = [
        _req("No session -> 401", "GET", "/api/v1/visitors/requests", "public",
             tests=["pm.test('401', () => pm.response.to.have.status(401));"]),
        _req("Resident hits admin route -> 403", "POST", "/api/v1/communities", "resident",
             body='{"name":"x","code":"X1"}',
             tests=["pm.test('403', () => pm.response.to.have.status(403));"]),
        _req("Cross-community read -> 404", "GET", "/api/v1/communities/units/{{unit_id}}", "community_admin",
             headers=[{"key": "X-Community-Id", "value": "{{other_community_id}}"}],
             tests=["pm.test('404 or 403', () => pm.expect(pm.response.code).to.be.oneOf([403,404]));"]),
        _req("Invalid state transition rejected", "POST", "/api/v1/complaints/tickets/{{complaint_id}}/transition", "superadmin",
             body='{"status":"closed"}',
             tests=["pm.test('rejected (422 illegal move, or 404 if id unset)', () => pm.expect(pm.response.code).to.be.oneOf([404,422]));"]),
        _req("SQL injection payload -> 422/no leak", "GET", "/api/v1/visitors?q=%27%20OR%201%3D1--", "community_admin",
             tests=["pm.test('handled safely', () => pm.expect(pm.response.code).to.be.oneOf([200,422]));",
                    "pm.test('no SQL error leaked', () => pm.expect(pm.response.text()).to.not.match(/syntax error|psycopg|sqlalchemy/i));"]),
        _req("XSS payload stored-safe", "POST", "/api/v1/complaints/tickets", "community_admin",
             body='{"unit_id":"{{unit_id}}","category_id":"{{category_id}}","subject":"<script>alert(1)</script>"}',
             tests=["pm.test('accepted or rejected, never 500', () => pm.expect(pm.response.code).to.be.below(500));"]),
        _req("Auditor cannot write -> 403", "POST", "/api/v1/incidents", "auditor",
             body='{"community_id":"{{community_id}}","incident_type":"breach","severity":"low"}',
             tests=["pm.test('403', () => pm.response.to.have.status(403));"]),
        _req("Bad CSRF -> 403", "POST", "/api/v1/visitors/requests", "community_admin",
             body='{}', headers=[{"key": "X-CSRF-Token", "value": "wrong"}],
             tests=["pm.test('403 CSRF', () => pm.expect(pm.response.code).to.be.oneOf([403]));"]),
    ]
    return {"name": "_Negative (security)", "item": items,
            "description": "Controlled negative-path checks: missing/invalid session, wrong "
            "role, cross-tenant, invalid transition, SQLi/XSS payloads, CSRF. Non-destructive."}


if __name__ == "__main__":
    build()
