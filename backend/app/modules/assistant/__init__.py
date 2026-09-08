"""Assistant / Chatbot Module (FR-14 & FR-19).

Unified conversational AI assistant & knowledge base engine for GateSphere.
Supports role-tailored greetings, community FAQ matching, dynamic account lookup,
and self-service workflows.
"""

from app.modules.assistant.router import router

__all__ = ["router"]
