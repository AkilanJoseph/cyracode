"""Integration tests for /registration endpoints."""
from tests.conftest import auth_headers, base_registration_payload, make_cyracode, make_verified_otp


class TestCheckName:
    def test_available_name(self, client):
        resp = client.get("/registration/check-name/NewCode")
        assert resp.status_code == 200
        assert resp.json()["available"] is True
        assert resp.json()["suggestions"] == []

    def test_taken_name(self, client, db):
        make_cyracode(db, "TakenCode")
        resp = client.get("/registration/check-name/TakenCode")
        assert resp.status_code == 200
        assert resp.json()["available"] is False
        assert len(resp.json()["suggestions"]) >= 1

    def test_case_insensitive_check(self, client, db):
        make_cyracode(db, "CaseTest")
        resp = client.get("/registration/check-name/casetest")
        assert resp.json()["available"] is False


class TestGenerateCode:
    def test_returns_12_char_code(self, client):
        resp = client.post("/registration/generate-code", json={"lat": 12.9716, "lng": 77.5946})
        assert resp.status_code == 200
        assert len(resp.json()["code"]) == 12

    def test_invalid_lat_returns_400(self, client):
        resp = client.post("/registration/generate-code", json={"lat": 999, "lng": 77.5946})
        assert resp.status_code == 400

    def test_invalid_lng_returns_400(self, client):
        resp = client.post("/registration/generate-code", json={"lat": 12.9, "lng": 999})
        assert resp.status_code == 400

    def test_missing_params_returns_422(self, client):
        resp = client.post("/registration/generate-code", json={"lat": 12.9})
        assert resp.status_code == 422


class TestRegisterTraditional:
    def test_success_creates_cyracode(self, client, db):
        make_verified_otp(db)
        headers = auth_headers(client)
        resp = client.post(
            "/registration/traditional",
            json=base_registration_payload(),
            headers=headers,
        )
        assert resp.status_code == 201
        body = resp.json()
        assert body["code_name"] == "MyHome"
        assert body["code_type"] == "traditional"
        assert "qr_code" in body

    def test_unauthenticated_returns_401(self, client):
        resp = client.post("/registration/traditional", json=base_registration_payload())
        assert resp.status_code == 401

    def test_duplicate_name_returns_409(self, client, db):
        make_verified_otp(db)
        headers = auth_headers(client)
        make_cyracode(db, "MyHome")
        resp = client.post(
            "/registration/traditional",
            json=base_registration_payload(),
            headers=headers,
        )
        assert resp.status_code == 409
        assert "already taken" in resp.json()["detail"]

    def test_duplicate_address_returns_409(self, client, db):
        make_verified_otp(db)
        headers = auth_headers(client)
        make_cyracode(db, "Occupied", lat=12.9716, lng=77.5946, country_code="IN")
        payload = base_registration_payload(
            name="Different",
            latitude=12.97161,
            longitude=77.59461,
        )
        resp = client.post("/registration/traditional", json=payload, headers=headers)
        assert resp.status_code == 409
        assert "10 meters" in resp.json()["detail"]

    def test_invalid_coordinates_returns_400(self, client):
        headers = auth_headers(client)
        payload = base_registration_payload(latitude=999, longitude=77.5946)
        resp = client.post("/registration/traditional", json=payload, headers=headers)
        assert resp.status_code == 400

    def test_name_too_short_returns_422(self, client):
        headers = auth_headers(client)
        payload = base_registration_payload(name="AB")
        resp = client.post("/registration/traditional", json=payload, headers=headers)
        assert resp.status_code == 422

    def test_name_too_long_returns_422(self, client):
        headers = auth_headers(client)
        payload = base_registration_payload(name="A" * 51)
        resp = client.post("/registration/traditional", json=payload, headers=headers)
        assert resp.status_code == 422

    def test_optional_fields_nullable(self, client, db):
        make_verified_otp(db)
        headers = auth_headers(client)
        payload = base_registration_payload()
        payload.pop("state", None)
        resp = client.post("/registration/traditional", json=payload, headers=headers)
        assert resp.status_code == 201


