"""Integration tests for /registration endpoints."""
from tests.conftest import auth_headers, base_registration_payload, make_cyracode, register_user


def arun_headers(client, email="arun@example.com"):
    """Authenticate a user named Arun Kumar (for personalized-suggestion tests)."""
    register_user(client, first_name="Arun", last_name="Kumar", email=email)
    resp = client.post("/auth/login", json={"email": email, "password": "ValidP@ss1"})
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


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
        headers = auth_headers(client)
        make_cyracode(db, "MyHome")
        resp = client.post(
            "/registration/traditional",
            json=base_registration_payload(),
            headers=headers,
        )
        assert resp.status_code == 409
        assert "already taken" in resp.json()["detail"]

    def test_same_address_different_name_allowed(self, client, db):
        """Multiple residents in one flat may register the same address under different names."""
        headers = auth_headers(client)
        make_cyracode(db, "Occupied", lat=12.9716, lng=77.5946, country_code="IN")
        payload = base_registration_payload(
            name="Different",
            latitude=12.97161,
            longitude=77.59461,
        )
        resp = client.post("/registration/traditional", json=payload, headers=headers)
        assert resp.status_code == 201

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
        headers = auth_headers(client)
        payload = base_registration_payload()
        payload.pop("state", None)
        resp = client.post("/registration/traditional", json=payload, headers=headers)
        assert resp.status_code == 201


class TestRegisterAutoGenerate:
    def test_success(self, client, db):
        headers = auth_headers(client)
        # Name must match the backend generator format LL#LL##L##L# (12 chars),
        # e.g. Aa2DF43T91q5
        resp = client.post(
            "/registration/auto-generate",
            json=base_registration_payload(name="Aa2DF43T91q5"),
            headers=headers,
        )
        assert resp.status_code == 201
        assert resp.json()["code_type"] == "auto_generate"

    def test_unauthenticated_returns_401(self, client):
        resp = client.post("/registration/auto-generate", json=base_registration_payload())
        assert resp.status_code == 401


class TestPersonalizedNameSuggestions:
    """Personalized "Auto Generate My Code": suggestions + availability checks."""

    def test_suggests_available_unique_names_for_user(self, client, db):
        from app.services.registration_service import check_name_available

        headers = arun_headers(client)
        resp = client.post("/registration/suggest-names", headers=headers)
        assert resp.status_code == 200
        names = resp.json()["names"]
        assert len(names) == 10

        raw_names = [n["name"] for n in names]
        # No duplicate suggestions
        assert len(set(raw_names)) == len(raw_names)
        # Every suggestion satisfies the CyraCode naming rules (3-50 alnum/spaces)
        for n in names:
            assert 3 <= len(n["name"]) <= 50
            assert all(ch.isalnum() or ch == " " for ch in n["name"])
            assert n["category"]
        # Personalized — the user's own name is used in the suggestions
        assert any("Arun" in n["name"] for n in names)
        # Availability — nothing displayed is already registered
        for n in names:
            assert check_name_available(db, n["name"])

    def test_suggest_names_requires_auth(self, client):
        resp = client.post("/registration/suggest-names")
        assert resp.status_code == 401

    def test_taken_names_are_skipped_and_replaced(self, client, db):
        from app.services.registration_service import check_name_available

        headers = arun_headers(client)
        first = client.post("/registration/suggest-names", headers=headers).json()["names"]
        # Claim every suggested name in the database.
        for n in first:
            make_cyracode(db, n["name"])

        # The next batch must skip the taken names and still surface 10 available ones.
        second = client.post("/registration/suggest-names", headers=headers).json()["names"]
        assert len(second) == 10
        for n in second:
            assert check_name_available(db, n["name"])


class TestRegisterPersonalized:
    def test_success_creates_cyracode(self, client, db):
        headers = auth_headers(client)
        resp = client.post(
            "/registration/personalized",
            json=base_registration_payload(name="ArunNova"),
            headers=headers,
        )
        assert resp.status_code == 201
        body = resp.json()
        assert body["code_name"] == "ArunNova"
        assert body["code_type"] == "personalized"
        assert "qr_code" in body

    def test_unauthenticated_returns_401(self, client):
        resp = client.post(
            "/registration/personalized",
            json=base_registration_payload(name="ArunNova"),
        )
        assert resp.status_code == 401

    def test_duplicate_name_returns_409(self, client, db):
        headers = auth_headers(client)
        make_cyracode(db, "ArunNova")
        resp = client.post(
            "/registration/personalized",
            json=base_registration_payload(name="ArunNova"),
            headers=headers,
        )
        assert resp.status_code == 409
        assert "already taken" in resp.json()["detail"]


