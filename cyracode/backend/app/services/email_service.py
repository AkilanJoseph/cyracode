import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.config import settings


def _smtp_send(to_email: str, subject: str, plain: str, html: str) -> bool:
    """Shared SMTP helper; falls back to console logging when SMTP_HOST is absent."""
    if not settings.SMTP_HOST:
        print(f"[DEV EMAIL] To: {to_email} | Subject: {subject}")
        print(plain)
        return False

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = settings.SMTP_FROM
    msg["To"] = to_email
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
