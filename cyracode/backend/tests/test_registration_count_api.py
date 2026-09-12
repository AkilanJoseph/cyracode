"""Tests for the public CyraCode registration count endpoint.

Displayed Count = REGISTRATION_COUNT_INITIAL (configurable baseline) +
Actual registered (active) CyraCodes. The actual count is derived from
committed rows so failed/duplicate/cancelled registrations never inflate it.
"""
import pytest

from app.config import settings
from tests.conftest import auth_headers, base_registration_payload, make_cyracode


class TestRegistrationCount:
    def test_returns_initial_baseline_when_no_registrations(self, client):
        resp = client.get("/registration/count")
        assert resp.status_code == 200
        body = resp.json()
        assert body["initial_count"] == 10000
        assert body["actual_count"] == 0
        assert body["display_count"] == 10000

    def test_public_endpoint_requires_no_auth(self, client):
        assert client.get("/registration/count").status_code == 200

    def test_initial_baseline_is_configurable(self, client, monkeypatch):
        monkeypatch.setattr(settings, "REGISTRATION_COUNT_INITIAL", 25000)
        body = client.get("/registration/count").json()
        assert body["initial_count"] == 25000
        assert body["display_count"] == 25000

    def test_display_count_adds_initial_and_actual(self, client, db):
        make_cyracode(db, "OneCode")
        make_cyracode(db, "TwoCode")
        body = client.get("/registration/count").json()
        assert body["initial_count"] == 10000
        assert body["actual_count"] == 2
        assert body["display_count"] == 10002

    def test_count_increases_after_successful_registration(self, client, db):
        headers = auth_headers(client)
        before = client.get("/registration/count").json()["actual_count"]

        resp = client.post(
            "/registration/traditional",
            json=base_registration_payload(),
            headers=headers,
        )
        assert resp.status_code == 201

        after = client.get("/registration/count").json()
        assert after["actual_count"] == before + 1
        assert after["display_count"] == after["initial_count"] + after["actual_count"]

    def test_failed_registration_does_not_increase_count(self, client, db):
        headers = auth_headers(client)

        # Duplicate name → 409, no row created
        make_cyracode(db, "MyHome")
        before = client.get("/registration/count").json()["actual_count"]
        resp = client.post(
            "/registration/traditional",
            json=base_registration_payload(),
            headers=headers,
        )
        assert resp.status_code == 409

        assert client.get("/registration/count").json()["actual_count"] == before

    def test_idempotent_resubmission_does_not_increase_count(self, client, db):
        headers = auth_headers(client)
        headers["X-Idempotency-Key"] = "count-idem-key-001"
        before = client.get("/registration/count").json()["actual_count"]

        resp1 = client.post(
            "/registration/traditional",
            json=base_registration_payload(),
            headers=headers,
        )
        assert resp1.status_code == 201

        resp2 = client.post(
            "/registration/traditional",
            json=base_registration_payload(),
            headers=headers,
        )
        assert resp2.status_code == 201
        assert resp2.json()["id"] == resp1.json()["id"]

        after = client.get("/registration/count").json()
        assert after["actual_count"] == before + 1

    def test_removed_cyracode_not_counted(self, client, db):
        headers = auth_headers(client)
        make_cyracode(db, "TempCode")
        assert client.get("/registration/count").json()["actual_count"] == 1

        from app.models.models import CyraCode
        entry = db.query(CyraCode).filter(CyraCode.code_name == "TempCode").first()
        entry.is_active = False
        db.commit()

        assert client.get("/registration/count").json()["actual_count"] == 0

    def test_count_consistent_across_requests(self, client, db):
        make_cyracode(db, "StableCode")
        first = client.get("/registration/count").json()
        second = client.get("/registration/count").json()
        assert first == second
        assert first["display_count"] == 10001