"""FastAPI entry point.

Option B (see docs/architecture): one process serves the JSON API under /api
and the built React app under /. Feature modules (requests, inventory,
distribution, reports) are added as routers under app/api/.
"""

from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.api import health
from app.core.config import settings

app = FastAPI(title=settings.app_name, docs_url="/api/docs", openapi_url="/api/openapi.json")
app.include_router(health.router, prefix="/api")

static = Path(settings.static_dir)
if (static / "index.html").exists():
    app.mount("/assets", StaticFiles(directory=static / "assets"), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str) -> FileResponse:
        """Any non-API path returns the React app; React Router handles it."""
        if path.startswith("api/"):
            raise HTTPException(status_code=404)
        return FileResponse(static / "index.html")