class TestMyCodes:
    def test_empty_list_when_no_codes(self, client):
        headers = auth_headers(client)
        resp = client.get("/registration/my-codes", headers=headers)
        assert resp.status_code == 200
        assert resp.json() == []

    def test_returns_own_codes_only(self, client, db):
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
        headers = auth_headers(client)
        client.post("/registration/traditional", json=base_registration_payload(), headers=headers)
        from app.models.models import CyraCode
        code = db.query(CyraCode).first()
        code.is_active = False
        db.commit()
        resp = client.get("/registration/my-codes", headers=headers)
        assert resp.json() == []


class TestUpdateMyCode:
    def _create_code(self, client, db, name="MyHome"):
        headers = auth_headers(client)
        client.post("/registration/traditional", json=base_registration_payload(name=name), headers=headers)
        return headers

    def _update_payload(self, **overrides):
        payload = {
            "latitude": 12.9716,
            "longitude": 77.5946,
            "country": "India",
            "country_code": "IN",
            "state": "Karnataka",
            "city": "Bangalore",
            "street_address": "MG Road",
            "postal_code": "560001",
        }
        payload.update(overrides)
        return payload

    def test_updates_address_fields(self, client, db):
        headers = self._create_code(client, db)
        codes = client.get("/registration/my-codes", headers=headers).json()
        code_id = codes[0]["id"]

        payload = self._update_payload(
            latitude=12.9999,
            longitude=77.1111,
            street_address="New Street Address",
            postal_code="560002",
            landmark="Near Bus Stop",
        )
        resp = client.put(f"/registration/my-codes/{code_id}", json=payload, headers=headers)
        assert resp.status_code == 200
        body = resp.json()
        assert body["id"] == code_id
        assert body["street_address"] == "New Street Address"
        assert body["postal_code"] == "560002"
        assert body["landmark"] == "Near Bus Stop"
        assert body["latitude"] == 12.9999
        # name must be preserved — immutable
        assert body["code_name"] == "MyHome"

    def test_name_remains_unchanged_in_db(self, client, db):
        headers = self._create_code(client, db)
        codes = client.get("/registration/my-codes", headers=headers).json()
        code_id = codes[0]["id"]

        resp = client.put(
            f"/registration/my-codes/{code_id}",
            json=self._update_payload(street_address="Edited Road"),
            headers=headers,
        )
        assert resp.status_code == 200
        from app.models.models import CyraCode
        entry = db.query(CyraCode).filter(CyraCode.id == code_id).first()
        assert entry.code_name == "MyHome"
        assert entry.street_address == "Edited Road"

    def test_cannot_update_another_users_code(self, client, db):
        # First user owns a code
        headers1 = self._create_code(client, db)
        code_id = client.get("/registration/my-codes", headers=headers1).json()[0]["id"]

        # Second user cannot edit it
        headers2 = auth_headers(client, email="other@example.com")
        resp = client.put(
            f"/registration/my-codes/{code_id}",
            json=self._update_payload(),
            headers=headers2,
        )
        assert resp.status_code == 404

    def test_update_nonexistent_code_returns_404(self, client, db):
        headers = auth_headers(client)
        resp = client.put(
            "/registration/my-codes/does-not-exist",
            json=self._update_payload(),
            headers=headers,
        )
        assert resp.status_code == 404

    def test_unauthenticated_returns_401(self, client):
        resp = client.put("/registration/my-codes/abc", json=self._update_payload())
        assert resp.status_code == 401

    def test_invalid_coordinates_returns_400(self, client, db):
        headers = self._create_code(client, db)
        code_id = client.get("/registration/my-codes", headers=headers).json()[0]["id"]
        resp = client.put(
            f"/registration/my-codes/{code_id}",
            json=self._update_payload(latitude=999, longitude=77.5946),
            headers=headers,
        )
        assert resp.status_code == 400

    def test_field_length_limits_enforced(self, client, db):
        headers = self._create_code(client, db)
        code_id = client.get("/registration/my-codes", headers=headers).json()[0]["id"]
        resp = client.put(
            f"/registration/my-codes/{code_id}",
            json=self._update_payload(street_address="A" * 101),
            headers=headers,
        )
        assert resp.status_code == 422