class TestRegisterAutoGenerate:
    def test_success(self, client, db):
        make_verified_otp(db)
        headers = auth_headers(client)
        # Name must match ^[A-Z]{3}[A-Z]{2}[a-z0-9]{7}$ (12 chars)
        resp = client.post(
            "/registration/auto-generate",
            json=base_registration_payload(name="ABCDEfg12345"),
            headers=headers,
        )
        assert resp.status_code == 201
        assert resp.json()["code_type"] == "auto_generate"

    def test_unauthenticated_returns_401(self, client):
        resp = client.post("/registration/auto-generate", json=base_registration_payload())
        assert resp.status_code == 401


class TestMyCodes:
    def test_empty_list_when_no_codes(self, client):
        headers = auth_headers(client)
        resp = client.get("/registration/my-codes", headers=headers)
        assert resp.status_code == 200
        assert resp.json() == []

    def test_returns_own_codes_only(self, client, db):
        make_verified_otp(db)
        headers = auth_headers(client)
        client.post("/registration/traditional", json=base_registration_payload(), headers=headers)
        resp = client.get("/registration/my-codes", headers=headers)
        assert resp.status_code == 200
        assert len(resp.json()) == 1
        assert resp.json()[0]["code_name"] == "MyHome"

    def test_unauthenticated_returns_401(self, client):
        resp = client.get("/registration/my-codes")
        assert resp.status_code == 401

    def test_does_not_include_inactive_codes(self, client, db):
        make_verified_otp(db)
        headers = auth_headers(client)
        client.post("/registration/traditional", json=base_registration_payload(), headers=headers)
        from app.models.models import CyraCode
        code = db.query(CyraCode).first()
        code.is_active = False
        db.commit()
        resp = client.get("/registration/my-codes", headers=headers)
        assert resp.json() == []


