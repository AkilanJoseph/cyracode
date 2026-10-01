"""Azure App Service entrypoint for the CyraCode API.

App Service (Linux, PYTHON|3.11) starts the app with this Startup Command:

    python3 -m app.launcher

It exists because the Oryx runtime places ``/agents/python`` — which contains an
older bundled ``typing_extensions`` — on ``PYTHONPATH`` *ahead* of the
site-packages of the virtualenv Oryx built from ``requirements.txt``. The venv's
own ``typing_extensions`` is therefore never the one that gets imported, which
broke the app two different ways:

* ``anyio`` 4.12+ does ``from typing_extensions import sentinel`` (a 4.13
  addition), so the process died at import with
  ``ImportError: cannot import name 'sentinel' from 'typing_extensions'``.

A second, unrelated 500 had the same "only some routes fail" signature
(``/health`` and ``/`` worked, ``/billing/plans`` and ``/registration/count``
did not) and a different cause: App Service auto-instruments the app with an
OpenTelemetry agent bundled in the image at
``/agents/python/common/opentelemetry``. Its FastAPI instrumentation resolves
``scope["route"].path`` in ``_get_route_details`` to build the span name, but
FastAPI 0.141 models an included router as ``_IncludedRouter``
(``fastapi/routing.py``), which has no ``path``. Every request that reached the
agent therefore raised

    AttributeError: '_IncludedRouter' object has no attribute 'path'

and returned 500. That fix is an app setting rather than a dependency pin:
``OTEL_PYTHON_DISABLED_INSTRUMENTATIONS=fastapi``. It must be set on the App
Service, so it is not captured by anything in this repository -- without it the
API 500s on every request.

This lives in an importable module rather than a deployed ``startup.sh`` because
App Service only honours the configured Startup Command, and that command cannot
rely on shell pipelines surviving the platform's command wrapper.
"""

import os
import sys

# Drop the build-agent shim directories so the Oryx-built virtualenv wins.
sys.path[:] = [p for p in sys.path if not p.startswith("/agents/python")]

import uvicorn  # noqa: E402  (import must follow the sys.path fix)

if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=int(os.environ.get("WEBSITES_PORT", "8000")),
        proxy_headers=True,
        forwarded_allow_ips="*",
    )
