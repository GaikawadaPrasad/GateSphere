import requests

BASE = "http://localhost:8000/api/v1"

def test_login(email, password, role):
    s = requests.Session()
    r = s.post(f"{BASE}/auth/login", json={"email": email, "password": password, "role": role})
    print(f"Login {email} ({role}): status={r.status_code}, data={r.json().get('message')}")
    cookies = s.cookies.get_dict()
    print("Cookies:", cookies)
    return s, cookies

def test_resident():
    s, cookies = test_login("resident@gatesphere.com", "resident@Gate2026!", "resident")
    bucket = "resident"
    csrf_token = cookies.get(f"gatesphere_{bucket}_csrf")
    headers = {
        "X-CSRF-Token": csrf_token,
        "X-Session-Role": "resident",
    }
    # Test GET overview
    r = s.get(f"{BASE}/dashboards/resident", headers=headers)
    print("Resident dashboard GET:", r.status_code, r.json())

    # Test POST visitor request
    r = s.post(f"{BASE}/visitors/requests", json={
        "visitor_name": "Test Visitor",
        "phone": "+919876543210",
        "purpose": "Personal",
    }, headers=headers)
    print("Visitor request POST:", r.status_code, r.json())

    # Test POST panic alert
    r = s.post(f"{BASE}/gate/alerts", json={
        "alert_type": "medical",
        "severity": "high",
        "notes": "Test panic SOS alert from resident",
    }, headers=headers)
    print("Panic alert POST:", r.status_code, r.json())

if __name__ == "__main__":
    test_resident()
