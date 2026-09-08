# Auditor Module 10: Reports

## Purpose
Enables export of formal compliance audit reports, certificate summaries for housing association AGMs, and downloadable CSV datasets for external regulatory reporting.

## Key Data Fields
- `report_type`: Financial Reconciliation, Security Gate SLA, or Access Governance
- `period`: Date window audited (Monthly, Quarterly, Annual)
- `generated_at`: Timestamp of report generation
- `auditor_signoff`: Cryptographic hash / name of reviewing auditor
- `compliance_rating`: Percentage score (`99.8%`)

## API Endpoints
- `GET /api/v1/audit/reports/summary`
- `GET /api/v1/audit/logs.csv`
