import json
with open('openapi.json', 'r') as f:
    schema = json.load(f)

for path, ops in schema.get('paths', {}).items():
    print(f'Path: {path}')
    for op, details in ops.items():
        summary = details.get('summary', '')
        print(f'  {op.upper()}: {summary}')
