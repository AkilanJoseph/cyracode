"""Tests for the secure CyraCode Address Lookup API (GET /cyracode/{code}/address).

Covers the security contract:
  * not publicly accessible (401 without a credential)
  * authentication alone is NOT enough — a valid key without the
    cyracode.lookup permission gets 403
  * access is configurable (grant/revoke) without code changes
  * anti-enumeration: missing/inactive codes share one generic 404
  * every request is written to ClientAccessLogs
"""
from tests.conftest import make_api_client, make_cyracode

from app.models.models import ClientAccessLog


def _key(raw_key):
    return {"X-API-Key": raw_key}


class TestAuthentication:
    def test_no_credentials_returns_401(self, client):
        resp = client.get("/cyracode/SomeCode/address")
        assert resp.status_code == 401

    def test_invalid_key_returns_401(self, client):
        resp = client.get(
            "/cyracode/SomeCode/address", headers=_key("cyra_not-a-real-key")
        )
        assert resp.status_code == 401

    def test_deactivated_client_rejected(self, client, db):
        """is_active=False must invalidate the credential immediately."""
        api_client, raw_key = make_api_client(db, "Deactivated", permissions=["cyracode.lookup"])
        api_client.is_active = False
        db.commit()

        resp = client.get(
            "/cyracode/SomeCode/address", headers=_key(raw_key)
        )
        assert resp.status_code == 401

    def test_authenticated_but_not_authorized_returns_403(self, client, db):
        """A valid key WITHOUT cyracode.lookup permission must be rejected."""
        _api_client, raw_key = make_api_client(db, "NoPerms", permissions=[])

        resp = client.get("/cyracode/SomeCode/address", headers=_key(raw_key))
        assert resp.status_code == 403


class TestAuthorization:
    def test_authorized_client_gets_address(self, client, db):
        make_cyracode(
            db,
            "CYRA123456",
            lat=13.0827,
            lng=80.2707,
            country_code="IN",
            is_active=True,
        )
        _, raw_key = make_api_client(db, "Authorized", permissions=["cyracode.lookup"])
        resp = client.get("/cyracode/CYRA123456/address", headers=_key(raw_key))
        assert resp.status_code == 200
        body = resp.json()
        assert body["cyracode"] == "CYRA123456"
        addr = body["address"]
        assert addr["city"] == "Bangalore"
        assert addr["country"] == "India"
        assert addr["state"] == ""

    def test_revoke_permission_blocks_access(self, client, db):
        """Revoking the permission must block the SAME key — no code change."""
        make_cyracode(db, "RevokeTest")
        _, raw_key = make_api_client(db, "ToRevoke", permissions=["cyracode.lookup"])

        ok = client.get("/cyracode/RevokeTest/address", headers=_key(raw_key))
        assert ok.status_code == 200

        # Revoke through the admin flow: find the client, then hit the API.
        from app.models.models import ApiClient, ClientApiPermission

        api_client = db.query(ApiClient).filter(ApiClient.name == "ToRevoke").first()
        perm = (
            db.query(ClientApiPermission)
            .filter(
                ClientApiPermission.client_id == api_client.id,
                ClientApiPermission.permission == "cyracode.lookup",
            )
            .first()
        )
        assert perm is not None
        db.delete(perm)
        db.commit()

        blocked = client.get("/cyracode/RevokeTest/address", headers=_key(raw_key))
        assert blocked.status_code == 403

    def test_grant_permission_enables_access(self, client, db):
        """Granting the permission later must unlock the same key."""
        make_cyracode(db, "GrantTest")
        _client, raw_key = make_api_client(db, "ToGrant", permissions=[])

        blocked = client.get("/cyracode/GrantTest/address", headers=_key(raw_key))
        assert blocked.status_code == 403

        from app.models.models import ClientApiPermission

        from app.services.admin_service import grant_permission
        grant_permission(db, _client.id, "cyracode.lookup")

        ok = client.get("/cyracode/GrantTest/address", headers=_key(raw_key))
        assert ok.status_code == 200


class TestAntiEnumeration:
    def test_missing_code_returns_generic_404(self, client, db):
        _, raw_key = make_api_client(db, "Looker", permissions=["cyracode.lookup"])
        resp = client.get("/cyracode/GhostCode/address", headers=_key(raw_key))
        assert resp.status_code == 404
        assert resp.json()["detail"] == "CyraCode not found."

    def test_inactive_code_returns_same_404(self, client, db):
        make_cyracode(db, "InactiveHere", is_active=False)
        _, raw_key = make_api_client(db, "Looker2", permissions=["cyracode.lookup"])
        resp = client.get("/cyracode/InactiveHere/address", headers=_key(raw_key))
        assert resp.status_code == 404
        assert resp.json()["detail"] == "CyraCode not found."

    def test_oversized_input_rejected_404(self, client, db):
        _, raw_key = make_api_client(db, "Looker3", permissions=["cyracode.lookup"])
        resp = client.get(
            f"/cyracode/{'A' * 200}/address", headers=_key(raw_key)
        )
        assert resp.status_code == 404


class TestAuditLog:
    def test_successful_request_logged(self, client, db):
        make_cyracode(db, "AuditLookup")
        _client, raw_key = make_api_client(db, "Audited", permissions=["cyracode.lookup"])

        resp = client.get("/cyracode/AuditLookup/address", headers=_key(raw_key))
        assert resp.status_code == 200

        logs = db.query(ClientAccessLog).all()
        assert len(logs) >= 1
        assert logs[-1].status_code == 200
        assert logs[-1].client_name == "Audited"
        # Raw key must never appear in the audit trail.
        assert raw_key not in (logs[-1].key_tail or "")

    def test_denied_request_logged(self, client, db):
        """Authorization failures are audited too."""
        from app.models.models import ApiClient

        _client, raw_key = make_api_client(db, "DeniedLogger", permissions=[])
        resp = client.get("/cyracode/Whatever/address", headers=_key(raw_key))
        assert resp.status_code == 403

        logs = db.query(ClientAccessLog).filter(
            ClientAccessLog.status_code == 403
        ).all()
        assert len(logs) >= 1

    def test_anonymous_failure_logged(self, client, db):
        resp = client.get("/cyracode/Whatever/address")
        assert resp.status_code == 401
        logs = db.query(ClientAccessLog).filter(
            ClientAccessLog.status_code == 401
        ).all()
        assert len(logs) >= 1


class TestAddressShape:
    def test_address_line_fields(self, client, db):
        from tests.conftest import create_user

        owner = create_user(db, email="owner@example.com")
        make_cyracode(db, "ShapeTest", user_id=owner.id)

        _client, raw_key = make_api_client(db, "Shape", permissions=["cyracode.lookup"])
        resp = client.get("/cyracode/ShapeTest/address", headers=_key(raw_key))
        body = resp.json()
        assert "cyracode" in body
        assert {
            "address_line1",
            "address_line2",
            "city",
            "state",
            "postal_code",
            "country",
        } <= set(body["address"].keys())