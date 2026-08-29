"""Aggregate API router — one include per domain module."""

from __future__ import annotations

from fastapi import APIRouter

from app.modules.amenities.router import router as amenities_router
from app.modules.audit.router import router as audit_router
from app.modules.auth.router import router as auth_router
from app.modules.billing.router import router as billing_router
from app.modules.communication.router import router as communication_router
from app.modules.communities.router import router as communities_router
from app.modules.complaints.router import router as complaints_router
from app.modules.dashboards.router import router as dashboards_router
from app.modules.deliveries.router import router as deliveries_router
from app.modules.domestic_staff.router import router as domestic_staff_router
from app.modules.gate.router import router as gate_router
from app.modules.incidents.router import router as incidents_router
from app.modules.notifications.router import router as notifications_router
from app.modules.onboarding.router import router as onboarding_router
from app.modules.rbac.router import router as rbac_router
from app.modules.residents.router import router as residents_router
from app.modules.uploads.router import router as uploads_router
from app.modules.users.router import router as users_router
from app.modules.vehicles.router import router as vehicles_router
from app.modules.visitors.router import router as visitors_router

api_router = APIRouter()
for r in (
    auth_router,
    users_router,
    communities_router,
    residents_router,
    visitors_router,
    gate_router,
    domestic_staff_router,
    deliveries_router,
    vehicles_router,
    billing_router,
    complaints_router,
    amenities_router,
    communication_router,
    incidents_router,
    notifications_router,
    audit_router,
    dashboards_router,
    uploads_router,
    rbac_router,
    onboarding_router,
):
    api_router.include_router(r)
