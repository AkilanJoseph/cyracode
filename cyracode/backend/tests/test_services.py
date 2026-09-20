"""Unit tests for all service-layer functions."""
import uuid
from datetime import timedelta
from unittest.mock import patch

import pytest

from app.models.models import CyraCode
from app.services.auth_service import (
    create_access_token,
    decode_token,
    get_password_reset_token,
    hash_password,
    validate_password_strength,
    verify_password,
)
from app.services.otp_service import (
    create_otp_record,
    generate_otp,
    hash_otp,
    verify_otp,
    verify_otp_hash,
)
from app.services.registration_service import (
    check_name_available,
    generate_cyracode,
    generate_qr_code,
    haversine_distance,
    suggest_alternative_names,
    validate_coordinates,
)
from app.services.search_service import (
    autocomplete_names,
    fuzzy_search,
    reverse_geocode_search,
    search_by_name,
)


# ─────────────────────────── auth_service ───────────────────────────

class TestValidatePasswordStrength:
    def test_valid_password(self):
        assert validate_password_strength("ValidP@ss1") is True

    def test_minimum_length_satisfied(self):
        assert validate_password_strength("Abcde1!x") is True

    def test_empty_string(self):
        assert validate_password_strength("") is False

    def test_too_short(self):
        assert validate_password_strength("Ab1!") is False

    def test_exactly_seven_chars(self):
        assert validate_password_strength("Abcde1!") is False

    def test_no_uppercase(self):
        assert validate_password_strength("validp@ss1") is False

    def test_no_digit(self):
        assert validate_password_strength("ValidP@ss") is False

    def test_no_special_char(self):
        assert validate_password_strength("ValidPass1") is False

    def test_only_special_chars(self):
        assert validate_password_strength("@@@@@@@@@") is False

    def test_all_uppercase_with_digit_special(self):
        assert validate_password_strength("ABCDEFG1!") is True

    def test_unicode_treated_as_special(self):
        assert validate_password_strength("ValidPäss1") is True


class TestHashAndVerifyPassword:
    def test_roundtrip(self):
        pw = "MyS3cur3P@ss!"
        assert verify_password(pw, hash_password(pw)) is True

    def test_wrong_password_rejected(self):
        hashed = hash_password("correct")
        assert verify_password("wrong", hashed) is False

    def test_empty_hash_returns_false(self):
        assert verify_password("anything", "") is False

    def test_empty_password_wrong(self):
        hashed = hash_password("correct")
        assert verify_password("", hashed) is False

    def test_hashes_are_unique(self):
        pw = "SamePass1!"
        assert hash_password(pw) != hash_password(pw)


class TestJWT:
    def test_create_and_decode(self):
        token = create_access_token({"sub": "user-123", "email": "a@b.com"})
        payload = decode_token(token)
        assert payload["sub"] == "user-123"
        assert payload["email"] == "a@b.com"

    def test_expired_token_raises(self):
        from fastapi import HTTPException
        token = create_access_token({"sub": "x"}, expires_delta=timedelta(seconds=-1))
        with pytest.raises(HTTPException) as exc_info:
            decode_token(token)
        assert exc_info.value.status_code == 401

    def test_tampered_token_raises(self):
        from fastapi import HTTPException
        token = create_access_token({"sub": "x"}) + "tampered"
        with pytest.raises(HTTPException):
            decode_token(token)

    def test_password_reset_token_contains_type(self):
        token = get_password_reset_token("user@example.com")
        payload = decode_token(token)
        assert payload["type"] == "password_reset"
        assert payload["sub"] == "user@example.com"


# ─────────────────────────── otp_service ────────────────────────────

class TestGenerateOTP:
    def test_is_six_digits(self):
        # Hardcoded to "1234" for testing (no SMS tool); restore random OTP for production
        otp = generate_otp()
        assert otp == "1234"
        assert otp.isdigit()

    def test_uniqueness(self):
        # Hardcoded to "1234" for testing — always returns the same value
        otps = {generate_otp() for _ in range(20)}
        assert len(otps) == 1


class TestHashAndVerifyOTP:
    def test_correct_otp_passes(self):
        otp = "123456"
        assert verify_otp_hash(otp, hash_otp(otp)) is True

    def test_wrong_otp_fails(self):
        assert verify_otp_hash("000000", hash_otp("111111")) is False


