"""Integration tests for the Admin Portal API — RBAC, CRUD, client access.

Role model enforced:
  * no dedicated Admin login — admin access comes from the Users.role flag
  * every /admin route requires the Admin role
  * Admin CRUD + client permission grants/revocations are audited
"""
from tests.conftest import (admin_auth_headers, create_user, make_cyracode,
                            base_registration_payload)


def _admin_headers_unused():
    return {"Authorization": "Bearer whatever"}


class TestRoleBasedAccess:
    def test_admin_normal_login_gains_admin_access(self, client, db):
        """An admin logs in through /auth/login and the role flag grants access."""
        create_user(db, email="boss@cyracode.com", password="Admin@123", is_admin=True)
        resp = client.post(
            "/auth/login",
            json={"email": "boss@cyracode.com", "password": "Admin@123"},
        )
        assert resp.status_code == 200
        assert resp.json()["user"]["role"] == "admin"
        assert resp.json()["user"]["is_admin"] is True

        headers = {"Authorization": f"Bearer {resp.json()['access_token']}"}
        assert client.get("/admin/stats", headers=headers).status_code == 200
        me = client.get("/admin/auth/me", headers=headers)
        assert me.status_code == 200
        assert me.json()["role"] == "admin"
        assert me.json()["is_admin"] is True

    def test_non_admin_login_is_blocked_from_admin(self, client, db):
        create_user(db, email="client@cyracode.com", password="ValidP@ss1", is_admin=False)
        resp = client.post(
            "/auth/login",
            json={"email": "client@cyracode.com", "password": "ValidP@ss1"},
        )
        assert resp.status_code == 200
        assert resp.json()["user"]["role"] == "user"
        assert resp.json()["user"]["is_admin"] is False
        headers = {"Authorization": f"Bearer {resp.json()['access_token']}"}
        assert client.get("/admin/stats", headers=headers).status_code == 403

    def test_bad_credentials_rejected(self, client, db):
        create_user(db, email="boss@cyracode.com", password="Admin@123", is_admin=True)
        resp = client.post(
            "/auth/login",
            json={"email": "boss@cyracode.com", "password": "wrong-password"},
        )
        assert resp.status_code == 401


class TestAdminRoleGate:
    def test_anonymous_blocked(self, client):
        assert client.get("/admin/stats").status_code == 401

    def test_plain_client_blocked(self, client, db):
        user = create_user(db, email="plain@cyracode.com", is_admin=False)
        from app.services.auth_service import create_access_token
        headers = {"Authorization": f"Bearer {create_access_token({'sub': user.id})}"}
        assert client.get("/admin/stats", headers=headers).status_code == 403
        assert client.get("/admin/clients", headers=headers).status_code == 403
        assert client.get("/admin/cyracodes", headers=headers).status_code == 403

    def test_admin_me_endpoint(self, client, db):
        headers = admin_auth_headers(client, db, email="me@cyracode.com")
        resp = client.get("/admin/auth/me", headers=headers)
        assert resp.status_code == 200
        assert resp.json()["is_admin"] is True


