"""Integration tests for the Admin billing layer — plans, subscriptions.

Covers the acceptance criteria behind the Admin Dashboard / Clients / Subscriptions
specs: plan catalog, subscription assignment/renewal/cancellation, derived expiry
statuses, MRR + revenue trend aggregation, and an admin-only surface for all of it.
"""
from datetime import datetime, timedelta

from tests.conftest import admin_auth_headers, make_api_client


def _plan_codes(client, headers) -> set:
    resp = client.get("/admin/plans", headers=headers)
    assert resp.status_code == 200
    return {p["code"] for p in resp.json()}


class TestPlans:
    def test_plan_catalog_seeded(self, client, db):
        headers = admin_auth_headers(client, db)
        codes = _plan_codes(client, headers)
        assert {"basic", "pro", "enterprise"} <= codes

    def test_plans_require_admin(self, client, db):
        assert client.get("/admin/plans").status_code == 401

    def test_create_and_update_plan(self, client, db):
        headers = admin_auth_headers(client, db)
        resp = client.post(
            "/admin/plans",
            json={"code": "gold", "name": "Gold", "monthly_cost": 750},
            headers=headers,
        )
        assert resp.status_code == 201, resp.text
        assert resp.json()["monthly_cost"] == 750

        updated = client.put(
            "/admin/plans/gold",
            json={"monthly_cost": 850},
            headers=headers,
        )
        assert updated.status_code == 200
        assert updated.json()["monthly_cost"] == 850
        assert updated.json()["name"] == "Gold"
        assert "gold" in _plan_codes(client, headers)

    def test_duplicate_plan_code_rejected(self, client, db):
        headers = admin_auth_headers(client, db)
        dup = client.post(
            "/admin/plans",
            json={"code": "Basic", "name": "Basic Copy", "monthly_cost": 1},
            headers=headers,
        )
        assert dup.status_code == 409

    def test_invalid_plan_code_rejected(self, client, db):
        headers = admin_auth_headers(client, db)
        bad = client.post(
            "/admin/plans",
            json={"code": "has space", "name": "Bad", "monthly_cost": 100},
            headers=headers,
        )
        assert bad.status_code == 422

    def test_delete_plan_blocks_in_use(self, client, db):
        headers = admin_auth_headers(client, db)
        cl, _ = make_api_client(db, name="Locked Client")
        client.post(
            f"/admin/clients/{cl.id}/subscription",
            json={"plan": "basic", "months": 3},
            headers=headers,
        )
        resp = client.delete("/admin/plans/basic", headers=headers)
        assert resp.status_code == 409

    def test_delete_unused_plan(self, client, db):
        headers = admin_auth_headers(client, db)
        client.post(
            "/admin/plans",
            json={"code": "gold", "name": "Gold", "monthly_cost": 750},
            headers=headers,
        )
        resp = client.delete("/admin/plans/gold", headers=headers)
        assert resp.status_code == 204
        assert "gold" not in _plan_codes(client, headers)

    def test_plan_edits_survive_reseed(self, client, db):
        """ensure_plans must not clobber admin edits made through the API."""
        headers = admin_auth_headers(client, db)
        _plan_codes(client, headers)  # triggers ensure_plans on the empty table
        edited = client.put("/admin/plans/basic", json={"monthly_cost": 123}, headers=headers)
        assert edited.status_code == 200

        from app.services.admin_service import ensure_plans
        ensure_plans(db)

        plans = {p["code"]: p for p in client.get("/admin/plans", headers=headers).json()}
        assert plans["basic"]["monthly_cost"] == 123


