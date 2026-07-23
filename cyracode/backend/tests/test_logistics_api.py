"""Integration tests for /logistics endpoints — AC 6.23-6.27."""
import uuid
from datetime import datetime, timezone

import pytest
from jose import jwt
from tests.conftest import make_cyracode

from app.config import settings

VALID_KEY = "logistics-demo-key"
INVALID_KEY = "wrong-key"


def _key(k):
    return {"x-api-key": k}


def _bearer(sub="partner-1", token_type="logistics_partner") -> dict:
    token = jwt.encode(
        {"sub": sub, "type": token_type},
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM,
    )
    return {"Authorization": f"Bearer {token}"}


# ── AC 6.26: Authentication ───────────────────────────────────────────────────

class TestAuthentication:
    def test_no_credentials_returns_401(self, client):
        resp = client.get("/logistics/lookup/SomeCode")
        assert resp.status_code == 401

    def test_wrong_api_key_returns_401(self, client):
        resp = client.get("/logistics/lookup/SomeCode", headers=_key(INVALID_KEY))
        assert resp.status_code == 401

    def test_valid_api_key_accepted(self, client, db):
        make_cyracode(db, "AuthTest")
        resp = client.get("/logistics/lookup/AuthTest", headers=_key(VALID_KEY))
        assert resp.status_code == 200

    def test_valid_bearer_jwt_accepted(self, client, db):
        """AC 6.26: OAuth2 Bearer token authentication."""
        make_cyracode(db, "JWTTest")
        resp = client.get("/logistics/lookup/JWTTest", headers=_bearer())
        assert resp.status_code == 200

    def test_bearer_wrong_type_rejected(self, client):
        """JWT with type != 'logistics_partner' must be rejected."""
        resp = client.get(
            "/logistics/lookup/X",
            headers=_bearer(token_type="user"),
        )
        assert resp.status_code == 401

    def test_invalid_bearer_token_rejected(self, client):
        resp = client.get(
            "/logistics/lookup/X",
            headers={"Authorization": "Bearer not.a.real.token"},
        )
        assert resp.status_code == 401


# ── AC 6.23: API Availability / address data ──────────────────────────────────

class TestLookup:
    def test_not_found_returns_404(self, client):
        resp = client.get("/logistics/lookup/Ghost", headers=_key(VALID_KEY))
        assert resp.status_code == 404

    def test_found_returns_required_fields(self, client, db):
        """AC 6.23: response must include name, coordinates, full_address, postal_code."""
        make_cyracode(db, "LogiCode", lat=12.9716, lng=77.5946)
        resp = client.get("/logistics/lookup/LogiCode", headers=_key(VALID_KEY))
        assert resp.status_code == 200
        body = resp.json()
        assert body["name"] == "LogiCode"
        assert "coordinates" in body
        assert body["coordinates"]["latitude"] == pytest.approx(12.9716, abs=1e-4)
        assert "full_address" in body
        assert "postal_code" in body

    def test_response_time_header_present(self, client, db):
        """AC 6.23: X-Response-Time header must be present on every response."""
        make_cyracode(db, "TimeCode")
        resp = client.get("/logistics/lookup/TimeCode", headers=_key(VALID_KEY))
        assert "x-response-time" in resp.headers

    def test_lookup_by_exact_name(self, client, db):
        # Case-insensitive matching in production is handled by MSSQL CI collation.
        # SQLite (used in tests) uses case-sensitive = so we test with the stored case.
        make_cyracode(db, "LogiCode")
        resp = client.get("/logistics/lookup/LogiCode", headers=_key(VALID_KEY))
        assert resp.status_code == 200

    def test_inactive_code_not_found(self, client, db):
        make_cyracode(db, "DeadCode", is_active=False)
        resp = client.get("/logistics/lookup/DeadCode", headers=_key(VALID_KEY))
        assert resp.status_code == 404


# ── AC 6.24: Reverse geocoding with null response ────────────────────────────

