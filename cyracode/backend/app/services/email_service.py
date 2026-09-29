import html as html_lib
import re
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.config import settings

# Header values (To/From/Subject/Reply-To) are newline-delimited on the wire, so
# a CR/LF smuggled into user-supplied text would let a visitor append headers of
# their own. Strip them before anything reaches a header.
_HEADER_UNSAFE = re.compile(r"[\r\n]+")


def _header_safe(value: str) -> str:
    """Make a value safe to place in an email header."""
    return _HEADER_UNSAFE.sub(" ", value or "").strip()


def _smtp_send(
    to_email: str, subject: str, plain: str, html: str, reply_to: str = ""
) -> bool:
    """Shared SMTP helper; falls back to console logging when SMTP_HOST is absent."""
    to_email = _header_safe(to_email)
    subject = _header_safe(subject)

    if not settings.SMTP_HOST:
        print(f"[DEV EMAIL] To: {to_email} | Subject: {subject}")
        if reply_to:
            print(f"[DEV EMAIL] Reply-To: {reply_to}")
        print(plain)
        return False

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = settings.SMTP_FROM
    msg["To"] = to_email
    if reply_to:
        # Lets support hit Reply and reach the sender without leaving support@.
        msg["Reply-To"] = _header_safe(reply_to)
    msg.attach(MIMEText(plain, "plain"))
    msg.attach(MIMEText(html, "html"))

    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
        server.ehlo()
        server.starttls()
        if settings.SMTP_USER:
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        server.sendmail(settings.SMTP_FROM, to_email, msg.as_string())

    return True


def send_password_reset_email(to_email: str, reset_url: str) -> bool:
    """Send password-reset email; console fallback in dev."""
    valid_hours = settings.PASSWORD_RESET_TOKEN_EXPIRE_HOURS
    subject = "Reset your CyraCode password"
    plain = (
        f"You requested a password reset for your CyraCode account.\n\n"
        f"Click the link below to reset your password "
        f"(valid for {valid_hours} hour(s)):\n{reset_url}\n\n"
        f"If you did not request this, please ignore this email."
    )
    html = f"""<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;color:#1a1a1a">
  <h2>Reset your CyraCode password</h2>
  <p>You requested a password reset for your CyraCode account.</p>
  <p>
    <a href="{reset_url}"
       style="display:inline-block;padding:12px 24px;background:#4f46e5;color:#fff;
              border-radius:8px;text-decoration:none;font-weight:600">
      Reset password
    </a>
  </p>
  <p style="color:#6b7280;font-size:13px">
    This link expires in {valid_hours} hour(s).
    If you did not request a password reset, you can safely ignore this email.
  </p>
</body>
</html>"""
    return _smtp_send(to_email, subject, plain, html)


def send_order_confirmation_email(
    to_email: str, order_no: str, plan_name: str, total_amount: int, currency: str = "USD"
) -> bool:
    """Send a checkout confirmation / receipt (console fallback in dev)."""
    subject = f"Order {order_no} confirmed — {plan_name}"
    plain = (
        f"Thank you! Your {plan_name} order {order_no} is confirmed.\n\n"
        f"Amount charged: {currency} {total_amount}\n\n"
        f"Your CyraCode API key was generated at checkout. Keep it secret and "
        f"store it somewhere safe — it is only shown once.\n\n"
        f"You can review your order history later from the CyraCode website."
    )
    html = f"""<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;color:#1a1a1a">
  <h2>Order confirmed</h2>
  <p>Thank you! Your <strong>{plan_name}</strong> order <strong>{order_no}</strong> is confirmed.</p>
  <p style="font-size:18px">Amount charged: <strong>{currency} {total_amount}</strong></p>
  <p>Your CyraCode API key was generated at checkout. Keep it secret and store it
     somewhere safe — it is only shown once.</p>
  <p style="color:#6b7280;font-size:13px">
    You can review your order history later from the CyraCode website.
  </p>
</body>
</html>"""
    return _smtp_send(to_email, subject, plain, html)


