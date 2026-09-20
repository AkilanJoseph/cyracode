import os
import uuid

from slowapi import Limiter
from slowapi.util import get_remote_address


def _key_func(request):
    if os.environ.get("TESTING", "").lower() in ("1", "true", "yes"):
        return str(uuid.uuid4())  # unique per-request → disables rate limiting in tests
    return get_remote_address(request)


# In-memory by default. On a multi-instance App Service deployment set
# LIMITER_STORAGE_URI=redis://... so limits are shared across instances.
_storage_uri = os.environ.get("LIMITER_STORAGE_URI", "memory://")

limiter = Limiter(
    key_func=_key_func,
    default_limits=["100/minute"],
    storage_uri=_storage_uri,
)