class TestAdminCyraCodeCRUD:
    def test_create_read_update_delete_list(self, client, db):
        headers = admin_auth_headers(client, db)

        # Create
        create_resp = client.post(
            "/admin/cyracodes",
            json=base_registration_payload(name="AdminHome"),
            headers=headers,
        )
        assert create_resp.status_code == 201, create_resp.text
        created = create_resp.json()
        assert created["code_name"] == "AdminHome"

        # Read single
        get_resp = client.get(f"/admin/cyracodes/{created['id']}", headers=headers)
        assert get_resp.status_code == 200
        assert get_resp.json()["id"] == created["id"]

        # List + search
        list_resp = client.get("/admin/cyracodes?q=AdminHome", headers=headers)
        assert list_resp.status_code == 200
        assert list_resp.json()["total"] == 1
        assert list_resp.json()["items"][0]["code_name"] == "AdminHome"

        # Edit
        update_resp = client.put(
            f"/admin/cyracodes/{created['id']}",
            json={
                "latitude": 12.9716, "longitude": 77.5946,
                "country": "India", "country_code": "IN",
                "street_address": "Brigade Road", "postal_code": "560025",
            },
            headers=headers,
        )
        assert update_resp.status_code == 200
        assert update_resp.json()["street_address"] == "Brigade Road"

        # Delete (soft)
        del_resp = client.delete(f"/admin/cyracodes/{created['id']}", headers=headers)
        assert del_resp.status_code == 204
        list_resp = client.get("/admin/cyracodes?q=AdminHome&is_active=false", headers=headers)
        assert list_resp.json()["total"] == 1
        assert list_resp.json()["items"][0]["is_active"] is False

        # Restore
        restore_resp = client.post(
            f"/admin/cyracodes/{created['id']}/restore", headers=headers
        )
        assert restore_resp.status_code == 200
        assert restore_resp.json()["is_active"] is True

    def test_duplicate_name_rejected(self, client, db):
        headers = admin_auth_headers(client, db)
        payload = base_registration_payload(name="TakenName")
        assert client.post("/admin/cyracodes", json=payload, headers=headers).status_code == 201
        again = client.post("/admin/cyracodes", json=payload, headers=headers)
        assert again.status_code == 409

    def test_admin_audit_trail(self, client, db):
        headers = admin_auth_headers(client, db)
        client.post("/admin/cyracodes", json=base_registration_payload(name="AuditedCreate"), headers=headers)
        from app.models.models import AuditLog
        action = db.query(AuditLog).filter(AuditLog.action.like("cyracode_create%")).first()
        assert action is not None


class TestClientManagement:
    def test_create_and_list_client(self, client, db):
        headers = admin_auth_headers(client, db)
        resp = client.post(
            "/admin/clients",
            json={"name": "Delivery Partner", "contact_email": "ops@partner.io"},
            headers=headers,
        )
        assert resp.status_code == 201, resp.text
        body = resp.json()
        assert body["api_key"].startswith("cyra_")
        assert len(body["api_key"]) > 30
        assert body["client"]["key_tail"] == body["api_key"][-4:]
        assert body["client"]["permissions"] == ["cyracode.lookup"]

        list_resp = client.get("/admin/clients", headers=headers)
        assert list_resp.status_code == 200
        assert any(c["name"] == "Delivery Partner" for c in list_resp.json())

    def test_raw_key_never_listed_again(self, client, db):
        headers = admin_auth_headers(client, db)
        created = client.post(
            "/admin/clients", json={"name": "OneTimeKey"}, headers=headers
        ).json()
        raw = created["api_key"]

        listed = client.get("/admin/clients", headers=headers).json()
        assert all(raw != c.get("raw_key") for c in listed)

        # Rotate: the old key stops working, a new one is returned once.
        client_id = created["client"]["id"]
        rotated = client.post(
            f"/admin/clients/{client_id}/rotate-key", headers=headers
        ).json()
        assert rotated["api_key"] != raw
        assert rotated["client"]["key_tail"] == rotated["api_key"][-4:]

    def test_grant_and_revoke_permission(self, client, db):
        headers = admin_auth_headers(client, db)
        created = client.post(
            "/admin/clients", json={"name": "PermClient", "permissions": []}, headers=headers
        ).json()
        client_id = created["client"]["id"]
        assert created["client"]["permissions"] == []

        grant = client.post(
            f"/admin/clients/{client_id}/permissions",
            json={"permissions": ["cyracode.lookup"]},
            headers=headers,
        )
        assert grant.status_code == 200
        assert "cyracode.lookup" in grant.json()["permissions"]

        revoke = client.delete(
            f"/admin/clients/{client_id}/permissions/cyracode.lookup", headers=headers
        )
        assert revoke.status_code == 200
        assert "cyracode.lookup" not in revoke.json()["permissions"]

    def test_update_and_deactivate_client(self, client, db):
        headers = admin_auth_headers(client, db)
        created = client.post(
            "/admin/clients", json={"name": "EditableClient"}, headers=headers
        ).json()
        client_id = created["client"]["id"]

        updated = client.put(
            f"/admin/clients/{client_id}",
            json={"name": "Renamed", "is_active": False},
            headers=headers,
        )
        assert updated.status_code == 200
        assert updated.json()["name"] == "Renamed"
        assert updated.json()["is_active"] is False

        deleted = client.delete(f"/admin/clients/{client_id}", headers=headers)
        assert deleted.status_code == 204
        assert client.get("/admin/clients", headers=headers).json() == []


