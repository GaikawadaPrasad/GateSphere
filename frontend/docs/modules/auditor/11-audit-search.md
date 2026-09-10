# Auditor Module 11: Audit Search

## Purpose

Provides a high-speed multi-criteria global search engine querying across system logs, gate events, user histories, and payment records simultaneously.

## Key Data Fields

- `search_query`: Free-text input string matching keywords, IP addresses, license plates, or names
- `date_range`: ISO start and end bounds
- `module_filter`: Specific subsystem restriction
- `results_count`: Total matches found across indexed tables

## API Endpoints

- `GET /api/v1/audit/logs?search={query}&since={start}&until={end}`
