"""Integration tests for /otp endpoints."""
from unittest.mock import patch


class TestSendOTP:
    def test_success(self, client):
        resp = client.post("/otp/send", json={"mobile": "+911234567890"})
        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert body["expires_in"] == 300

    def test_cooldown_within_30s(self, client):
        client.post("/otp/send", json={"mobile": "+911234567890"})
        resp = client.post("/otp/send", json={"mobile": "+911234567890"})
        assert resp.status_code == 429
        assert "wait" in resp.json()["detail"].lower()

    def test_different_mobiles_independent(self, client):
        r1 = client.post("/otp/send", json={"mobile": "+911111111111"})
        r2 = client.post("/otp/send", json={"mobile": "+912222222222"})
        assert r1.status_code == 200
        assert r2.status_code == 200

    def test_short_mobile_fails(self, client):
        resp = client.post("/otp/send", json={"mobile": "12"})
        assert resp.status_code == 422

    def test_too_long_mobile_fails(self, client):
        resp = client.post("/otp/send", json={"mobile": "+1" + "9" * 20})
        assert resp.status_code == 422


class TestVerifyOTP:
    def test_correct_otp_succeeds(self, client):
        with patch("app.services.otp_service.generate_otp", return_value="654321"):
            client.post("/otp/send", json={"mobile": "+911234567890"})
        resp = client.post("/otp/verify", json={"mobile": "+911234567890", "otp": "654321"})
        assert resp.status_code == 200
        assert resp.json()["verified"] is True

    def test_wrong_otp_returns_400(self, client):
        with patch("app.services.otp_service.generate_otp", return_value="111111"):
            client.post("/otp/send", json={"mobile": "+911234567890"})
        resp = client.post("/otp/verify", json={"mobile": "+911234567890", "otp": "000000"})
        assert resp.status_code == 400

    def test_no_record_returns_404(self, client):
        resp = client.post("/otp/verify", json={"mobile": "+919999999999", "otp": "123456"})
        assert resp.status_code == 404

    def test_too_many_attempts_locks(self, client):
        with patch("app.services.otp_service.generate_otp", return_value="777777"):
            client.post("/otp/send", json={"mobile": "+911234567890"})
        for _ in range(5):
            client.post("/otp/verify", json={"mobile": "+911234567890", "otp": "000000"})
        resp = client.post("/otp/verify", json={"mobile": "+911234567890", "otp": "777777"})
        assert resp.status_code == 429

    def test_short_otp_fails_validation(self, client):
        resp = client.post("/otp/verify", json={"mobile": "+911234567890", "otp": "12"})
        assert resp.status_code == 422

    def test_used_otp_cannot_be_reused(self, client):
        with patch("app.services.otp_service.generate_otp", return_value="888888"):
            client.post("/otp/send", json={"mobile": "+910000000000"})
        client.post("/otp/verify", json={"mobile": "+910000000000", "otp": "888888"})
        resp = client.post("/otp/verify", json={"mobile": "+910000000000", "otp": "888888"})
        assert resp.status_code == 404