class TestReverseLogistics:
    def test_no_key_returns_401(self, client):
        resp = client.post("/logistics/reverse", json={"lat": 12.9, "lng": 77.5})
        assert resp.status_code == 401

    def test_found_within_radius(self, client, db):
        make_cyracode(db, "NearLogistics", lat=12.9716, lng=77.5946)
        resp = client.post(
            "/logistics/reverse",
            json={"lat": 12.97162, "lng": 77.59461},
            headers=_key(VALID_KEY),
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["name"] == "NearLogistics"
        assert body["found"] is True

    def test_not_found_returns_null_200(self, client):
        """AC 6.24: no match within 50 m → 200 with null name, not 404."""
        resp = client.post(
            "/logistics/reverse",
            json={"lat": 0.0, "lng": 0.0},
            headers=_key(VALID_KEY),
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["found"] is False
        assert body["name"] is None

    def test_bearer_auth_on_reverse(self, client, db):
        """AC 6.26: Bearer token accepted on /reverse."""
        make_cyracode(db, "BearerReverse", lat=1.0, lng=1.0)
        resp = client.post(
            "/logistics/reverse",
            json={"lat": 1.0, "lng": 1.0},
            headers=_bearer(),
        )
        assert resp.status_code == 200


# ── AC 6.25: Address format standardisation ───────────────────────────────────

class TestAddressFormatStandardization:
    def _lookup(self, client, name):
        resp = client.get(f"/logistics/lookup/{name}", headers=_key(VALID_KEY))
        assert resp.status_code == 200
        return resp.json()["full_address"]

    def test_indian_address_format(self, client, db):
        """IN: flat, building, street, landmark, city, district, state - postal, country."""
        from app.models.models import CyraCode as CC
        entry = CC(
            id=str(uuid.uuid4()),
            user_id=str(uuid.uuid4()),
            code_name="IndiaFmt",
            code_type="traditional",
            latitude=12.9716,
            longitude=77.5946,
            country="India",
            country_code="IN",
            city="Bangalore",
            district="Bangalore Urban",
            state="Karnataka",
            street_address="MG Road",
            flat_plot_number="42",
            building_name="Tech Park",
            postal_code="560001",
            is_active=True,
        )
        db.add(entry)
        db.commit()
        addr = self._lookup(client, "IndiaFmt")
        assert "Karnataka" in addr
        assert "560001" in addr
        assert "MG Road" in addr

    def test_us_address_format(self, client, db):
        """US: <number> <street>, city, state zip, country."""
        from app.models.models import CyraCode as CC
        entry = CC(
            id=str(uuid.uuid4()),
            user_id=str(uuid.uuid4()),
            code_name="USFmt",
            code_type="traditional",
            latitude=37.7749,
            longitude=-122.4194,
            country="United States",
            country_code="US",
            city="San Francisco",
            state="CA",
            street_address="Market Street",
            flat_plot_number="100",
            postal_code="94102",
            is_active=True,
        )
        db.add(entry)
        db.commit()
        addr = self._lookup(client, "USFmt")
        assert "100 Market Street" in addr
        assert "CA 94102" in addr
        assert "San Francisco" in addr

    def test_german_address_format(self, client, db):
        """DE: street number, postal city, country."""
        from app.models.models import CyraCode as CC
        entry = CC(
            id=str(uuid.uuid4()),
            user_id=str(uuid.uuid4()),
            code_name="DEFmt",
            code_type="traditional",
            latitude=52.52,
            longitude=13.405,
            country="Germany",
            country_code="DE",
            city="Berlin",
            street_address="Unter den Linden",
            flat_plot_number="5",
            postal_code="10117",
            is_active=True,
        )
        db.add(entry)
        db.commit()
        addr = self._lookup(client, "DEFmt")
        assert "Unter den Linden 5" in addr
        assert "10117 Berlin" in addr

    def test_consistent_format_across_queries(self, client, db):
        """AC 6.25: Same address queried twice returns identical format."""
        make_cyracode(db, "Consistent")
        addr1 = self._lookup(client, "Consistent")
        addr2 = self._lookup(client, "Consistent")
        assert addr1 == addr2


# ── AC 6.26: Audit log ────────────────────────────────────────────────────────

class TestAuditLog:
    def test_all_api_calls_logged(self, client, db):
        """AC 6.26: Every /logistics request creates a LogisticsAccessLog entry."""
        make_cyracode(db, "AuditCode")
        client.get("/logistics/lookup/AuditCode", headers=_key(VALID_KEY))
        from app.models.models import LogisticsAccessLog
        logs = db.query(LogisticsAccessLog).all()
        assert len(logs) >= 1
        assert logs[-1].status_code == 200

    def test_failed_auth_also_logged(self, client, db):
        """AC 6.26: Auth failures are logged with 401 status."""
        client.get("/logistics/lookup/X", headers=_key("bad-key"))
        from app.models.models import LogisticsAccessLog
        logs = db.query(LogisticsAccessLog).filter(
            LogisticsAccessLog.status_code == 401
        ).all()
        assert len(logs) >= 1

    def test_partner_key_masked_in_log(self, client, db):
        """AC 6.26: API key is masked in the audit log."""
        make_cyracode(db, "MaskCode")
        client.get("/logistics/lookup/MaskCode", headers=_key(VALID_KEY))
        from app.models.models import LogisticsAccessLog
        log = db.query(LogisticsAccessLog).order_by(
            LogisticsAccessLog.created_at.desc()
        ).first()
        assert log is not None
        assert VALID_KEY not in (log.partner_key or "")


# ── AC 6.27: Delivery confirmation ───────────────────────────────────────────

class TestDeliveryConfirm:
    def test_no_key_returns_401(self, client):
        resp = client.post(
            "/logistics/delivery-confirm",
            json={"name": "X", "tracking_id": "T1"},
        )
        assert resp.status_code == 401

    def test_not_found_returns_404(self, client):
        resp = client.post(
            "/logistics/delivery-confirm",
            json={"name": "Ghost", "tracking_id": "TRACK-001"},
            headers=_key(VALID_KEY),
        )
        assert resp.status_code == 404

    def test_success_returns_delivery_time(self, client, db):
        """AC 6.27: Response includes cyracode_name and delivery_time."""
        make_cyracode(db, "Delivered")
        resp = client.post(
            "/logistics/delivery-confirm",
            json={"name": "Delivered", "tracking_id": "TRK-42", "status": "delivered"},
            headers=_key(VALID_KEY),
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert body["tracking_id"] == "TRK-42"
        assert body["cyracode_name"] == "Delivered"
        assert "delivery_time" in body
        assert "proof_received" in body

    def test_proof_photo_accepted_and_recorded(self, client, db):
        """AC 6.27: proof_photo field is accepted and stored."""
        make_cyracode(db, "WithProof")
        resp = client.post(
            "/logistics/delivery-confirm",
            json={
                "name": "WithProof",
                "tracking_id": "TRK-PROOF",
                "status": "delivered",
                "proof_photo": "data:image/png;base64,iVBORw0KGgo=",
            },
            headers=_key(VALID_KEY),
        )
        assert resp.status_code == 200
        assert resp.json()["proof_received"] is True

        from app.models.models import DeliveryRecord
        record = db.query(DeliveryRecord).filter(
            DeliveryRecord.tracking_id == "TRK-PROOF"
        ).first()
        assert record is not None
        assert record.proof_photo is not None

    def test_delivery_stored_in_history(self, client, db):
        """AC 6.27: Delivery record persisted in DeliveryRecords table."""
        make_cyracode(db, "Stored")
        resp = client.post(
            "/logistics/delivery-confirm",
            json={"name": "Stored", "tracking_id": "TRK-HIST", "status": "delivered"},
            headers=_key(VALID_KEY),
        )
        assert resp.status_code == 200

        from app.models.models import DeliveryRecord
        record = db.query(DeliveryRecord).filter(
            DeliveryRecord.tracking_id == "TRK-HIST"
        ).first()
        assert record is not None
        assert record.status == "delivered"
        assert record.delivered_at is not None

    def test_in_transit_status_no_delivery_time(self, client, db):
        """Non-delivered status should not set delivered_at."""
        make_cyracode(db, "InTransit")
        client.post(
            "/logistics/delivery-confirm",
            json={"name": "InTransit", "tracking_id": "TRK-IT", "status": "in_transit"},
            headers=_key(VALID_KEY),
        )
        from app.models.models import DeliveryRecord
        record = db.query(DeliveryRecord).filter(
            DeliveryRecord.tracking_id == "TRK-IT"
        ).first()
        assert record.delivered_at is None

    def test_audit_log_recorded(self, client, db):
        """AC 6.26: Delivery confirmation creates AuditLog entry."""
        make_cyracode(db, "AuditDelivery")
        client.post(
            "/logistics/delivery-confirm",
            json={"name": "AuditDelivery", "tracking_id": "TRK-AUDIT", "status": "delivered"},
            headers=_key(VALID_KEY),
        )
        from app.models.models import AuditLog
        log = db.query(AuditLog).first()
        assert log is not None
        assert "TRK-AUDIT" in log.action

    def test_custom_status_in_message(self, client, db):
        make_cyracode(db, "Custom")
        resp = client.post(
            "/logistics/delivery-confirm",
            json={"name": "Custom", "tracking_id": "TRK-99", "status": "failed_attempt"},
            headers=_key(VALID_KEY),
        )
        assert resp.status_code == 200
        assert "failed_attempt" in resp.json()["message"]


# ── AC 6.27: Delivery status / history ───────────────────────────────────────

class TestDeliveryStatus:
    def test_no_key_returns_401(self, client):
        resp = client.get("/logistics/delivery-status/TRK-X")
        assert resp.status_code == 401

    def test_unknown_tracking_id_returns_404(self, client):
        resp = client.get(
            "/logistics/delivery-status/UNKNOWN-TRK",
            headers=_key(VALID_KEY),
        )
        assert resp.status_code == 404

    def test_status_returned_after_confirm(self, client, db):
        """AC 6.27: Real-time status retrievable after delivery confirmation."""
        make_cyracode(db, "StatusCheck")
        client.post(
            "/logistics/delivery-confirm",
            json={"name": "StatusCheck", "tracking_id": "TRK-STATUS", "status": "delivered"},
            headers=_key(VALID_KEY),
        )
        resp = client.get(
            "/logistics/delivery-status/TRK-STATUS",
            headers=_key(VALID_KEY),
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["tracking_id"] == "TRK-STATUS"
        assert body["status"] == "delivered"
        assert body["cyracode_name"] == "StatusCheck"
        assert body["delivered_at"] is not None
        assert isinstance(body["history"], list)
        assert len(body["history"]) >= 1

    def test_history_accumulates(self, client, db):
        """AC 6.27: Multiple updates on same tracking ID appear in history."""
        make_cyracode(db, "HistAccum")
        for status in ["in_transit", "out_for_delivery", "delivered"]:
            client.post(
                "/logistics/delivery-confirm",
                json={"name": "HistAccum", "tracking_id": "TRK-MULTI", "status": status},
                headers=_key(VALID_KEY),
            )
        resp = client.get(
            "/logistics/delivery-status/TRK-MULTI",
            headers=_key(VALID_KEY),
        )
        assert resp.status_code == 200
        assert len(resp.json()["history"]) == 3

    def test_proof_available_flag(self, client, db):
        make_cyracode(db, "ProofStatus")
        client.post(
            "/logistics/delivery-confirm",
            json={
                "name": "ProofStatus",
                "tracking_id": "TRK-PFLAG",
                "status": "delivered",
                "proof_photo": "data:image/png;base64,abc123",
            },
            headers=_key(VALID_KEY),
        )
        resp = client.get(
            "/logistics/delivery-status/TRK-PFLAG",
            headers=_key(VALID_KEY),
        )
        assert resp.json()["proof_available"] is True
