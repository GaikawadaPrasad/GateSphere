"""Import every model module so Alembic autogenerate sees the full metadata.

Add a line here whenever a module gains real ORM models.
"""

from app.db.base_class import Base  # noqa: F401
from app.modules.audit import models as audit_models  # noqa: F401
from app.modules.auth import models as auth_models  # noqa: F401
from app.modules.billing import models as billing_models  # noqa: F401
from app.modules.communities import models as communities_models  # noqa: F401
from app.modules.deliveries import models as deliveries_models  # noqa: F401
from app.modules.domestic_staff import models as domestic_staff_models  # noqa: F401
from app.modules.gate import models as gate_models  # noqa: F401
from app.modules.residents import models as residents_models  # noqa: F401
from app.modules.users import models as users_models  # noqa: F401
from app.modules.vehicles import models as vehicles_models  # noqa: F401
from app.modules.visitors import models as visitors_models  # noqa: F401
