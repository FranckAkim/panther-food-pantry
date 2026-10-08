from fastapi import APIRouter, Response, status

from app.db.session import database_is_up

router = APIRouter(tags=["health"])


@router.get("/health")
def health() -> dict:
    """Liveness: the process is running. Used by the uptime monitor."""
    return {"status": "ok"}


@router.get("/health/db")
def health_db(response: Response) -> dict:
    """Readiness: the database answers a trivial query."""
    if database_is_up():
        return {"database": "ok"}
    response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    return {"database": "unreachable"}
