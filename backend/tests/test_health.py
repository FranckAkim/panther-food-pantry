from fastapi.testclient import TestClient

from app.api import health
from app.main import app

client = TestClient(app)


def test_health_returns_ok():
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_api_docs_are_served():
    assert client.get("/api/openapi.json").status_code == 200


def test_database_readiness_when_available(monkeypatch):
    monkeypatch.setattr(health, "database_is_up", lambda: True)
    response = client.get("/api/health/db")
    assert response.status_code == 200
    assert response.json() == {"database": "ok"}


def test_database_failure_does_not_fail_process_health(monkeypatch):
    monkeypatch.setattr(health, "database_is_up", lambda: False)
    response = client.get("/api/health/db")
    assert response.status_code == 503
    assert response.json() == {"database": "unreachable"}
    assert client.get("/api/health").status_code == 200