class TestDataIntegrity:
    """Tests for AC 6.17–6.22: idempotency, coordinate validation, duplicate prevention,
    email uniqueness, mobile validation, and address field length limits."""

    # --- AC 6.17: Idempotency ---

    def test_idempotency_key_returns_cached_response(self, client, db):
        """Same key on rapid re-submit returns identical response; no duplicate record created."""
        make_verified_otp(db)
        headers = auth_headers(client)
        headers["X-Idempotency-Key"] = "idem-test-key-abc-001"

        resp1 = client.post("/registration/traditional", json=base_registration_payload(), headers=headers)
        assert resp1.status_code == 201

        # Rapid second submit with the same key
        resp2 = client.post("/registration/traditional", json=base_registration_payload(), headers=headers)
        assert resp2.status_code == 201
        assert resp2.json()["id"] == resp1.json()["id"]

        from app.models.models import CyraCode
        assert db.query(CyraCode).filter(CyraCode.code_name == "MyHome").count() == 1

    def test_no_idempotency_key_second_submit_rejected_as_duplicate(self, client, db):
        """Without a key, the second submit is blocked by the name-already-taken check."""
        make_verified_otp(db)
        headers = auth_headers(client)

        resp1 = client.post("/registration/traditional", json=base_registration_payload(), headers=headers)
        assert resp1.status_code == 201

        resp2 = client.post("/registration/traditional", json=base_registration_payload(), headers=headers)
        assert resp2.status_code == 409

    # --- AC 6.19: Duplicate Address Prevention message ---

    def test_duplicate_address_exact_error_message(self, client, db):
        """AC 6.19: error must say 'An address within 10 meters already registered'."""
        make_verified_otp(db)
        headers = auth_headers(client)
        make_cyracode(db, "Existing", lat=12.9716, lng=77.5946, country_code="IN")
        payload = base_registration_payload(name="NewName", latitude=12.97161, longitude=77.59461)
        resp = client.post("/registration/traditional", json=payload, headers=headers)
        assert resp.status_code == 409
        assert resp.json()["detail"] == "An address within 10 meters already registered"

    # --- AC 6.21: Mobile Number Validation ---

    def test_mobile_too_short_returns_422(self, client):
        """AC 6.21: mobile with fewer than 10 digits (after '+') is rejected."""
        headers = auth_headers(client)
        payload = base_registration_payload(verified_mobile="+123456789")  # 9 digits
        resp = client.post("/registration/traditional", json=payload, headers=headers)
        assert resp.status_code == 422

    def test_mobile_too_long_returns_422(self, client):
        """AC 6.21: mobile with more than 15 digits (after '+') is rejected."""
        headers = auth_headers(client)
        payload = base_registration_payload(verified_mobile="+1234567890123456")  # 16 digits
        resp = client.post("/registration/traditional", json=payload, headers=headers)
        assert resp.status_code == 422

    def test_mobile_formatted_normalized_to_e164(self, client, db):
        """AC 6.21: '+1 (555) 123-4567' normalizes to '+15551234567' and matches OTP record."""
        make_verified_otp(db, mobile="+15551234567")
        headers = auth_headers(client)
        payload = base_registration_payload(verified_mobile="+1 (555) 123-4567")
        resp = client.post("/registration/traditional", json=payload, headers=headers)
        assert resp.status_code == 201

    def test_mobile_without_plus_normalized(self, client, db):
        """AC 6.21: mobile without leading '+' is normalized by prepending '+'."""
        make_verified_otp(db, mobile="+911234567890")
        headers = auth_headers(client)
        # Omit '+' — validator adds it back
        payload = base_registration_payload(verified_mobile="911234567890")
        resp = client.post("/registration/traditional", json=payload, headers=headers)
        assert resp.status_code == 201

    # --- AC 6.22: Address Field Length Limits ---

    def test_street_address_over_100_chars_returns_422(self, client):
        """AC 6.22: street_address exceeding 100 characters is rejected with 422."""
        headers = auth_headers(client)
        payload = base_registration_payload(street_address="A" * 101)
        resp = client.post("/registration/traditional", json=payload, headers=headers)
        assert resp.status_code == 422

    def test_street_address_at_100_chars_accepted(self, client, db):
        """AC 6.22: street_address of exactly 100 characters is accepted."""
        make_verified_otp(db)
        headers = auth_headers(client)
        payload = base_registration_payload(street_address="A" * 100)
        resp = client.post("/registration/traditional", json=payload, headers=headers)
        assert resp.status_code == 201

    def test_city_over_100_chars_returns_422(self, client):
        """AC 6.22: city exceeding 100 characters is rejected."""
        headers = auth_headers(client)
        payload = base_registration_payload(city="C" * 101)
        resp = client.post("/registration/traditional", json=payload, headers=headers)
        assert resp.status_code == 422

    def test_building_name_over_100_chars_returns_422(self, client):
        """AC 6.22: building_name exceeding 100 characters is rejected."""
        headers = auth_headers(client)
        payload = base_registration_payload(building_name="B" * 101)
        resp = client.post("/registration/traditional", json=payload, headers=headers)
        assert resp.status_code == 422

    def test_flat_plot_over_50_chars_returns_422(self, client):
        """AC 6.22: flat_plot_number exceeding 50 characters is rejected."""
        headers = auth_headers(client)
        payload = base_registration_payload(flat_plot_number="F" * 51)
        resp = client.post("/registration/traditional", json=payload, headers=headers)
        assert resp.status_code == 422

    def test_landmark_over_100_chars_returns_422(self, client):
        """AC 6.22: landmark exceeding 100 characters is rejected."""
        headers = auth_headers(client)
        payload = base_registration_payload(landmark="L" * 101)
        resp = client.post("/registration/traditional", json=payload, headers=headers)
        assert resp.status_code == 422