class TestSubscriptionLifecycle:
    def test_assign_plan_updates_client_and_posts_transaction(self, client, db):
        headers = admin_auth_headers(client, db)
        cl, _ = make_api_client(db, name="Billing Client")

        resp = client.post(
            f"/admin/clients/{cl.id}/subscription",
            json={"plan": "pro", "months": 3},
            headers=headers,
        )
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["plan_code"] == "pro"
        assert body["plan_name"] == "Pro"
        assert body["monthly_cost"] == 2000
        assert body["subscription_status"] == "active"

        from app.models.models import Transaction
        txns = db.query(Transaction).all()
        assert len(txns) == 1
        assert txns[0].amount == 2000
        assert txns[0].client_name == "Billing Client"

    def test_change_plan_adds_transaction_but_same_plan_renewal_modifies(self, client, db):
        headers = admin_auth_headers(client, db)
        cl, _ = make_api_client(db, name="Plan Hopper")

        client.post(
            f"/admin/clients/{cl.id}/subscription",
            json={"plan": "basic", "months": 1},
            headers=headers,
        )
        client.post(
            f"/admin/clients/{cl.id}/subscription",
            json={"plan": "enterprise", "months": 6},
            headers=headers,
        )
        client.post(
            f"/admin/clients/{cl.id}/subscription",
            json={"plan": "enterprise", "months": 12},
            headers=headers,
        )

        from app.models.models import Transaction
        txns = db.query(Transaction).order_by(Transaction.created_at).all()
        # 1 (basic) + 1 (changed to enterprise) = 2; same-plan reassign is not billed.
        assert len(txns) == 2
        listed = client.get("/admin/clients", headers=headers).json()
        me = next(c for c in listed if c["id"] == cl.id)
        assert me["plan_code"] == "enterprise"
        assert me["monthly_cost"] == 5000

    def test_renew_extends_end_date_and_bills_again(self, client, db):
        headers = admin_auth_headers(client, db)
        cl, _ = make_api_client(db, name="Renewal Client")

        first = client.post(
            f"/admin/clients/{cl.id}/subscription",
            json={"plan": "basic", "months": 1},
            headers=headers,
        ).json()
        first_end = datetime.fromisoformat(first["expiry_date"].replace("Z", "+00:00"))

        renewed = client.post(
            f"/admin/clients/{cl.id}/subscription/renew",
            json={"months": 1},
            headers=headers,
        ).json()
        renewed_end = datetime.fromisoformat(renewed["expiry_date"].replace("Z", "+00:00"))
        assert renewed_end > first_end

        from app.models.models import Transaction
        assert db.query(Transaction).count() == 2

    def test_renew_rejects_cancelled_subscription(self, client, db):
        headers = admin_auth_headers(client, db)
        cl, _ = make_api_client(db, name="Cancel First")

        client.post(
            f"/admin/clients/{cl.id}/subscription",
            json={"plan": "pro", "months": 2},
            headers=headers,
        )
        cancel = client.post(
            f"/admin/clients/{cl.id}/subscription/cancel", headers=headers
        )
        assert cancel.status_code == 200
        assert cancel.json()["subscription_status"] == "cancelled"

        renew = client.post(
            f"/admin/clients/{cl.id}/subscription/renew",
            json={"months": 1},
            headers=headers,
        )
        assert renew.status_code == 422

    def test_invalid_plan_and_month_range_rejected(self, client, db):
        headers = admin_auth_headers(client, db)
        cl, _ = make_api_client(db, name="Bad Input")

        bad_plan = client.post(
            f"/admin/clients/{cl.id}/subscription",
            json={"plan": "platinum", "months": 1},
            headers=headers,
        )
        assert bad_plan.status_code == 422

        bad_months = client.post(
            f"/admin/clients/{cl.id}/subscription",
            json={"plan": "basic", "months": 0},
            headers=headers,
        )
        assert bad_months.status_code == 422