class TestDeleteMyCode:
    def _create_code(self, client, db, name="MyHome"):
        headers = auth_headers(client)
        client.post(
            "/registration/traditional",
            json=base_registration_payload(name=name),
            headers=headers,
        )
        return headers

    def test_removes_own_code(self, client, db):
        headers = self._create_code(client, db)
        code_id = client.get("/registration/my-codes", headers=headers).json()[0]["id"]
        resp = client.delete(f"/registration/my-codes/{code_id}", headers=headers)
        assert resp.status_code == 204
        # no longer returned by my-codes
        assert client.get("/registration/my-codes", headers=headers).json() == []
        # soft-deleted: the record still exists but is inactive
        from app.models.models import CyraCode
        entry = db.query(CyraCode).filter(CyraCode.id == code_id).first()
        assert entry is not None
        assert entry.is_active is False

    def test_cannot_remove_another_users_code(self, client, db):
        headers1 = self._create_code(client, db)
        code_id = client.get("/registration/my-codes", headers=headers1).json()[0]["id"]

        # Second user cannot delete the first user's code
        headers2 = auth_headers(client, email="other@example.com")
        resp = client.delete(f"/registration/my-codes/{code_id}", headers=headers2)
        assert resp.status_code == 404

        # Owner still sees the code afterwards
        assert len(client.get("/registration/my-codes", headers=headers1).json()) == 1

    def test_delete_nonexistent_returns_404(self, client):
        headers = auth_headers(client)
        resp = client.delete("/registration/my-codes/does-not-exist", headers=headers)
        assert resp.status_code == 404

    def test_unauthenticated_returns_401(self, client):
        resp = client.delete("/registration/my-codes/abc")
        assert resp.status_code == 401

    def test_removed_code_not_searchable(self, client, db):
        headers = self._create_code(client, db, name="SearchMe")
        code_id = client.get("/registration/my-codes", headers=headers).json()[0]["id"]
        client.delete(f"/registration/my-codes/{code_id}", headers=headers)

        from app.services.search_service import search_by_name
        assert search_by_name(db, "SearchMe") is None


class TestDataIntegrity:
    """Tests for AC 6.17–6.22: idempotency, coordinate validation, duplicate prevention,
    email uniqueness, and address field length limits."""

    # --- AC 6.17: Idempotency ---

    def test_idempotency_key_returns_cached_response(self, client, db):
        """Same key on rapid re-submit returns identical response; no duplicate record created."""
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
        headers = auth_headers(client)

        resp1 = client.post("/registration/traditional", json=base_registration_payload(), headers=headers)
        assert resp1.status_code == 201

        resp2 = client.post("/registration/traditional", json=base_registration_payload(), headers=headers)
        assert resp2.status_code == 409

    def test_idempotency_cache_scoped_to_owning_user(self, client, db):
        """Reusing another user's idempotency key must never leak their cached data."""

        # User A registers and caches a response under the idempotency key
        headers_a = auth_headers(client, email="user-a@example.com")
        headers_a["X-Idempotency-Key"] = "shared-idem-key-777"
        resp_a = client.post(
            "/registration/traditional",
            json=base_registration_payload(name="AlphaHome"),
            headers=headers_a,
        )
        assert resp_a.status_code == 201

        # User B submits with the SAME idempotency key — must get their own
        # registration, never user A's cached code_name/address.
        headers_b = auth_headers(client, email="user-b@example.com")
        headers_b["X-Idempotency-Key"] = "shared-idem-key-777"
        resp_b = client.post(
            "/registration/traditional",
            json=base_registration_payload(name="BetaHome"),
            headers=headers_b,
        )
        assert resp_b.status_code == 201
        assert resp_b.json()["code_name"] == "BetaHome"
        assert resp_b.json()["id"] != resp_a.json()["id"]
        assert resp_b.json()["street_address"] == "MG Road"

        # User A's retry with the key still returns their cached response
        resp_a_retry = client.post(
            "/registration/traditional",
            json=base_registration_payload(name="MyHome"),
            headers=headers_a,
        )
        assert resp_a_retry.status_code == 201
        assert resp_a_retry.json()["id"] == resp_a.json()["id"]

    # --- Multiple residents allowed at the same address ---

    def test_same_address_allows_multiple_entries(self, client, db):
        """A flat may house many people; registration must not be blocked by proximity."""
        headers = auth_headers(client)
        make_cyracode(db, "Existing", lat=12.9716, lng=77.5946, country_code="IN")
        payload = base_registration_payload(name="NewName", latitude=12.97161, longitude=77.59461)
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
        """AC 6.22: flat_number / plot_number exceeding 50 characters is rejected."""
        headers = auth_headers(client)
        payload = base_registration_payload(flat_number="F" * 51)
        resp = client.post("/registration/traditional", json=payload, headers=headers)
        assert resp.status_code == 422

    def test_plot_number_over_50_chars_returns_422(self, client):
        """AC 6.22: plot_number exceeding 50 characters is rejected."""
        headers = auth_headers(client)
        payload = base_registration_payload(plot_number="P" * 51)
        resp = client.post("/registration/traditional", json=payload, headers=headers)
        assert resp.status_code == 422

    def test_po_box_over_10_chars_returns_422(self, client):
        """AC 6.22: po_box exceeding 10 characters is rejected."""
        headers = auth_headers(client)
        payload = base_registration_payload(po_box="D" * 11)
        resp = client.post("/registration/traditional", json=payload, headers=headers)
        assert resp.status_code == 422

    def test_landmark_over_100_chars_returns_422(self, client):
        """AC 6.22: landmark exceeding 100 characters is rejected."""
        headers = auth_headers(client)
        payload = base_registration_payload(landmark="L" * 101)
        resp = client.post("/registration/traditional", json=payload, headers=headers)
        assert resp.status_code == 422
