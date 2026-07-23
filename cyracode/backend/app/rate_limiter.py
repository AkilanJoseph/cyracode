import os
import uuid

from slowapi import Limiter
from slowapi.util import get_remote_address


def _key_func(request):
    if os.environ.get("TESTING", "").lower() in ("1", "true", "yes"):
        return str(uuid.uuid4())  # unique per-request → disables rate limiting in tests
    return get_remote_address(request)


limiter = Limiter(key_func=_key_func, default_limits=["100/minute"])