class TestSubscriptionStatuses:
    def _set_end_date(self, db, client, days_from_now):
        from app.models.models import ClientSubscription
        sub = db.query(ClientSubscription).filter(
            ClientSubscription.client_id == client.id
        ).first()
        sub.end_date = datetime.utcnow() + timedelta(days=days_from_now)
        db.commit()

    def test_expiring_and_expired_derived_states(self, client, db):
        headers = admin_auth_headers(client, db)
        expiring_client, _ = make_api_client(db, name="Expiring Soon")
        expired_client, _ = make_api_client(db, name="Already Expired")
        active_client, _ = make_api_client(db, name="Healthy")

        for cl in (expiring_client, expired_client, active_client):
            client.post(
                f"/admin/clients/{cl.id}/subscription",
                json={"plan": "basic", "months": 6},
                headers=headers,
            )
        self._set_end_date(db, expiring_client, 3)
        self._set_end_date(db, expired_client, -30)

        clients = client.get("/admin/clients", headers=headers).json()
        state = {c["name"]: c["subscription_status"] for c in clients}
        assert state["Expiring Soon"] == "expiring"
        assert state["Already Expired"] == "expired"
        assert state["Healthy"] == "active"

        # Status filter works end-to-end.
        expiring = client.get(
            "/admin/clients?status=expiring", headers=headers
        ).json()
        assert {c["name"] for c in expiring} == {"Expiring Soon"}

        # Plan filter works end-to-end.
        basic = client.get("/admin/clients?plan=basic", headers=headers).json()
        assert {c["name"] for c in basic} == {"Expiring Soon", "Already Expired", "Healthy"}

    def test_subscriptions_list_with_filters(self, client, db):
        headers = admin_auth_headers(client, db)
        a, _ = make_api_client(db, name="Alpha Corp")
        b, _ = make_api_client(db, name="Beta Ltd")

        client.post(
            f"/admin/clients/{a.id}/subscription", json={"plan": "pro", "months": 3}, headers=headers
        )
        client.post(
            f"/admin/clients/{b.id}/subscription", json={"plan": "basic", "months": 1}, headers=headers
        )

        resp = client.get("/admin/subscriptions", headers=headers)
        assert resp.status_code == 200
        assert resp.json()["total"] == 2

        pro = client.get("/admin/subscriptions?plan=pro", headers=headers).json()
        assert pro["total"] == 1
        assert pro["items"][0]["client_name"] == "Alpha Corp"

        search = client.get("/admin/subscriptions?q=beta", headers=headers).json()
        assert search["total"] == 1
        assert search["items"][0]["client_name"] == "Beta Ltd"


class TestDashboard:
    def test_dashboard_starts_empty_and_requires_admin(self, client, db):
        assert client.get("/admin/dashboard").status_code == 401
        headers = admin_auth_headers(client, db)
        resp = client.get("/admin/dashboard", headers=headers)
        assert resp.status_code == 200
        body = resp.json()
        assert body["total_clients"] == 0
        assert body["monthly_recurring_revenue"] == 0
        assert body["renewal_rate"] == 0.0
        assert len(body["revenue_trend"]) == 12
        assert body["recent_transactions"] == []

    def test_dashboard_reflects_subscriptions_and_transactions(self, client, db):
        headers = admin_auth_headers(client, db)
        a, _ = make_api_client(db, name="MRR A")
        b, _ = make_api_client(db, name="MRR B")

        client.post(
            f"/admin/clients/{a.id}/subscription", json={"plan": "enterprise", "months": 6}, headers=headers
        )
        client.post(
            f"/admin/clients/{b.id}/subscription", json={"plan": "basic", "months": 2}, headers=headers
        )
        client.post(
            f"/admin/clients/{b.id}/subscription/renew", json={"months": 1}, headers=headers
        )

        dash = client.get("/admin/dashboard", headers=headers).json()
        assert dash["total_clients"] == 2
        assert dash["monthly_recurring_revenue"] == 5500  # 5000 + 500
        assert dash["active_subscriptions"] == 2
        assert dash["expiring_soon"] == 0
        assert dash["total_subscriptions"] == 2
        by_plan = {p["name"]: p["clients"] for p in dash["subscriptions_by_plan"]}
        assert by_plan == {"Enterprise": 1, "Basic": 1}

        latest_month = dash["revenue_trend"][-1]["month"]
        point = next(p for p in dash["revenue_trend"] if p["month"] == latest_month)
        assert point["amount"] >= 5500
        assert dash["recent_transactions"][0]["client_name"] == "MRR B"

    def test_dashboard_counts_api_issues(self, client, db):
        from app.models.models import ClientAccessLog

        headers = admin_auth_headers(client, db)
        db.add_all(
            [
                ClientAccessLog(endpoint="/cyracode/x/address", method="GET", status_code=401),
                ClientAccessLog(endpoint="/cyracode/y/address", method="GET", status_code=500),
                ClientAccessLog(endpoint="/cyracode/z/address", method="GET", status_code=200),
            ]
        )
        db.commit()

        dash = client.get("/admin/dashboard", headers=headers).json()
        assert dash["api_issues_24h"] == 2
        assert dash["api_calls_24h"] == 3