"""Integration tests for /auth endpoints."""
from unittest.mock import AsyncMock, patch

import pytest

from tests.conftest import auth_headers, register_user


class TestRegister:
    def test_success_returns_201_with_token(self, client):
        resp = register_user(client)
        assert resp.status_code == 201
        body = resp.json()
        assert "access_token" in body
        assert body["user"]["email"] == "user@example.com"
        assert body["user"]["first_name"] == "Test"

    def test_duplicate_email_returns_409(self, client):
        register_user(client)
        resp = register_user(client)
        assert resp.status_code == 409
        assert "already registered" in resp.json()["detail"]

    def test_weak_password_returns_400(self, client):
        # "alllower1" is ≥8 chars and passes Pydantic min_length but fails
        # validate_password_strength (no uppercase, no special char).
        resp = client.post("/auth/register", json={
            "first_name": "A", "last_name": "B",
            "email": "weak@example.com", "password": "alllower1",
        })
        assert resp.status_code == 400

    def test_password_missing_uppercase_rejected(self, client):
        resp = client.post("/auth/register", json={
            "first_name": "A", "last_name": "B",
            "email": "test@example.com", "password": "nouppercase1!",
        })
        assert resp.status_code == 400

    def test_password_missing_digit_rejected(self, client):
        resp = client.post("/auth/register", json={
            "first_name": "A", "last_name": "B",
            "email": "test@example.com", "password": "NoDigit!abc",
        })
        assert resp.status_code == 400

    def test_password_missing_special_char_rejected(self, client):
        resp = client.post("/auth/register", json={
            "first_name": "A", "last_name": "B",
            "email": "test@example.com", "password": "NoSpecial1",
        })
        assert resp.status_code == 400

    def test_invalid_email_returns_422(self, client):
        resp = client.post("/auth/register", json={
            "first_name": "A", "last_name": "B",
            "email": "not-an-email", "password": "ValidP@ss1",
        })
        assert resp.status_code == 422

    def test_email_stored_lowercase(self, client):
        resp = client.post("/auth/register", json={
            "first_name": "A", "last_name": "B",
            "email": "UPPER@EXAMPLE.COM", "password": "ValidP@ss1",
            "gdpr_consent": True,
        })
        assert resp.status_code == 201
        assert resp.json()["user"]["email"] == "upper@example.com"

    def test_missing_required_fields_returns_422(self, client):
        resp = client.post("/auth/register", json={"email": "a@b.com"})
        assert resp.status_code == 422


class TestLogin:
    def test_success_returns_token(self, client):
        register_user(client)
        resp = client.post("/auth/login", json={
            "email": "user@example.com", "password": "ValidP@ss1",
        })
        assert resp.status_code == 200
        assert "access_token" in resp.json()

    def test_wrong_password_returns_401(self, client):
        register_user(client)
        resp = client.post("/auth/login", json={
            "email": "user@example.com", "password": "WrongP@ss1",
        })
        assert resp.status_code == 401

    def test_nonexistent_email_returns_401(self, client):
        resp = client.post("/auth/login", json={
            "email": "nobody@example.com", "password": "ValidP@ss1",
        })
        assert resp.status_code == 401

    def test_case_insensitive_email(self, client):
        register_user(client)
        resp = client.post("/auth/login", json={
            "email": "USER@EXAMPLE.COM", "password": "ValidP@ss1",
        })
        assert resp.status_code == 200

    def test_remember_me_sets_flag(self, client):
        register_user(client)
        resp = client.post("/auth/login", json={
            "email": "user@example.com",
            "password": "ValidP@ss1",
            "remember_me": True,
        })
        assert resp.status_code == 200

    def test_inactive_user_returns_403(self, client, db):
        register_user(client)
        from app.models.models import User
        user = db.query(User).first()
        user.is_active = False
        db.commit()
        resp = client.post("/auth/login", json={
            "email": "user@example.com", "password": "ValidP@ss1",
        })
        assert resp.status_code == 403


class TestGetMe:
    def test_authenticated_returns_user(self, client):
        headers = auth_headers(client)
        resp = client.get("/auth/me", headers=headers)
        assert resp.status_code == 200
        assert resp.json()["email"] == "user@example.com"

    def test_unauthenticated_returns_401(self, client):
        resp = client.get("/auth/me")
        assert resp.status_code == 401

    def test_invalid_token_returns_401(self, client):
        resp = client.get("/auth/me", headers={"Authorization": "Bearer bogus.token.here"})
        assert resp.status_code == 401

    def test_malformed_header_returns_401(self, client):
        resp = client.get("/auth/me", headers={"Authorization": "NotBearer token"})
        assert resp.status_code == 401


class TestForgotPassword:
    def test_existing_email_returns_generic_message(self, client):
        register_user(client)
        resp = client.post("/auth/forgot-password", json={"email": "user@example.com"})
        assert resp.status_code == 200
        assert "reset link" in resp.json()["message"].lower()

    def test_nonexistent_email_returns_same_message(self, client):
        resp = client.post("/auth/forgot-password", json={"email": "ghost@example.com"})
        assert resp.status_code == 200
        assert "reset link" in resp.json()["message"].lower()

    def test_invalid_email_returns_422(self, client):
        resp = client.post("/auth/forgot-password", json={"email": "not-valid"})
        assert resp.status_code == 422


