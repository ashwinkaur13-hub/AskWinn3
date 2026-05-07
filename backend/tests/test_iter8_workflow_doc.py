"""Iter 8 — Vendor Workflow Doc changes.

Covers:
  GET    /api/network/stats                     (new — landing page Number Cards)
  PUT    /api/users/me/profile                  (now persists `phone`)
  PUT    /api/agents/me                         (now persists `turnkey_manufacturing`)
  GET    /api/agents/{id}                       (reads back turnkey field)
  POST   /api/agents/{agent_id}/reviews         (regression)
  GET    /api/rfqs/{rfq_id}                     (buyer-anonymisation:
                                                 - non-winning quotes => "Verified <City> Manufacturer",
                                                 - agent_user_id="hidden", contact_number="",
                                                 - winning quote reveals real identity,
                                                 - other agents still see "Anonymous bidder")
  POST   /api/rfqs/{rfq_id}/quotes contact_number="" accepted (no validation)
"""
import os
import time
import uuid
import requests
import pytest
from pymongo import MongoClient
from datetime import datetime, timezone, timedelta

BASE = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE}/api"
mongo = MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
db = mongo[os.environ.get("DB_NAME", "test_database")]

STAMP = int(time.time())


# ---------- helpers ----------
def _seed_user(role: str, suffix: str = ""):
    uid = f"test-iter8-{role}{suffix}-{STAMP}-{uuid.uuid4().hex[:6]}"
    tok = f"tok_{uuid.uuid4().hex}"
    db.users.insert_one({
        "user_id": uid,
        "email": f"TEST_iter8_{role}{suffix}_{uid}@example.com",
        "name": f"Test {role}{suffix}",
        "picture": None,
        "role": role,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    db.user_sessions.insert_one({
        "user_id": uid,
        "session_token": tok,
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return uid, tok


def _seed_agent_profile(user_id: str, city: str = "Mumbai", state: str = "Maharashtra",
                       categories=None, verified: bool = True):
    aid = f"agent_iter8_{uuid.uuid4().hex[:10]}"
    db.agent_profiles.insert_one({
        "agent_id": aid, "user_id": user_id,
        "company_name": f"TEST Iter8 Co {aid}", "tagline": "", "bio": "",
        "categories": categories or ["Hardware"], "regions": ["IN"],
        "services": [], "min_order_qty": 0, "certifications": [],
        "portfolio_images": [], "verified": verified, "rating": 0.0,
        "reviews_count": 0,
        "factory_city": city, "factory_state": state,
        "years_in_operation": 5,
        "turnkey_manufacturing": False,
        "badges": [], "vendor_score": 0.0,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return aid


# ---------- fixtures ----------
@pytest.fixture(scope="module")
def buyer():
    uid, tok = _seed_user("buyer")
    yield {"user_id": uid, "token": tok, "h": {"Authorization": f"Bearer {tok}"}}
    db.users.delete_one({"user_id": uid})
    db.user_sessions.delete_one({"session_token": tok})


@pytest.fixture(scope="module")
def agent_a():
    uid, tok = _seed_user("agent", "_A")
    aid = _seed_agent_profile(uid, city="Mumbai", state="Maharashtra")
    yield {"user_id": uid, "token": tok, "agent_id": aid,
           "h": {"Authorization": f"Bearer {tok}"}}
    db.agent_profiles.delete_one({"agent_id": aid})
    db.users.delete_one({"user_id": uid})
    db.user_sessions.delete_one({"session_token": tok})


@pytest.fixture(scope="module")
def agent_b():
    uid, tok = _seed_user("agent", "_B")
    aid = _seed_agent_profile(uid, city="", state="")  # no city => "Verified Manufacturer"
    yield {"user_id": uid, "token": tok, "agent_id": aid,
           "h": {"Authorization": f"Bearer {tok}"}}
    db.agent_profiles.delete_one({"agent_id": aid})
    db.users.delete_one({"user_id": uid})
    db.user_sessions.delete_one({"session_token": tok})


@pytest.fixture(scope="module")
def rfq_with_quotes(buyer, agent_a, agent_b):
    """Buyer creates one RFQ; both agents submit quotes; cleanup after."""
    payload = {
        "title": "TEST Iter8 RFQ",
        "description": "Test RFQ for anonymisation logic",
        "category": "Hardware",
        "target_region": "IN",
        "quantity": 100,
        "budget_usd": 5000,
        "timeline": "30 days",
        "requirements": {},
    }
    r = requests.post(f"{API}/rfqs", json=payload, headers=buyer["h"], timeout=10)
    assert r.status_code == 200, f"create rfq failed: {r.status_code} {r.text}"
    rfq_id = r.json()["rfq_id"]

    # agent A quote
    qa = requests.post(
        f"{API}/rfqs/{rfq_id}/quotes",
        json={"price_usd": 1000, "lead_time_days": 20, "message": "From A",
              "contact_number": "", "sample_available": False, "sample_cost_usd": 0.0},
        headers=agent_a["h"], timeout=10,
    )
    assert qa.status_code == 200, qa.text
    qa_id = qa.json()["quote_id"]

    # agent B quote
    qb = requests.post(
        f"{API}/rfqs/{rfq_id}/quotes",
        json={"price_usd": 1100, "lead_time_days": 25, "message": "From B",
              "contact_number": "", "sample_available": False, "sample_cost_usd": 0.0},
        headers=agent_b["h"], timeout=10,
    )
    assert qb.status_code == 200, qb.text
    qb_id = qb.json()["quote_id"]

    yield {"rfq_id": rfq_id, "qa_id": qa_id, "qb_id": qb_id}

    db.quotes.delete_many({"rfq_id": rfq_id})
    db.rfqs.delete_one({"rfq_id": rfq_id})


# ====================================================================
# 1. /api/network/stats
# ====================================================================
class TestNetworkStats:
    def test_network_stats_shape_and_sort(self):
        r = requests.get(f"{API}/network/stats", timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert "total" in data and isinstance(data["total"], int)
        assert "verified" in data and isinstance(data["verified"], int)
        assert "by_category" in data and isinstance(data["by_category"], list)
        assert data["verified"] <= data["total"]

        # Validate each category row shape
        for row in data["by_category"]:
            assert "category" in row
            assert "count" in row
            assert isinstance(row["count"], int)
            assert row["count"] >= 1

        # Validate sort: descending by count
        counts = [r["count"] for r in data["by_category"]]
        assert counts == sorted(counts, reverse=True), f"by_category not sorted desc: {counts}"

    def test_network_stats_no_auth_required(self):
        # Public endpoint — no Authorization header
        r = requests.get(f"{API}/network/stats", timeout=10)
        assert r.status_code == 200


# ====================================================================
# 2. PUT /api/users/me/profile — phone field persists
# ====================================================================
class TestBuyerProfilePhone:
    def test_phone_persists(self, buyer):
        payload = {"niche": "kitchen", "sub_category": "cookware",
                   "business_model": "d2c", "phone": "+919876543210",
                   "chat_answers": {"q1": "a1"}}
        r = requests.put(f"{API}/users/me/profile", json=payload,
                         headers=buyer["h"], timeout=10)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("phone") == "+919876543210"
        assert data.get("niche_preference") == "kitchen"

        # Verify via auth/me
        me = requests.get(f"{API}/auth/me", headers=buyer["h"], timeout=10).json()
        assert me.get("phone") == "+919876543210"

    def test_phone_can_be_updated(self, buyer):
        payload = {"niche": "kitchen", "sub_category": "cookware",
                   "business_model": "d2c", "phone": "+911111111111",
                   "chat_answers": {}}
        r = requests.put(f"{API}/users/me/profile", json=payload,
                         headers=buyer["h"], timeout=10)
        assert r.status_code == 200
        assert r.json().get("phone") == "+911111111111"

    def test_profile_requires_auth(self):
        r = requests.put(f"{API}/users/me/profile",
                         json={"niche": "x", "phone": "1"}, timeout=10)
        assert r.status_code == 401


# ====================================================================
# 3. PUT /api/agents/me — turnkey_manufacturing field persists
# ====================================================================
class TestAgentTurnkey:
    def test_turnkey_persists_true(self, agent_a):
        payload = {
            "company_name": "TEST Iter8 Co A Updated",
            "tagline": "tag", "bio": "bio",
            "categories": ["Hardware"], "regions": ["IN"], "services": [],
            "min_order_qty": 10, "certifications": [], "portfolio_images": [],
            "factory_city": "Mumbai", "factory_state": "Maharashtra",
            "years_in_operation": 5, "turnkey_manufacturing": True,
        }
        r = requests.put(f"{API}/agents/me", json=payload,
                         headers=agent_a["h"], timeout=10)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("turnkey_manufacturing") is True

        # Read back via public agent endpoint
        g = requests.get(f"{API}/agents/{agent_a['agent_id']}", timeout=10)
        assert g.status_code == 200
        assert g.json()["agent"].get("turnkey_manufacturing") is True

    def test_turnkey_can_be_set_false(self, agent_a):
        payload = {
            "company_name": "TEST Iter8 Co A",
            "categories": ["Hardware"], "regions": ["IN"],
            "factory_city": "Mumbai", "factory_state": "Maharashtra",
            "years_in_operation": 5, "turnkey_manufacturing": False,
        }
        r = requests.put(f"{API}/agents/me", json=payload,
                         headers=agent_a["h"], timeout=10)
        assert r.status_code == 200
        assert r.json().get("turnkey_manufacturing") is False


# ====================================================================
# 4. POST /api/agents/{id}/reviews — regression
# ====================================================================
class TestReviewsRegression:
    def test_buyer_can_post_review(self, buyer, agent_b):
        payload = {"rating": 5, "comment": "TEST_iter8 review",
                   "timeliness": 4, "quality": 5, "communication": 5, "value": 4}
        r = requests.post(f"{API}/agents/{agent_b['agent_id']}/reviews",
                          json=payload, headers=buyer["h"], timeout=10)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("rating") == 5
        assert data.get("comment") == "TEST_iter8 review"
        # cleanup
        db.reviews.delete_one({"review_id": data.get("review_id")})


# ====================================================================
# 5. GET /api/rfqs/{rfq_id} — buyer-anonymisation
# ====================================================================
class TestBuyerAnonymisation:
    def test_buyer_owner_sees_verified_city_manufacturer_for_pending_quotes(
            self, buyer, agent_a, agent_b, rfq_with_quotes):
        r = requests.get(f"{API}/rfqs/{rfq_with_quotes['rfq_id']}",
                         headers=buyer["h"], timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert "quotes" in data and len(data["quotes"]) == 2
        for q in data["quotes"]:
            assert q["status"] == "pending"
            assert q["agent_user_id"] == "hidden", \
                f"agent_user_id should be hidden: {q.get('agent_user_id')}"
            assert q["contact_number"] == "", \
                f"contact_number should be empty: {q.get('contact_number')}"
            assert q["agent"]["company_name"].startswith("Verified "), \
                f"expected 'Verified ...' got: {q['agent']['company_name']}"
            assert q["agent"]["company_name"].endswith("Manufacturer"), \
                f"expected '...Manufacturer' got: {q['agent']['company_name']}"

        # Specifically: agent_a has city=Mumbai => "Verified Mumbai Manufacturer"
        labels = {q["agent"]["company_name"] for q in data["quotes"]}
        assert "Verified Mumbai Manufacturer" in labels, f"got: {labels}"
        # agent_b has empty city => "Verified Manufacturer"
        assert "Verified Manufacturer" in labels, f"got: {labels}"

    def test_buyer_owner_sees_real_company_for_won_quote(
            self, buyer, agent_a, rfq_with_quotes):
        # Mark agent_a's quote as 'won' directly in DB
        qa_id = rfq_with_quotes["qa_id"]
        db.quotes.update_one({"quote_id": qa_id}, {"$set": {"status": "won"}})
        try:
            r = requests.get(f"{API}/rfqs/{rfq_with_quotes['rfq_id']}",
                             headers=buyer["h"], timeout=10)
            assert r.status_code == 200
            data = r.json()
            won_quote = next(q for q in data["quotes"] if q["quote_id"] == qa_id)
            # Real identity revealed
            assert won_quote["agent"]["company_name"].startswith("TEST Iter8 Co"), \
                f"expected real name, got: {won_quote['agent']['company_name']}"
            assert won_quote["agent_user_id"] == agent_a["user_id"], \
                f"expected real agent_user_id, got: {won_quote['agent_user_id']}"

            # The other (still pending) quote remains anonymised
            qb_id = rfq_with_quotes["qb_id"]
            other = next(q for q in data["quotes"] if q["quote_id"] == qb_id)
            assert other["agent_user_id"] == "hidden"
            assert other["agent"]["company_name"].startswith("Verified ")
        finally:
            db.quotes.update_one({"quote_id": qa_id}, {"$set": {"status": "pending"}})

    def test_other_agent_still_sees_anonymous_bidder(
            self, agent_b, agent_a, rfq_with_quotes):
        # agent_b views the RFQ; agent_a's quote should be "Anonymous bidder"
        r = requests.get(f"{API}/rfqs/{rfq_with_quotes['rfq_id']}",
                         headers=agent_b["h"], timeout=10)
        assert r.status_code == 200
        data = r.json()
        qa_id = rfq_with_quotes["qa_id"]
        qb_id = rfq_with_quotes["qb_id"]
        a_view = next(q for q in data["quotes"] if q["quote_id"] == qa_id)
        b_view = next(q for q in data["quotes"] if q["quote_id"] == qb_id)
        # agent_b sees agent_a anonymised
        assert a_view["agent"]["company_name"] == "Anonymous bidder", \
            f"got: {a_view['agent']['company_name']}"
        assert a_view["agent_user_id"] == "hidden"
        assert a_view["contact_number"] == ""
        assert a_view["message"] == ""  # pitch hidden from competitors
        # agent_b sees own quote with real details
        assert b_view["agent_user_id"] == agent_b["user_id"]


# ====================================================================
# 6. POST /api/rfqs/{rfq_id}/quotes — empty contact_number accepted
# ====================================================================
class TestQuoteContactNumberOptional:
    def test_empty_contact_number_accepted(self, buyer, agent_a):
        # Create a fresh RFQ
        r = requests.post(f"{API}/rfqs", headers=buyer["h"], timeout=10, json={
            "title": "TEST Iter8 contact_number RFQ",
            "description": "test", "category": "Hardware", "target_region": "IN",
            "quantity": 10, "budget_usd": 100, "timeline": "10 days",
            "requirements": {},
        })
        assert r.status_code == 200
        rid = r.json()["rfq_id"]
        try:
            q = requests.post(f"{API}/rfqs/{rid}/quotes", headers=agent_a["h"], timeout=10,
                              json={"price_usd": 50, "lead_time_days": 10,
                                    "message": "no phone", "contact_number": "",
                                    "sample_available": False, "sample_cost_usd": 0.0})
            assert q.status_code == 200, q.text
            assert q.json()["contact_number"] == ""
        finally:
            db.quotes.delete_many({"rfq_id": rid})
            db.rfqs.delete_one({"rfq_id": rid})


# ====================================================================
# 7. Regression — core endpoints still work
# ====================================================================
class TestRegression:
    def test_auth_me(self, buyer):
        r = requests.get(f"{API}/auth/me", headers=buyer["h"], timeout=10)
        assert r.status_code == 200
        assert r.json()["role"] == "buyer"

    def test_niches_list(self):
        r = requests.get(f"{API}/niches", timeout=10)
        assert r.status_code == 200
        assert isinstance(r.json(), list) and len(r.json()) > 0

    def test_agents_list(self):
        r = requests.get(f"{API}/agents", timeout=10)
        assert r.status_code == 200
        assert isinstance(r.json(), list)