def send_delivery_notification_email(
    to_email: str,
    cyracode_name: str,
    tracking_id: str,
    status: str,
    delivered_at: str,
    has_proof: bool,
) -> bool:
    """AC 6.27: Notify the address owner of a delivery event."""
    subject = f"Delivery update for your CyraCode: {cyracode_name}"
    proof_note = " Proof of delivery has been recorded." if has_proof else ""
    plain = (
        f"Your delivery has been updated.\n\n"
        f"CyraCode: {cyracode_name}\n"
        f"Status: {status}\n"
        f"Time: {delivered_at}\n"
        f"Tracking ID: {tracking_id}\n"
        f"{proof_note}\n\n"
        f"Log in to the CyraCode app to view full delivery history."
    )
    html = f"""<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;color:#1a1a1a">
  <h2>Delivery update</h2>
  <table style="width:100%;border-collapse:collapse">
    <tr><td style="padding:8px;color:#6b7280">CyraCode</td>
        <td style="padding:8px;font-weight:600">{cyracode_name}</td></tr>
    <tr style="background:#f9fafb"><td style="padding:8px;color:#6b7280">Status</td>
        <td style="padding:8px;font-weight:600;text-transform:capitalize">{status.replace("_"," ")}</td></tr>
    <tr><td style="padding:8px;color:#6b7280">Delivery time</td>
        <td style="padding:8px">{delivered_at}</td></tr>
    <tr style="background:#f9fafb"><td style="padding:8px;color:#6b7280">Tracking ID</td>
        <td style="padding:8px">{tracking_id}</td></tr>
    {"<tr><td style='padding:8px;color:#6b7280'>Proof</td><td style='padding:8px'>Photo recorded ✓</td></tr>" if has_proof else ""}
  </table>
  <p style="color:#6b7280;font-size:13px;margin-top:24px">
    Log in to the CyraCode app to view your full delivery history.
  </p>
</body>
</html>"""
    return _smtp_send(to_email, subject, plain, html)


def send_contact_message_email(
    to_email: str,
    name: str,
    sender_email: str,
    address: str,
    message: str,
) -> bool:
    """Forward a Contact-us enquiry from the site widget to the support inbox.

    The visitor's own address goes in Reply-To so replying to the notification
    reaches them directly. Every interpolated value is HTML-escaped because the
    body is assembled into a real HTML mail part from untrusted input.
    """
    name = (name or "").strip()
    sender_email = (sender_email or "").strip()
    address = (address or "").strip()
    message = (message or "").strip()

    subject = f"[Contact] Enquiry from {name or sender_email}"
    plain = (
        f"A new enquiry was submitted from the CyraCode website.\n\n"
        f"Name: {name}\n"
        f"Email: {sender_email}\n"
        f"Address: {address}\n\n"
        f"Message:\n{message}\n\n"
        f"--\nReply to this email to reach {name or 'the sender'} directly."
    )

    esc = html_lib.escape
    html = f"""<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;max-width:560px;margin:auto;padding:32px;color:#1a1a1a">
  <h2>New contact enquiry</h2>
  <table style="width:100%;border-collapse:collapse">
    <tr><td style="padding:8px;color:#6b7280">Name</td>
        <td style="padding:8px;font-weight:600">{esc(name)}</td></tr>
    <tr style="background:#f9fafb"><td style="padding:8px;color:#6b7280">Email</td>
        <td style="padding:8px"><a href="mailto:{esc(sender_email)}">{esc(sender_email)}</a></td></tr>
    <tr><td style="padding:8px;color:#6b7280">Address</td>
        <td style="padding:8px">{esc(address)}</td></tr>
  </table>
  <div style="margin-top:20px;padding:16px;background:#f9fafb;border-radius:8px;
              white-space:pre-wrap">{esc(message)}</div>
  <p style="color:#6b7280;font-size:13px;margin-top:24px">
    Reply to this email to contact {esc(name or "the sender")} directly.
  </p>
</body>
</html>"""
    return _smtp_send(to_email, subject, plain, html, reply_to=sender_email)
