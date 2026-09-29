"""Unit tests for the contact-enquiry email composition.

These assert on the assembled MIME message rather than sending anything: the
header-injection cases in particular are only observable by inspecting the
message that would have gone out.
"""
from email import message_from_string
from unittest.mock import MagicMock, patch

from app.services.email_service import _header_safe, send_contact_message_email

SENDER = "visitor@example.com"
SUPPORT = "support@cyracode.com"


def _send(**overrides):
    """Send a contact mail with a fake SMTP server, returning the parsed message."""
    fields = {
        "to_email": SUPPORT,
        "name": "Priya Raman",
        "sender_email": SENDER,
        "address": "12 Park Street",
        "message": "Hello there",
    }
    fields.update(overrides)

    server = MagicMock()
    smtp_cm = MagicMock()
    smtp_cm.__enter__.return_value = server
    smtp_cm.__exit__.return_value = False
    with patch("app.services.email_service.settings.SMTP_HOST", "smtp.test"), patch(
        "app.services.email_service.smtplib.SMTP", return_value=smtp_cm
    ) as smtp:
        assert send_contact_message_email(**fields) is True

    smtp.assert_called_once()
    args = server.sendmail.call_args[0]
    assert args[0] == "noreply@cyracode.com"
    assert args[1] == SUPPORT
    return message_from_string(args[2])


def _body(msg, subtype):
    """Return the text of one MIME part."""
    for part in msg.walk():
        if part.get_content_type() == f"text/{subtype}":
            return part.get_payload(decode=True).decode("utf-8")
    raise AssertionError(f"no text/{subtype} part in message")


def _header_names(msg):
    return [k.lower() for k in msg.keys()]


def test_sends_to_the_support_inbox():
    assert _send()["To"] == SUPPORT


def test_sets_reply_to_so_support_can_reply_directly():
    assert _send()["Reply-To"] == SENDER


def test_reply_to_reflects_a_changed_sender():
    msg = _send(sender_email="someone.else@example.org")
    assert msg["Reply-To"] == "someone.else@example.org"


def test_subject_mentions_the_sender_name():
    assert "Priya Raman" in _send()["Subject"]


def test_body_carries_every_field():
    plain = _body(_send(), "plain")
    for value in ("Priya Raman", SENDER, "12 Park Street", "Hello there"):
        assert value in plain


# ---------- Header injection ----------

def test_newline_in_name_cannot_inject_a_header():
    """A CR/LF in a visitor field must not let them append headers of their own."""
    msg = _send(name="Evil\r\nBcc: victim@example.com")

    # The injected text is flattened into the Subject value, so "Bcc:" appears as
    # substrings of a header — but never as a header of its own.
    assert "bcc" not in _header_names(msg)
    assert "Evil Bcc: victim@example.com" in msg["Subject"]


def test_newline_in_name_cannot_split_the_raw_message():
    """A smuggled CRLF must not create a new line in the serialised message."""
    server_msg = _send(name="Evil\r\nBcc: victim@example.com")
    header_block = str(server_msg).split("\n\n")[0]
    assert not any(
        line.lower().startswith("bcc:") for line in header_block.splitlines()
    )


def test_newline_in_reply_to_is_stripped():
    msg = _send(sender_email="a@b.com\r\nX-Injected: yes")
    assert "x-injected" not in _header_names(msg)
    assert "a@b.com X-Injected: yes" in msg["Reply-To"]


def test_header_safe_flattens_all_line_breaks():
    assert _header_safe("a\r\nb") == "a b"
    assert _header_safe("a\nb") == "a b"
    assert _header_safe("a\r\n\n\nb") == "a b"
    assert _header_safe("  padded  ") == "padded"
    assert _header_safe(None) == ""


# ---------- HTML escaping ----------

def test_html_part_escapes_injected_markup():
    html = _body(_send(message="<script>alert(1)</script>"), "html")
    assert "<script>" not in html
    assert "&lt;script&gt;" in html


def test_html_part_escapes_the_name_and_address():
    html = _body(_send(name="<b>bold</b>", address="<i>x</i>"), "html")
    assert "<b>bold</b>" not in html
    assert "<i>x</i>" not in html
    assert "&lt;b&gt;bold&lt;/b&gt;" in html


def test_plain_part_is_untouched_by_html_escaping():
    """The plain-text alternative is not HTML, so it must not be entity-encoded."""
    plain = _body(_send(message="a < b & c"), "plain")
    assert "a < b & c" in plain


# ---------- Dev fallback ----------

def test_falls_back_to_console_when_smtp_unconfigured(capsys):
    with patch("app.services.email_service.settings.SMTP_HOST", ""):
        assert send_contact_message_email(
            to_email=SUPPORT,
            name="Priya",
            sender_email=SENDER,
            address="12 Park Street",
            message="Hello there",
        ) is False
    out = capsys.readouterr().out
    assert SUPPORT in out
    assert "Hello there" in out