class TestResetPassword:
    def test_valid_token_updates_password(self, client):
        register_user(client)
        from app.services.auth_service import get_password_reset_token
        token = get_password_reset_token("user@example.com")
        resp = client.post("/auth/reset-password", json={
            "token": token, "new_password": "NewP@ss123!",
        })
        assert resp.status_code == 200
        login = client.post("/auth/login", json={
            "email": "user@example.com", "password": "NewP@ss123!",
        })
        assert login.status_code == 200

    def test_invalid_token_returns_401(self, client):
        resp = client.post("/auth/reset-password", json={
            "token": "invalid.token.here", "new_password": "NewP@ss123!",
        })
        assert resp.status_code == 401

    def test_wrong_token_type_returns_400(self, client):
        token = __import__("app.services.auth_service", fromlist=["create_access_token"]).create_access_token(
            {"sub": "user@example.com", "type": "access"}
        )
        resp = client.post("/auth/reset-password", json={
            "token": token, "new_password": "NewP@ss123!",
        })
        assert resp.status_code == 400

    def test_weak_new_password_returns_400(self, client):
        register_user(client)
        from app.services.auth_service import get_password_reset_token
        token = get_password_reset_token("user@example.com")
        resp = client.post("/auth/reset-password", json={
            "token": token, "new_password": "alllower1",
        })
        assert resp.status_code == 400


class TestProfilePasswordReset:
    def test_unauthenticated_request_returns_401(self, client):
        resp = client.post("/auth/me/reset-password")
        assert resp.status_code == 401

    def test_sends_reset_email_only_to_logged_in_user(self, client):
        from unittest.mock import MagicMock

        from app.config import settings

        headers = auth_headers(client, email="other@example.com")
        with patch("app.api.auth.send_password_reset_email", new_callable=MagicMock) as mailer:
            resp = client.post("/auth/me/reset-password", headers=headers)
        assert resp.status_code == 200
        assert "reset link has been sent" in resp.json()["message"].lower()
        mailer.assert_called_once()
        args = mailer.call_args[0]
        assert args[0] == "other@example.com"
        assert args[1].startswith(settings.FRONTEND_URL)
        assert "/reset-password?token=" in args[1]

    def test_email_delivery_failure_returns_502(self, client):
        from unittest.mock import MagicMock

        headers = auth_headers(client)
        with patch("app.api.auth.send_password_reset_email", new_callable=MagicMock) as mailer:
            mailer.side_effect = Exception("SMTP down")
            resp = client.post("/auth/me/reset-password", headers=headers)
        assert resp.status_code == 502
        assert "password reset email" in resp.json()["detail"].lower()

    def test_audit_log_records_password_reset_request(self, client, db):
        from unittest.mock import MagicMock

        from app.models.models import AuditLog, User

        headers = auth_headers(client)
        with patch("app.api.auth.send_password_reset_email", new_callable=MagicMock):
            resp = client.post("/auth/me/reset-password", headers=headers)
        assert resp.status_code == 200

        user = db.query(User).filter(User.email == "user@example.com").one()
        logs = (
            db.query(AuditLog)
            .filter(
                AuditLog.user_id == user.id,
                AuditLog.action == "password_reset_request",
            )
            .all()
        )
        assert len(logs) == 1


class TestGoogleAuth:
    def test_invalid_google_token_returns_401(self, client):
        with patch("app.api.auth.httpx.AsyncClient") as mock_client_cls:
            mock_response = AsyncMock()
            mock_response.status_code = 400
            mock_client_cls.return_value.__aenter__.return_value.get = AsyncMock(
                return_value=mock_response
            )
            resp = client.post("/auth/google", json={"token": "bad-token"})
        assert resp.status_code == 401

    def test_valid_google_token_creates_user(self, client):
        from unittest.mock import MagicMock
        from app.config import settings
        google_info = {
            "sub": "google-uid-123",
            "email": "googleuser@gmail.com",
            "given_name": "Google",
            "family_name": "User",
            "aud": settings.GOOGLE_CLIENT_ID or "test-audience",
        }
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = google_info

        mock_inner = AsyncMock()
        mock_inner.get = AsyncMock(return_value=mock_response)

        mock_cm = AsyncMock()
        mock_cm.__aenter__ = AsyncMock(return_value=mock_inner)
        mock_cm.__aexit__ = AsyncMock(return_value=False)

        with patch("app.api.auth.httpx.AsyncClient", return_value=mock_cm):
            resp = client.post("/auth/google", json={"token": "valid-token"})
        assert resp.status_code == 200
        assert resp.json()["user"]["email"] == "googleuser@gmail.com"

    def test_google_token_audience_mismatch_returns_401(self, client):
        from unittest.mock import MagicMock
        from app.config import settings
        google_info = {
            "sub": "google-uid-123",
            "email": "googleuser@gmail.com",
            "given_name": "Google",
            "family_name": "User",
            "aud": "some-other-client-id.apps.googleusercontent.com",
        }
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = google_info

        mock_inner = AsyncMock()
        mock_inner.get = AsyncMock(return_value=mock_response)

        mock_cm = AsyncMock()
        mock_cm.__aenter__ = AsyncMock(return_value=mock_inner)
        mock_cm.__aexit__ = AsyncMock(return_value=False)

        with patch("app.api.auth.httpx.AsyncClient", return_value=mock_cm):
            resp = client.post("/auth/google", json={"token": "valid-token"})
        assert resp.status_code == 401
