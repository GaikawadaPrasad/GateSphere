import urllib.request
import urllib.error
import json
import csv
import base64

token = "06f10287c3aecda1d65b43a21a1febde41437e79"
project_key = "johnalexanderkondepoguVPD_GateSphere"
url = f"https://sonarcloud.io/api/issues/search?componentKeys={project_key}&ps=500"

auth_str = f"{token}:"
auth_bytes = auth_str.encode("utf-8")
auth_b64 = base64.b64encode(auth_bytes).decode("utf-8")

req = urllib.request.Request(url)
req.add_header("Authorization", f"Basic {auth_b64}")

try:
    with urllib.request.urlopen(req) as response:
        if response.status == 200:
            data = json.loads(response.read().decode('utf-8'))
            issues = data.get('issues', [])
            
            output_file = "sonar_report.csv"
            with open(output_file, "w", newline='', encoding='utf-8') as f:
                writer = csv.writer(f)
                writer.writerow(["Key", "Rule", "Severity", "Status", "Message", "Component", "Line"])
                for issue in issues:
                    writer.writerow([
                        issue.get("key"),
                        issue.get("rule"),
                        issue.get("severity"),
                        issue.get("status"),
                        issue.get("message"),
                        issue.get("component"),
                        issue.get("line", "")
                    ])
            print(f"SUCCESS: Exported {len(issues)} issues to {output_file}")
        else:
            print(f"FAILED with status: {response.status}")
except urllib.error.URLError as e:
    # Try reading the error body
    if hasattr(e, 'read'):
        print(f"ERROR: {e.code} - {e.read().decode('utf-8')}")
    else:
        print(f"ERROR: {e}")