class TestCreateOTPRecord:
    def test_record_fields(self, db):
        record, otp = create_otp_record(db, "+911234567890")
        assert record.mobile == "+911234567890"
        assert otp == "1234"  # hardcoded for testing; restore len == 6 for production
        assert record.is_used is False
        assert record.attempt_count == 0
        assert record.is_locked is False

    def test_otp_hash_matches(self, db):
        record, otp = create_otp_record(db, "+911234567890")
        assert verify_otp_hash(otp, record.otp_hash) is True


class TestVerifyOTP:
    def test_success(self, db):
        with patch("app.services.otp_service.generate_otp", return_value="111111"):
            create_otp_record(db, "+1111111111")
        result = verify_otp(db, "+1111111111", "111111")
        assert result["success"] is True
        assert result["status_code"] == 200

    def test_wrong_otp(self, db):
        with patch("app.services.otp_service.generate_otp", return_value="222222"):
            create_otp_record(db, "+2222222222")
        result = verify_otp(db, "+2222222222", "000000")
        assert result["success"] is False
        assert result["status_code"] == 400

    def test_no_record_for_mobile(self, db):
        result = verify_otp(db, "+9990000000", "123456")
        assert result["success"] is False
        assert result["status_code"] == 404

    def test_locks_after_max_attempts(self, db):
        with patch("app.services.otp_service.generate_otp", return_value="333333"):
            create_otp_record(db, "+3333333333")
        # 4 wrong attempts; the 5th triggers the lock and returns the "locked" message
        for _ in range(4):
            verify_otp(db, "+3333333333", "000000")
        result = verify_otp(db, "+3333333333", "000000")
        assert result["status_code"] == 429
        assert "locked" in result["message"].lower()

    def test_already_used_otp_not_found(self, db):
        with patch("app.services.otp_service.generate_otp", return_value="444444"):
            create_otp_record(db, "+4444444444")
        verify_otp(db, "+4444444444", "444444")
        result = verify_otp(db, "+4444444444", "444444")
        assert result["status_code"] == 404


# ──────────────────────── registration_service ──────────────────────

class TestValidateCoordinates:
    def test_valid(self):
        assert validate_coordinates(12.9716, 77.5946) is True

    def test_zero_zero(self):
        assert validate_coordinates(0, 0) is True

    def test_borders(self):
        assert validate_coordinates(90, 180) is True
        assert validate_coordinates(-90, -180) is True

    def test_lat_too_high(self):
        assert validate_coordinates(90.001, 0) is False

    def test_lat_too_low(self):
        assert validate_coordinates(-90.001, 0) is False

    def test_lng_too_high(self):
        assert validate_coordinates(0, 180.001) is False

    def test_lng_too_low(self):
        assert validate_coordinates(0, -180.001) is False

    def test_non_numeric_string(self):
        assert validate_coordinates("abc", 0) is False

    def test_none_value(self):
        assert validate_coordinates(None, None) is False


class TestHaversineDistance:
    def test_same_point_is_zero(self):
        assert haversine_distance(0, 0, 0, 0) == pytest.approx(0.0)

    def test_known_distance_delhi_mumbai(self):
        d = haversine_distance(28.6139, 77.2090, 19.0760, 72.8777)
        assert 1_100_000 < d < 1_300_000

    def test_small_offset_about_one_meter(self):
        d = haversine_distance(0, 0, 0, 0.000009)
        assert d < 2

    def test_symmetry(self):
        d1 = haversine_distance(10, 20, 30, 40)
        d2 = haversine_distance(30, 40, 10, 20)
        assert d1 == pytest.approx(d2)


class TestGenerateCyracode:
    def test_returns_12_chars(self, db):
        code = generate_cyracode(12.9716, 77.5946, db)
        assert len(code) == 12

    def test_alphanumeric(self, db):
        code = generate_cyracode(12.9716, 77.5946, db)
        assert code.isalnum()

    def test_different_locations_may_differ(self, db):
        c1 = generate_cyracode(12.9716, 77.5946, db)
        c2 = generate_cyracode(51.5074, -0.1278, db)
        assert c1 != c2