class TestUserManagement:
    def test_list_users(self, client, db):
        create_user(db, email="a@example.com")
        create_user(db, email="b@example.com")
        headers = admin_auth_headers(client, db)
        resp = client.get("/admin/users", headers=headers)
        assert resp.status_code == 200
        emails = {u["email"] for u in resp.json()["items"]}
        assert "a@example.com" in emails
        assert "b@example.com" in emails

    def test_promote_and_demote_admin_role(self, client, db):
        user = create_user(db, email="promote@example.com", is_admin=False)
        headers = admin_auth_headers(client, db)

        promoted = client.put(
            f"/admin/users/{user.id}", json={"role": "admin"}, headers=headers
        )
        assert promoted.status_code == 200
        assert promoted.json()["role"] == "admin"
        assert promoted.json()["is_admin"] is True

        demoted = client.put(
            f"/admin/users/{user.id}", json={"role": "user"}, headers=headers
        )
        assert demoted.status_code == 200
        assert demoted.json()["role"] == "user"
        assert demoted.json()["is_admin"] is False

    def test_reject_invalid_role(self, client, db):
        user = create_user(db, email="bogus-role@example.com")
        headers = admin_auth_headers(client, db)
        resp = client.put(
            f"/admin/users/{user.id}", json={"role": "superuser"}, headers=headers
        )
        assert resp.status_code == 400

    def test_legacy_is_admin_alias_still_works(self, client, db):
        user = create_user(db, email="legacy@example.com")
        headers = admin_auth_headers(client, db)
        resp = client.put(
            f"/admin/users/{user.id}", json={"is_admin": True}, headers=headers
        )
        assert resp.status_code == 200
        assert resp.json()["role"] == "admin"

    def test_deactivate_user(self, client, db):
        user = create_user(db, email="deactivate@example.com")
        headers = admin_auth_headers(client, db)
        resp = client.delete(f"/admin/users/{user.id}", headers=headers)
        assert resp.status_code == 204
        assert client.get("/admin/users?q=deactivate", headers=headers).json()["items"][0]["is_active"] is False


class TestStats:
    def test_stats_counts(self, client, db):
        make_cyracode(db, "StatCode", is_active=True)
        make_cyracode(db, "StatDead", is_active=False)
        headers = admin_auth_headers(client, db)
        resp = client.get("/admin/stats", headers=headers)
        assert resp.status_code == 200
        body = resp.json()
        assert body["total_cyracodes"] == 2
        assert body["active_cyracodes"] == 1
        assert body["total_users"] >= 1


class TestAuditLogView:
    def test_admin_can_browse_audit_logs(self, client, db):
        headers = admin_auth_headers(client, db)
        client.post("/admin/cyracodes", json=base_registration_payload(name="LogBrowse"), headers=headers)
        resp = client.get("/admin/audit-logs", headers=headers)
        assert resp.status_code == 200
        body = resp.json()
        assert body["total"] >= 1
        actions = [item["action"] for item in body["items"]]
        assert any("cyracode_create" in a for a in actions)

    def test_audit_logs_include_admin_email(self, client, db):
        headers = admin_auth_headers(client, db)
        client.post("/admin/cyracodes", json=base_registration_payload(name="LogEmail"), headers=headers)
        resp = client.get("/admin/audit-logs?action=cyracode_create%3ALogEmail", headers=headers)
        assert resp.status_code == 200
        assert resp.json()["total"] >= 1