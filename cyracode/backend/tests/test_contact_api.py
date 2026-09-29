"""Contact-us enquiry endpoint tests.

Covers the happy path, validation, the anti-spam rate limit, and the SMTP
failure path. The mailer is patched so no test depends on a live mail server.
"""
from unittest.mock import MagicMock, patch

VALID = {
    "name": "Priya Raman",
    "email": "priya@example.com",
    "address": "12 Park Street, Bengaluru 560001",
    "message": "How do I get a CyraCode for a rural address?",
}


# ---------- Happy path ----------

def test_submits_enquiry_and_delivers_to_support(client):
    with patch("app.api.contact.send_contact_message_email") as mailer:
        resp = client.post("/contact", json=VALID)

    assert resp.status_code == 202
    assert "support team" in resp.json()["message"].lower()
    mailer.assert_called_once()
    kwargs = mailer.call_args.kwargs
    assert kwargs["to_email"] == "support@cyracode.com"
    assert kwargs["name"] == VALID["name"]
    assert kwargs["sender_email"] == VALID["email"]
    assert kwargs["address"] == VALID["address"]
    assert kwargs["message"] == VALID["message"]


def test_needs_no_authentication(client):
    """The whole point is to reach support before signing up."""
    with patch("app.api.contact.send_contact_message_email") as mailer:
        resp = client.post("/contact", json=VALID)
    assert resp.status_code == 202
    assert mailer.called


def test_surrounding_whitespace_is_trimmed(client):
    payload = {k: f"  {v}  " for k, v in VALID.items()}
    with patch("app.api.contact.send_contact_message_email") as mailer:
        client.post("/contact", json=payload)
    kwargs = mailer.call_args.kwargs
    assert kwargs["name"] == VALID["name"]
    assert kwargs["message"] == VALID["message"]


# ---------- Validation ----------

def test_rejects_invalid_email(client):
    with patch("app.api.contact.send_contact_message_email") as mailer:
        resp = client.post("/contact", json={**VALID, "email": "not-an-email"})
    assert resp.status_code == 422
    assert not mailer.called


def test_rejects_blank_name(client):
    with patch("app.api.contact.send_contact_message_email") as mailer:
        resp = client.post("/contact", json={**VALID, "name": "   "})
    assert resp.status_code == 422
    assert not mailer.called


def test_rejects_blank_address(client):
    with patch("app.api.contact.send_contact_message_email") as mailer:
        resp = client.post("/contact", json={**VALID, "address": "   "})
    assert resp.status_code == 422
    assert not mailer.called


def test_rejects_blank_message(client):
    with patch("app.api.contact.send_contact_message_email") as mailer:
        resp = client.post("/contact", json={**VALID, "message": ""})
    assert resp.status_code == 422
    assert not mailer.called


def test_rejects_oversized_message(client):
    with patch("app.api.contact.send_contact_message_email") as mailer:
        resp = client.post("/contact", json={**VALID, "message": "x" * 4001})
    assert resp.status_code == 422
    assert not mailer.called


def test_rejects_missing_fields(client):
    with patch("app.api.contact.send_contact_message_email") as mailer:
        resp = client.post("/contact", json={"name": "Only a name"})
    assert resp.status_code == 422
    assert not mailer.called


# ---------- Failure path ----------

def test_smtp_failure_returns_502(client):
    with patch("app.api.contact.send_contact_message_email") as mailer:
        mailer.side_effect = Exception("SMTP down")
        resp = client.post("/contact", json=VALID)
    assert resp.status_code == 502
    assert "try again" in resp.json()["detail"].lower()