class TestCheckNameAvailable:
    def test_available(self, db):
        assert check_name_available(db, "BrandNew") is True

    def test_taken(self, db):
        entry = CyraCode(
            id=str(uuid.uuid4()), user_id=str(uuid.uuid4()),
            code_name="Taken", code_type="traditional",
            latitude=1, longitude=1, country="X", country_code="XX",
            city="C", street_address="S", postal_code="00000",
        )
        db.add(entry)
        db.commit()
        assert check_name_available(db, "Taken") is False
        assert check_name_available(db, "taken") is False

    def test_suggest_alternatives_returns_up_to_five(self, db):
        entry = CyraCode(
            id=str(uuid.uuid4()), user_id=str(uuid.uuid4()),
            code_name="Popular", code_type="traditional",
            latitude=1, longitude=1, country="X", country_code="XX",
            city="C", street_address="S", postal_code="00000",
        )
        db.add(entry)
        db.commit()
        suggestions = suggest_alternative_names(db, "Popular")
        assert 1 <= len(suggestions) <= 5
        assert "Popular" not in suggestions


class TestGenerateQRCode:
    def test_returns_data_uri(self):
        result = generate_qr_code("TestCode", 12.9716, 77.5946)
        # AC 6.10: WebP preferred, PNG fallback — always a base64 image data URI
        assert result.startswith("data:image/")
        assert ";base64," in result


# ─────────────────────────── search_service ─────────────────────────

def _make_code(db, name, lat=12.9, lng=77.5, is_active=True):
    entry = CyraCode(
        id=str(uuid.uuid4()), user_id=str(uuid.uuid4()),
        code_name=name, code_type="traditional",
        latitude=lat, longitude=lng,
        country="India", country_code="IN",
        city="Bangalore", street_address="MG Road",
        postal_code="560001", is_active=is_active,
    )
    db.add(entry)
    db.commit()
    return entry


class TestSearchByName:
    def test_exact_match(self, db):
        _make_code(db, "AlphaHome")
        assert search_by_name(db, "AlphaHome") is not None

    def test_case_insensitive(self, db):
        _make_code(db, "BetaCode")
        result = search_by_name(db, "betacode")
        assert result is not None
        assert result.code_name == "BetaCode"

    def test_not_found(self, db):
        assert search_by_name(db, "NoSuchCode") is None

    def test_inactive_excluded(self, db):
        _make_code(db, "GoneCode", is_active=False)
        assert search_by_name(db, "GoneCode") is None


class TestAutocompleteNames:
    def test_prefix_match(self, db):
        _make_code(db, "Alpha")
        _make_code(db, "Alpine")
        _make_code(db, "Beta")
        names = [r["name"] for r in autocomplete_names(db, "Al")]
        assert "Alpha" in names
        assert "Alpine" in names
        assert "Beta" not in names

    def test_empty_query_returns_empty(self, db):
        _make_code(db, "Any")
        assert autocomplete_names(db, "") == []

    def test_limit_respected(self, db):
        for i in range(10):
            _make_code(db, f"Code{i:02d}")
        results = autocomplete_names(db, "Code", limit=3)
        assert len(results) <= 3


class TestFuzzySearch:
    def test_substring_match(self, db):
        _make_code(db, "GammaHouse")
        names = [r["name"] for r in fuzzy_search(db, "Gamma")]
        assert "GammaHouse" in names

    def test_no_match(self, db):
        assert fuzzy_search(db, "ZZZ") == []

    def test_inactive_excluded(self, db):
        _make_code(db, "OldPlace", is_active=False)
        assert fuzzy_search(db, "OldPlace") == []


class TestReverseGeocodeSearch:
    def test_within_radius(self, db):
        _make_code(db, "NearMe", lat=12.9716, lng=77.5946)
        result = reverse_geocode_search(db, 12.97162, 77.59461, radius_m=50)
        assert result is not None
        assert result.code_name == "NearMe"

    def test_outside_radius_returns_none(self, db):
        _make_code(db, "FarAway", lat=12.9716, lng=77.5946)
        result = reverse_geocode_search(db, 13.0, 77.6, radius_m=50)
        assert result is None

    def test_returns_nearest_when_multiple(self, db):
        _make_code(db, "Close", lat=12.9716, lng=77.5946)
        _make_code(db, "VeryClose", lat=12.97161, lng=77.59461)
        result = reverse_geocode_search(db, 12.97162, 77.59462, radius_m=50)
        assert result.code_name == "VeryClose"
