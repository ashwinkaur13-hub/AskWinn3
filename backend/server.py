"""SourceHQ — B2B sourcing marketplace backend."""
from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends, UploadFile, File, Header, Query
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import uuid
import secrets
import httpx
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Literal, Any
from datetime import datetime, timezone, timedelta

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

from bid_evaluator import evaluate_bids as evaluate_bids_llm  # noqa: E402
from rfq_schemas import schema_for, CATEGORY_SCHEMAS  # noqa: E402
from storage import init_storage, put_object, get_object, ALLOWED_EXTS, MAX_FILE_SIZE, MIME_TYPES, APP_NAME  # noqa: E402
from blueprints import NICHES, blueprint_for, niche_for  # noqa: E402

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY")
ADMIN_EMAIL = "admin@sourcehq.test"

app = FastAPI()
api = APIRouter(prefix="/api")

# ---------- Models ----------
Role = Literal["buyer", "agent", "admin", "unassigned"]


class User(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    role: Role = "unassigned"
    created_at: datetime


class RoleSelect(BaseModel):
    role: Literal["buyer", "agent"]


class AgentProfile(BaseModel):
    agent_id: str
    user_id: str
    company_name: str
    tagline: str = ""
    bio: str = ""
    categories: List[str] = []
    regions: List[str] = []
    services: List[str] = []
    min_order_qty: int = 0
    certifications: List[str] = []
    portfolio_images: List[str] = []
    verified: bool = False
    rating: float = 0.0
    reviews_count: int = 0
    # Phase 1 KYC
    pan_number: str = ""
    gst_number: str = ""
    business_address: str = ""
    factory_city: str = ""
    factory_state: str = ""
    years_in_operation: int = 0
    factory_video_url: str = ""
    catalogue_url: str = ""
    availability_status: Literal["active", "paused"] = "active"
    turnkey_manufacturing: bool = False
    # Phase 5 Score & Badges
    vendor_score: float = 0.0
    badges: List[str] = []
    earnings_inr: float = 0.0
    avg_response_time_hours: float = 0.0
    created_at: datetime


class AgentProfileInput(BaseModel):
    company_name: str
    tagline: str = ""
    bio: str = ""
    categories: List[str] = []
    regions: List[str] = []
    services: List[str] = []
    min_order_qty: int = 0
    certifications: List[str] = []
    portfolio_images: List[str] = []
    pan_number: str = ""
    gst_number: str = ""
    business_address: str = ""
    factory_city: str = ""
    factory_state: str = ""
    years_in_operation: int = 0
    factory_video_url: str = ""
    catalogue_url: str = ""
    availability_status: Literal["active", "paused"] = "active"
    turnkey_manufacturing: bool = False


class RFQ(BaseModel):
    rfq_id: str
    buyer_id: str
    title: str
    description: str
    category: str
    target_region: str = "Any"
    quantity: int
    budget_usd: float
    timeline: str
    status: Literal["open", "closed"] = "open"
    winner_quote_id: Optional[str] = None
    requirements: dict[str, Any] = {}
    attachments: List[dict] = []
    created_at: datetime


class RFQInput(BaseModel):
    title: str
    description: str
    category: str
    target_region: str = "Any"
    quantity: int
    budget_usd: float
    timeline: str
    requirements: dict[str, Any] = {}


class Quote(BaseModel):
    quote_id: str
    rfq_id: str
    agent_id: str
    agent_user_id: str
    price_usd: float
    lead_time_days: int
    message: str
    contact_number: str = ""
    status: Literal["pending", "won", "not_selected", "confirmed", "packed", "dispatched", "delivered"] = "pending"
    tracking_url: str = ""
    sample_available: bool = False
    sample_cost_usd: float = 0.0
    created_at: datetime


class QuoteInput(BaseModel):
    price_usd: float
    lead_time_days: int
    message: str
    contact_number: str = ""
    sample_available: bool = False
    sample_cost_usd: float = 0.0


class AcceptInput(BaseModel):
    quote_id: str


class StatusUpdateInput(BaseModel):
    status: Literal["confirmed", "packed", "dispatched", "delivered"]
    tracking_url: str = ""


class Message(BaseModel):
    message_id: str
    thread_id: str
    sender_id: str
    recipient_id: str
    body: str
    attachments: List[dict] = []
    created_at: datetime


class MessageInput(BaseModel):
    recipient_id: str
    body: str = ""
    attachments: List[dict] = []


class Review(BaseModel):
    review_id: str
    agent_id: str
    buyer_id: str
    buyer_name: str
    rating: int
    timeliness: int = 0
    quality: int = 0
    communication: int = 0
    value: int = 0
    comment: str
    created_at: datetime


class ReviewInput(BaseModel):
    rating: int
    comment: str
    timeliness: int = 0
    quality: int = 0
    communication: int = 0
    value: int = 0


class BuyerProfileInput(BaseModel):
    niche: str = ""
    sub_category: str = ""
    business_model: str = ""
    phone: str = ""
    chat_answers: dict[str, Any] = {}


# ---------- Auth helpers ----------
async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("session_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    expires_at = session["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired")
    user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


async def require_role(user: dict, *roles: str):
    if user["role"] not in roles:
        raise HTTPException(status_code=403, detail=f"Requires role: {roles}")


# ---------- Auth endpoints ----------
@api.post("/auth/session")
async def create_session(request: Request, response: Response):
    data = await request.json()
    session_id = data.get("session_id")
    desired_role = data.get("desired_role")  # "buyer" | "agent" | None — captured pre-OAuth
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id required")
    async with httpx.AsyncClient(timeout=15.0) as http:
        r = await http.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": session_id},
        )
    if r.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid session_id")
    payload = r.json()
    email = payload["email"]
    existing = await db.users.find_one({"email": email}, {"_id": 0})
    now = datetime.now(timezone.utc)
    if existing:
        user_id = existing["user_id"]
        role = existing["role"]
        if email == ADMIN_EMAIL and role != "admin":
            role = "admin"
            await db.users.update_one({"user_id": user_id}, {"$set": {"role": "admin"}})
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        if email == ADMIN_EMAIL:
            role = "admin"
        elif desired_role in ("buyer", "agent"):
            role = desired_role
        else:
            role = "unassigned"
        await db.users.insert_one({
            "user_id": user_id,
            "email": email,
            "name": payload["name"],
            "picture": payload.get("picture"),
            "role": role,
            "created_at": now.isoformat(),
        })
        # auto-create agent profile shell
        if role == "agent":
            await db.agent_profiles.insert_one({
                "agent_id": f"agent_{uuid.uuid4().hex[:12]}",
                "user_id": user_id,
                "company_name": payload["name"] + " Manufacturing",
                "tagline": "", "bio": "", "categories": [], "regions": [],
                "services": [], "min_order_qty": 0, "certifications": [],
                "portfolio_images": [], "verified": False, "rating": 0.0,
                "reviews_count": 0,
                "created_at": now.isoformat(),
            })
    token = payload["session_token"]
    expires_at = now + timedelta(days=7)
    await db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": token,
        "expires_at": expires_at.isoformat(),
        "created_at": now.isoformat(),
    })
    response.set_cookie(
        key="session_token", value=token, httponly=True, secure=True,
        samesite="none", path="/", max_age=7 * 24 * 60 * 60,
    )
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    return user


@api.get("/auth/me")
async def auth_me(user: dict = Depends(get_current_user)):
    return user


@api.post("/auth/logout")
async def logout(request: Request, response: Response):
    token = request.cookies.get("session_token")
    if token:
        await db.user_sessions.delete_one({"session_token": token})
    response.delete_cookie("session_token", path="/")
    return {"ok": True}


@api.post("/auth/role")
async def set_role(inp: RoleSelect, user: dict = Depends(get_current_user)):
    if user["role"] not in ("unassigned", inp.role):
        raise HTTPException(status_code=400, detail="Role already set")
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"role": inp.role}})
    if inp.role == "agent":
        existing = await db.agent_profiles.find_one({"user_id": user["user_id"]}, {"_id": 0})
        if not existing:
            await db.agent_profiles.insert_one({
                "agent_id": f"agent_{uuid.uuid4().hex[:12]}",
                "user_id": user["user_id"],
                "company_name": user["name"] + " Manufacturing",
                "tagline": "", "bio": "", "categories": [], "regions": [],
                "services": [], "min_order_qty": 0, "certifications": [],
                "portfolio_images": [], "verified": False, "rating": 0.0,
                "reviews_count": 0,
                "pan_number": "", "gst_number": "", "business_address": "",
                "factory_city": "", "factory_state": "", "years_in_operation": 0,
                "factory_video_url": "", "catalogue_url": "",
                "availability_status": "active",
                "vendor_score": 0.0, "badges": [],
                "earnings_inr": 0.0, "avg_response_time_hours": 0.0,
                "created_at": datetime.now(timezone.utc).isoformat(),
            })
    updated = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0})
    return updated


# ---------- Agents ----------
@api.get("/agents")
async def list_agents(category: Optional[str] = None, region: Optional[str] = None,
                     verified: Optional[bool] = None, search: Optional[str] = None):
    q: dict = {}
    if category:
        q["categories"] = category
    if region:
        q["regions"] = region
    if verified is not None:
        q["verified"] = verified
    if search:
        q["$or"] = [
            {"company_name": {"$regex": search, "$options": "i"}},
            {"tagline": {"$regex": search, "$options": "i"}},
            {"bio": {"$regex": search, "$options": "i"}},
        ]
    agents = await db.agent_profiles.find(q, {"_id": 0}).to_list(200)
    return agents


@api.get("/agents/{agent_id}")
async def get_agent(agent_id: str):
    agent = await db.agent_profiles.find_one({"agent_id": agent_id}, {"_id": 0})
    if not agent:
        raise HTTPException(404, "Agent not found")
    reviews = await db.reviews.find({"agent_id": agent_id}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return {"agent": agent, "reviews": reviews}


@api.get("/agents/by-user/me")
async def my_agent_profile(user: dict = Depends(get_current_user)):
    await require_role(user, "agent")
    agent = await db.agent_profiles.find_one({"user_id": user["user_id"]}, {"_id": 0})
    if not agent:
        raise HTTPException(404, "No profile")
    return agent


@api.put("/agents/me")
async def update_my_agent(inp: AgentProfileInput, user: dict = Depends(get_current_user)):
    await require_role(user, "agent")
    await db.agent_profiles.update_one(
        {"user_id": user["user_id"]},
        {"$set": inp.model_dump()},
    )
    agent = await db.agent_profiles.find_one({"user_id": user["user_id"]}, {"_id": 0})
    return agent


# ---------- RFQs ----------
@api.post("/rfqs")
async def create_rfq(inp: RFQInput, user: dict = Depends(get_current_user)):
    await require_role(user, "buyer")
    rfq_id = f"rfq_{uuid.uuid4().hex[:12]}"
    doc = {
        "rfq_id": rfq_id, "buyer_id": user["user_id"],
        "status": "open",
        "winner_quote_id": None,
        "attachments": [],
        "created_at": datetime.now(timezone.utc).isoformat(),
        **inp.model_dump(),
    }
    await db.rfqs.insert_one(doc)
    return await db.rfqs.find_one({"rfq_id": rfq_id}, {"_id": 0})


@api.get("/rfqs")
async def list_rfqs(user: dict = Depends(get_current_user)):
    if user["role"] == "buyer":
        rfqs = await db.rfqs.find({"buyer_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)
    elif user["role"] == "agent":
        # Hide RFQs the agent has passed on
        passed = await db.rfq_passes.find({"user_id": user["user_id"]}, {"_id": 0}).to_list(1000)
        passed_ids = {p["rfq_id"] for p in passed}
        rfqs = await db.rfqs.find({"status": "open"}, {"_id": 0}).sort("created_at", -1).to_list(500)
        rfqs = [r for r in rfqs if r["rfq_id"] not in passed_ids]
    else:
        rfqs = await db.rfqs.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return rfqs


@api.get("/rfqs/{rfq_id}")
async def get_rfq(rfq_id: str, user: dict = Depends(get_current_user)):
    rfq = await db.rfqs.find_one({"rfq_id": rfq_id}, {"_id": 0})
    if not rfq:
        raise HTTPException(404, "Not found")
    quotes = await db.quotes.find({"rfq_id": rfq_id}, {"_id": 0}).to_list(200)
    buyer = await db.users.find_one({"user_id": rfq["buyer_id"]}, {"_id": 0})
    is_buyer_owner = user["role"] == "buyer" and rfq["buyer_id"] == user["user_id"]
    is_admin = user["role"] == "admin"
    is_winner = False
    # Phase 3 / spec sheet: Anonymise vendor identity for buyers until they accept a winner.
    # Only the winning quote (post-accept) reveals identity.
    for q in quotes:
        ag = await db.agent_profiles.find_one({"agent_id": q["agent_id"]}, {"_id": 0})
        if user["role"] == "agent" and q["agent_user_id"] == user["user_id"] and q.get("status") == "won":
            is_winner = True
        if user["role"] == "agent" and q["agent_user_id"] != user["user_id"]:
            # Other agents' quotes — show price + lead time only, hide identity
            q["agent"] = {"company_name": "Anonymous bidder", "verified": ag.get("verified", False) if ag else False, "badges": ag.get("badges", []) if ag else []}
            q["agent_user_id"] = "hidden"
            q["contact_number"] = ""
            q["message"] = ""  # hide pitch from competitors
        elif is_buyer_owner and q.get("status") not in ("won", "confirmed", "packed", "dispatched", "delivered"):
            # Buyer sees only "Verified <City> Manufacturer" until they accept the winning bid
            city = (ag.get("factory_city") or ag.get("factory_state") or "").strip() if ag else ""
            verified_label = "Verified " + (city + " " if city else "") + "Manufacturer"
            q["agent"] = {
                "company_name": verified_label,
                "verified": ag.get("verified", False) if ag else False,
                "badges": ag.get("badges", []) if ag else [],
                "factory_city": city,
            }
            q["agent_user_id"] = "hidden"
            q["contact_number"] = ""
        else:
            q["agent"] = ag
            # Strip contact_number system-wide (per spec sheet: no phone visible to buyer ever pre-accept)
            if user["role"] != "admin" and q.get("status") not in ("won", "confirmed", "packed", "dispatched", "delivered"):
                q["contact_number"] = ""
    # Buyer name: visible to buyer-owner and admin always; visible to winning agent post-accept; otherwise anonymised
    show_buyer_name = is_buyer_owner or is_admin or is_winner
    if buyer and show_buyer_name:
        buyer_display = buyer["name"]
    else:
        # Use city if known on buyer profile (none today) — fallback to "Verified Buyer"
        buyer_display = "Verified Buyer"
    return {"rfq": rfq, "quotes": quotes, "buyer_name": buyer_display, "buyer_anonymised": not show_buyer_name}


@api.post("/rfqs/{rfq_id}/pass")
async def pass_rfq(rfq_id: str, user: dict = Depends(get_current_user)):
    await require_role(user, "agent")
    rfq = await db.rfqs.find_one({"rfq_id": rfq_id}, {"_id": 0})
    if not rfq:
        raise HTTPException(404, "RFQ not found")
    await db.rfq_passes.update_one(
        {"user_id": user["user_id"], "rfq_id": rfq_id},
        {"$set": {"user_id": user["user_id"], "rfq_id": rfq_id,
                   "created_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )
    return {"ok": True}


@api.post("/quotes/{quote_id}/status")
async def update_quote_status(quote_id: str, inp: StatusUpdateInput, user: dict = Depends(get_current_user)):
    quote = await db.quotes.find_one({"quote_id": quote_id}, {"_id": 0})
    if not quote:
        raise HTTPException(404, "Quote not found")
    # only winning agent can update; only allowed forward transitions
    if user["role"] == "agent":
        if quote["agent_user_id"] != user["user_id"]:
            raise HTTPException(403, "Not your quote")
        if quote.get("status") not in ("won", "confirmed", "packed", "dispatched"):
            raise HTTPException(400, "Quote is not in a fulfilment state")
        order = ["won", "confirmed", "packed", "dispatched", "delivered"]
        if order.index(inp.status) <= order.index(quote.get("status", "won")):
            raise HTTPException(400, "Status can only move forward")
    elif user["role"] == "buyer":
        # Buyer can mark "delivered" once dispatched
        rfq = await db.rfqs.find_one({"rfq_id": quote["rfq_id"]}, {"_id": 0})
        if not rfq or rfq["buyer_id"] != user["user_id"]:
            raise HTTPException(403, "Not your quote")
        if inp.status != "delivered":
            raise HTTPException(400, "Buyer can only mark delivered")
        if quote.get("status") != "dispatched":
            raise HTTPException(400, "Quote must be dispatched before marking delivered")
    else:
        raise HTTPException(403, "Not allowed")
    update = {"status": inp.status}
    if inp.tracking_url:
        update["tracking_url"] = inp.tracking_url
    await db.quotes.update_one({"quote_id": quote_id}, {"$set": update})
    if inp.status == "delivered":
        # Phase 5: bump earnings on agent profile + recalc score
        await _recalc_vendor_score(quote["agent_id"])
    return await db.quotes.find_one({"quote_id": quote_id}, {"_id": 0})


async def _recalc_vendor_score(agent_id: str):
    agent = await db.agent_profiles.find_one({"agent_id": agent_id}, {"_id": 0})
    if not agent:
        return
    # Aggregate quote stats
    submitted = await db.quotes.count_documents({"agent_id": agent_id})
    won = await db.quotes.count_documents({"agent_id": agent_id, "status": {"$in": ["won", "confirmed", "packed", "dispatched", "delivered"]}})
    delivered_quotes = await db.quotes.find({"agent_id": agent_id, "status": "delivered"}, {"_id": 0}).to_list(1000)
    earnings = sum(q.get("price_usd", 0) for q in delivered_quotes)
    # Vendor score = rating(0-5)*0.5*20 + win_rate*30 + verified bonus
    rating = agent.get("rating", 0) or 0
    win_rate = (won / submitted) if submitted else 0
    score = round(rating * 10 + win_rate * 30 + (10 if agent.get("verified") else 0), 1)
    score = min(100, score)
    badges = []
    if rating >= 4.5 and agent.get("reviews_count", 0) >= 3:
        badges.append("high_quality")
    if win_rate >= 0.4 and submitted >= 3:
        badges.append("top_vendor")
    avg_resp = agent.get("avg_response_time_hours", 0) or 0
    if avg_resp and avg_resp < 4:
        badges.append("fast_responder")
    await db.agent_profiles.update_one(
        {"agent_id": agent_id},
        {"$set": {"vendor_score": score, "badges": badges, "earnings_inr": earnings * 83}},  # simple INR conversion
    )


@api.post("/agents/me/recalc")
async def recalc_my_score(user: dict = Depends(get_current_user)):
    await require_role(user, "agent")
    agent = await db.agent_profiles.find_one({"user_id": user["user_id"]}, {"_id": 0})
    if not agent:
        raise HTTPException(404, "No profile")
    await _recalc_vendor_score(agent["agent_id"])
    return await db.agent_profiles.find_one({"agent_id": agent["agent_id"]}, {"_id": 0})


@api.get("/agents/me/metrics")
async def my_vendor_metrics(user: dict = Depends(get_current_user)):
    await require_role(user, "agent")
    agent = await db.agent_profiles.find_one({"user_id": user["user_id"]}, {"_id": 0})
    if not agent:
        raise HTTPException(404, "No profile")
    quotes = await db.quotes.find({"agent_id": agent["agent_id"]}, {"_id": 0}).to_list(1000)
    rfq_received = len({q["rfq_id"] for q in quotes})
    active_bids = sum(1 for q in quotes if q.get("status") == "pending")
    won = sum(1 for q in quotes if q.get("status") in ("won", "confirmed", "packed", "dispatched", "delivered"))
    delivered = [q for q in quotes if q.get("status") == "delivered"]
    earnings_usd = sum(q.get("price_usd", 0) for q in delivered)
    return {
        "rfqs_received": rfq_received,
        "active_bids": active_bids,
        "orders_won": won,
        "orders_delivered": len(delivered),
        "earnings_usd": earnings_usd,
        "vendor_score": agent.get("vendor_score", 0),
        "badges": agent.get("badges", []),
        "verified": agent.get("verified", False),
        "rating": agent.get("rating", 0),
        "reviews_count": agent.get("reviews_count", 0),
    }


@api.post("/rfqs/{rfq_id}/quotes")
async def submit_quote(rfq_id: str, inp: QuoteInput, user: dict = Depends(get_current_user)):
    await require_role(user, "agent")
    agent = await db.agent_profiles.find_one({"user_id": user["user_id"]}, {"_id": 0})
    if not agent:
        raise HTTPException(400, "Agent profile missing")
    rfq = await db.rfqs.find_one({"rfq_id": rfq_id}, {"_id": 0})
    if not rfq:
        raise HTTPException(404, "RFQ not found")
    if rfq.get("status") == "closed":
        raise HTTPException(400, "RFQ already closed")
    quote_id = f"q_{uuid.uuid4().hex[:12]}"
    doc = {
        "quote_id": quote_id,
        "rfq_id": rfq_id,
        "agent_id": agent["agent_id"],
        "agent_user_id": user["user_id"],
        "status": "pending",
        "tracking_url": "",
        "created_at": datetime.now(timezone.utc).isoformat(),
        **inp.model_dump(),
    }
    await db.quotes.insert_one(doc)
    # Track response time for badge calc
    rfq_created = rfq.get("created_at")
    if isinstance(rfq_created, str):
        try:
            rfq_dt = datetime.fromisoformat(rfq_created)
            if rfq_dt.tzinfo is None:
                rfq_dt = rfq_dt.replace(tzinfo=timezone.utc)
            hours = (datetime.now(timezone.utc) - rfq_dt).total_seconds() / 3600
            existing = agent.get("avg_response_time_hours", 0) or 0
            sample_n = await db.quotes.count_documents({"agent_id": agent["agent_id"]})
            new_avg = ((existing * (sample_n - 1)) + hours) / sample_n if sample_n else hours
            await db.agent_profiles.update_one({"agent_id": agent["agent_id"]}, {"$set": {"avg_response_time_hours": round(new_avg, 2)}})
        except Exception:
            pass
    await _recalc_vendor_score(agent["agent_id"])
    return await db.quotes.find_one({"quote_id": quote_id}, {"_id": 0})


@api.get("/rfqs/categories/schema")
async def list_schemas():
    return {"categories": list(CATEGORY_SCHEMAS.keys()), "schemas": CATEGORY_SCHEMAS}


@api.get("/rfqs/categories/{category}/schema")
async def get_category_schema(category: str):
    s = schema_for(category)
    if not s:
        return {"label": "", "fields": []}
    return s


@api.post("/rfqs/{rfq_id}/attachments")
async def upload_attachment(rfq_id: str, file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    rfq = await db.rfqs.find_one({"rfq_id": rfq_id}, {"_id": 0})
    if not rfq:
        raise HTTPException(404, "RFQ not found")
    if rfq["buyer_id"] != user["user_id"]:
        raise HTTPException(403, "Not your RFQ")
    existing = rfq.get("attachments") or []
    if len(existing) >= 10:
        raise HTTPException(400, "Max 10 files per RFQ")
    ext = (file.filename or "").rsplit(".", 1)[-1].lower()
    if ext not in ALLOWED_EXTS:
        raise HTTPException(400, f"Unsupported file type .{ext}")
    data = await file.read()
    if len(data) > MAX_FILE_SIZE:
        raise HTTPException(400, "File too large (>20MB)")
    file_id = uuid.uuid4().hex
    storage_path = f"{APP_NAME}/rfqs/{rfq_id}/{file_id}.{ext}"
    content_type = MIME_TYPES.get(ext, file.content_type or "application/octet-stream")
    try:
        result = put_object(storage_path, data, content_type)
    except Exception as e:
        logging.exception("Upload failed")
        raise HTTPException(500, f"Upload failed: {e}")
    attachment = {
        "file_id": file_id,
        "storage_path": result["path"],
        "filename": file.filename,
        "content_type": content_type,
        "size": result.get("size", len(data)),
        "uploaded_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.rfqs.update_one({"rfq_id": rfq_id}, {"$push": {"attachments": attachment}})
    return attachment


@api.delete("/rfqs/{rfq_id}/attachments/{file_id}")
async def delete_attachment(rfq_id: str, file_id: str, user: dict = Depends(get_current_user)):
    rfq = await db.rfqs.find_one({"rfq_id": rfq_id}, {"_id": 0})
    if not rfq:
        raise HTTPException(404, "RFQ not found")
    if rfq["buyer_id"] != user["user_id"]:
        raise HTTPException(403, "Not your RFQ")
    await db.rfqs.update_one({"rfq_id": rfq_id}, {"$pull": {"attachments": {"file_id": file_id}}})
    return {"ok": True}


@api.get("/rfqs/{rfq_id}/attachments/{file_id}")
async def download_attachment(
    rfq_id: str, file_id: str,
    request: Request,
    auth: Optional[str] = Query(None),
):
    token = request.cookies.get("session_token") or auth
    if not token:
        h = request.headers.get("Authorization", "")
        if h.startswith("Bearer "):
            token = h[7:]
    if not token:
        raise HTTPException(401, "Not authenticated")
    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        raise HTTPException(401, "Invalid session")
    rfq = await db.rfqs.find_one({"rfq_id": rfq_id}, {"_id": 0})
    if not rfq:
        raise HTTPException(404, "RFQ not found")
    att = next((a for a in (rfq.get("attachments") or []) if a["file_id"] == file_id), None)
    if not att:
        raise HTTPException(404, "Attachment not found")
    try:
        data, ct = get_object(att["storage_path"])
    except Exception as e:
        raise HTTPException(500, f"Download failed: {e}")
    return Response(content=data, media_type=att.get("content_type", ct),
                    headers={"Content-Disposition": f'inline; filename="{att.get("filename","file")}"'})


@api.post("/rfqs/{rfq_id}/match")
async def ai_match(rfq_id: str, user: dict = Depends(get_current_user)):
    rfq = await db.rfqs.find_one({"rfq_id": rfq_id}, {"_id": 0})
    if not rfq:
        raise HTTPException(404, "Not found")
    agents = await db.agent_profiles.find({}, {"_id": 0}).to_list(100)
    if not agents:
        return {"matches": [], "summary": "No agents available yet."}
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"match_{rfq_id}",
            system_message="You are an expert B2B manufacturing matchmaker. Given an RFQ and a list of agents, pick the top 3 best fits and explain why in 1 short sentence each. Return JSON only.",
        ).with_model("anthropic", "claude-sonnet-4-5-20250929")
        agent_brief = [
            {"agent_id": a["agent_id"], "company": a["company_name"],
             "tagline": a.get("tagline", ""), "categories": a.get("categories", []),
             "regions": a.get("regions", []), "services": a.get("services", []),
             "moq": a.get("min_order_qty", 0), "verified": a.get("verified", False),
             "rating": a.get("rating", 0)}
            for a in agents
        ]
        prompt = f"""RFQ:
title: {rfq['title']}
description: {rfq['description']}
category: {rfq['category']}
region: {rfq['target_region']}
quantity: {rfq['quantity']}
budget_usd: {rfq['budget_usd']}
timeline: {rfq['timeline']}

Agents:
{agent_brief}

Return JSON: {{"matches":[{{"agent_id":"...","reason":"..."}}]}} with up to 3 matches."""
        resp = await chat.send_message(UserMessage(text=prompt))
        import json
        import re
        m = re.search(r"\{[\s\S]*\}", resp)
        parsed = json.loads(m.group(0)) if m else {"matches": []}
        # attach agent details
        for item in parsed.get("matches", []):
            ag = next((a for a in agents if a["agent_id"] == item["agent_id"]), None)
            item["agent"] = ag
        return {"matches": parsed.get("matches", []), "raw": resp}
    except Exception as e:
        logging.exception("AI match error")
        # Fallback: simple category match
        fallback = [a for a in agents if rfq["category"] in a.get("categories", [])][:3]
        return {
            "matches": [{"agent_id": a["agent_id"], "reason": f"Matches category '{rfq['category']}'", "agent": a} for a in fallback],
            "error": str(e),
        }


@api.post("/rfqs/{rfq_id}/evaluate-bids")
async def evaluate_bids_endpoint(rfq_id: str, user: dict = Depends(get_current_user)):
    rfq = await db.rfqs.find_one({"rfq_id": rfq_id}, {"_id": 0})
    if not rfq:
        raise HTTPException(404, "Not found")
    if user["role"] == "buyer" and rfq["buyer_id"] != user["user_id"]:
        raise HTTPException(403, "Not your RFQ")
    if user["role"] not in ("buyer", "admin"):
        raise HTTPException(403, "Buyers only")
    quotes = await db.quotes.find({"rfq_id": rfq_id}, {"_id": 0}).to_list(200)
    for q in quotes:
        ag = await db.agent_profiles.find_one({"agent_id": q["agent_id"]}, {"_id": 0})
        q["agent"] = ag
    result = await evaluate_bids_llm(rfq, quotes)
    return result


@api.post("/rfqs/{rfq_id}/accept")
async def accept_quote(rfq_id: str, inp: AcceptInput, user: dict = Depends(get_current_user)):
    await require_role(user, "buyer")
    rfq = await db.rfqs.find_one({"rfq_id": rfq_id}, {"_id": 0})
    if not rfq:
        raise HTTPException(404, "RFQ not found")
    if rfq["buyer_id"] != user["user_id"]:
        raise HTTPException(403, "Not your RFQ")
    if rfq["status"] == "closed":
        raise HTTPException(400, "RFQ already closed")
    quote = await db.quotes.find_one({"quote_id": inp.quote_id, "rfq_id": rfq_id}, {"_id": 0})
    if not quote:
        raise HTTPException(404, "Quote not found")
    now = datetime.now(timezone.utc).isoformat()
    await db.rfqs.update_one(
        {"rfq_id": rfq_id},
        {"$set": {"status": "closed", "winner_quote_id": inp.quote_id}},
    )
    await db.quotes.update_one({"quote_id": inp.quote_id}, {"$set": {"status": "won"}})
    await db.quotes.update_many(
        {"rfq_id": rfq_id, "quote_id": {"$ne": inp.quote_id}},
        {"$set": {"status": "not_selected"}},
    )
    # Auto-message the winning agent
    tid = thread_key(user["user_id"], quote["agent_user_id"])
    await db.messages.insert_one({
        "message_id": f"m_{uuid.uuid4().hex[:12]}",
        "thread_id": tid,
        "sender_id": user["user_id"],
        "recipient_id": quote["agent_user_id"],
        "body": f"Congratulations — you won the RFQ '{rfq['title']}'. Let's kick off production. I'll reach out with next steps.",
        "created_at": now,
    })
    # Recalc winning vendor's score
    try:
        await _recalc_vendor_score(quote["agent_id"])
    except Exception:
        pass
    return {"ok": True, "rfq_id": rfq_id, "winner_quote_id": inp.quote_id}


# ---------- Messaging ----------
def thread_key(a: str, b: str) -> str:
    return "::".join(sorted([a, b]))


@api.post("/messages")
async def send_message(inp: MessageInput, user: dict = Depends(get_current_user)):
    if not inp.body.strip() and not inp.attachments:
        raise HTTPException(400, "Message body or attachment required")
    tid = thread_key(user["user_id"], inp.recipient_id)
    doc = {
        "message_id": f"m_{uuid.uuid4().hex[:12]}",
        "thread_id": tid,
        "sender_id": user["user_id"],
        "recipient_id": inp.recipient_id,
        "body": inp.body,
        "attachments": inp.attachments or [],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.messages.insert_one(doc)
    return await db.messages.find_one({"message_id": doc["message_id"]}, {"_id": 0})


@api.get("/messages/thread/{other_user_id}")
async def get_thread(other_user_id: str, user: dict = Depends(get_current_user)):
    tid = thread_key(user["user_id"], other_user_id)
    msgs = await db.messages.find({"thread_id": tid}, {"_id": 0}).sort("created_at", 1).to_list(500)
    other = await db.users.find_one({"user_id": other_user_id}, {"_id": 0})
    return {"messages": msgs, "other": other}


@api.get("/threads")
async def list_threads(user: dict = Depends(get_current_user)):
    msgs = await db.messages.find(
        {"$or": [{"sender_id": user["user_id"]}, {"recipient_id": user["user_id"]}]},
        {"_id": 0},
    ).sort("created_at", -1).to_list(1000)
    seen = {}
    for m in msgs:
        other_id = m["recipient_id"] if m["sender_id"] == user["user_id"] else m["sender_id"]
        if other_id not in seen:
            other = await db.users.find_one({"user_id": other_id}, {"_id": 0})
            seen[other_id] = {"other": other, "last": m}
    return list(seen.values())


# ---------- Favourites ----------
@api.post("/favourites/{agent_id}")
async def add_favourite(agent_id: str, user: dict = Depends(get_current_user)):
    await require_role(user, "buyer")
    agent = await db.agent_profiles.find_one({"agent_id": agent_id}, {"_id": 0})
    if not agent:
        raise HTTPException(404, "Agent not found")
    await db.favourites.update_one(
        {"user_id": user["user_id"], "agent_id": agent_id},
        {"$setOnInsert": {
            "user_id": user["user_id"],
            "agent_id": agent_id,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }},
        upsert=True,
    )
    return {"ok": True, "favourited": True}


@api.delete("/favourites/{agent_id}")
async def remove_favourite(agent_id: str, user: dict = Depends(get_current_user)):
    await require_role(user, "buyer")
    await db.favourites.delete_one({"user_id": user["user_id"], "agent_id": agent_id})
    return {"ok": True, "favourited": False}


@api.get("/favourites")
async def list_favourites(user: dict = Depends(get_current_user)):
    await require_role(user, "buyer")
    favs = await db.favourites.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(500)
    agent_ids = [f["agent_id"] for f in favs]
    agents = await db.agent_profiles.find({"agent_id": {"$in": agent_ids}}, {"_id": 0}).to_list(500)
    by_id = {a["agent_id"]: a for a in agents}
    return [
        {"favourited_at": f["created_at"], "agent": by_id[f["agent_id"]]}
        for f in favs if f["agent_id"] in by_id
    ]


@api.get("/favourites/ids")
async def favourite_ids(user: dict = Depends(get_current_user)):
    await require_role(user, "buyer")
    favs = await db.favourites.find({"user_id": user["user_id"]}, {"_id": 0}).to_list(2000)
    return {"agent_ids": [f["agent_id"] for f in favs]}


# ---------- Public RFQ share ----------
@api.post("/rfqs/{rfq_id}/share")
async def create_share_link(rfq_id: str, user: dict = Depends(get_current_user)):
    if user["role"] not in ("buyer", "admin"):
        raise HTTPException(403, "Buyers only")
    rfq = await db.rfqs.find_one({"rfq_id": rfq_id}, {"_id": 0})
    if not rfq:
        raise HTTPException(404, "RFQ not found")
    if user["role"] == "buyer" and rfq["buyer_id"] != user["user_id"]:
        raise HTTPException(403, "Not your RFQ")
    token = rfq.get("share_token") or secrets.token_urlsafe(16)
    if not rfq.get("share_token"):
        await db.rfqs.update_one({"rfq_id": rfq_id}, {"$set": {"share_token": token}})
    return {"share_token": token, "share_path": f"/p/rfq/{token}"}


@api.delete("/rfqs/{rfq_id}/share")
async def revoke_share_link(rfq_id: str, user: dict = Depends(get_current_user)):
    if user["role"] not in ("buyer", "admin"):
        raise HTTPException(403, "Buyers only")
    rfq = await db.rfqs.find_one({"rfq_id": rfq_id}, {"_id": 0})
    if not rfq:
        raise HTTPException(404, "RFQ not found")
    if user["role"] == "buyer" and rfq["buyer_id"] != user["user_id"]:
        raise HTTPException(403, "Not your RFQ")
    await db.rfqs.update_one({"rfq_id": rfq_id}, {"$unset": {"share_token": ""}})
    return {"ok": True}


@api.get("/public/rfqs/{share_token}")
async def public_rfq(share_token: str):
    rfq = await db.rfqs.find_one({"share_token": share_token}, {"_id": 0})
    if not rfq:
        raise HTTPException(404, "Link is invalid or has been revoked")
    quote_count = await db.quotes.count_documents({"rfq_id": rfq["rfq_id"]})
    return {
        "rfq_id": rfq["rfq_id"],
        "title": rfq["title"],
        "description": rfq["description"],
        "category": rfq["category"],
        "target_region": rfq.get("target_region", "Any"),
        "quantity": rfq["quantity"],
        "budget_usd": rfq["budget_usd"],
        "timeline": rfq["timeline"],
        "status": rfq["status"],
        "requirements": rfq.get("requirements", {}),
        "attachment_count": len(rfq.get("attachments") or []),
        "quote_count": quote_count,
        "created_at": rfq.get("created_at"),
    }


# ---------- Message attachments ----------
@api.post("/messages/attachment")
async def upload_message_attachment(
    recipient_id: str = Query(...),
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user),
):
    other = await db.users.find_one({"user_id": recipient_id}, {"_id": 0})
    if not other:
        raise HTTPException(404, "Recipient not found")
    ext = (file.filename or "").rsplit(".", 1)[-1].lower()
    if ext not in ALLOWED_EXTS:
        raise HTTPException(400, f"Unsupported file type .{ext}")
    data = await file.read()
    if len(data) > MAX_FILE_SIZE:
        raise HTTPException(400, "File too large (>20MB)")
    file_id = uuid.uuid4().hex
    tid = thread_key(user["user_id"], recipient_id)
    storage_path = f"{APP_NAME}/messages/{tid}/{file_id}.{ext}"
    content_type = MIME_TYPES.get(ext, file.content_type or "application/octet-stream")
    try:
        result = put_object(storage_path, data, content_type)
    except Exception as e:
        logging.exception("Message attachment upload failed")
        raise HTTPException(500, f"Upload failed: {e}")
    return {
        "file_id": file_id,
        "storage_path": result["path"],
        "filename": file.filename,
        "content_type": content_type,
        "size": result.get("size", len(data)),
    }


@api.get("/messages/{message_id}/attachment/{file_id}")
async def download_message_attachment(
    message_id: str, file_id: str,
    request: Request,
    auth: Optional[str] = Query(None),
):
    token = request.cookies.get("session_token") or auth
    if not token:
        h = request.headers.get("Authorization", "")
        if h.startswith("Bearer "):
            token = h[7:]
    if not token:
        raise HTTPException(401, "Not authenticated")
    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        raise HTTPException(401, "Invalid session")
    user_id = session["user_id"]
    msg = await db.messages.find_one({"message_id": message_id}, {"_id": 0})
    if not msg:
        raise HTTPException(404, "Message not found")
    if user_id not in (msg["sender_id"], msg["recipient_id"]):
        u = await db.users.find_one({"user_id": user_id}, {"_id": 0})
        if not u or u.get("role") != "admin":
            raise HTTPException(403, "Not allowed")
    att = next((a for a in (msg.get("attachments") or []) if a["file_id"] == file_id), None)
    if not att:
        raise HTTPException(404, "Attachment not found")
    try:
        data, ct = get_object(att["storage_path"])
    except Exception as e:
        raise HTTPException(500, f"Download failed: {e}")
    return Response(
        content=data,
        media_type=att.get("content_type", ct),
        headers={"Content-Disposition": f'inline; filename="{att.get("filename","file")}"'},
    )


# ---------- Reviews ----------
@api.post("/agents/{agent_id}/reviews")
async def create_review(agent_id: str, inp: ReviewInput, user: dict = Depends(get_current_user)):
    await require_role(user, "buyer")
    agent = await db.agent_profiles.find_one({"agent_id": agent_id}, {"_id": 0})
    if not agent:
        raise HTTPException(404, "Agent not found")
    review_id = f"r_{uuid.uuid4().hex[:12]}"
    await db.reviews.insert_one({
        "review_id": review_id,
        "agent_id": agent_id,
        "buyer_id": user["user_id"],
        "buyer_name": user["name"],
        "rating": inp.rating,
        "timeliness": inp.timeliness,
        "quality": inp.quality,
        "communication": inp.communication,
        "value": inp.value,
        "comment": inp.comment,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    # recompute rating
    reviews = await db.reviews.find({"agent_id": agent_id}, {"_id": 0}).to_list(1000)
    avg = sum(r["rating"] for r in reviews) / len(reviews)
    await db.agent_profiles.update_one(
        {"agent_id": agent_id},
        {"$set": {"rating": round(avg, 2), "reviews_count": len(reviews)}},
    )
    return await db.reviews.find_one({"review_id": review_id}, {"_id": 0})


# ---------- Admin ----------
@api.get("/admin/agents")
async def admin_list_agents(user: dict = Depends(get_current_user)):
    await require_role(user, "admin")
    agents = await db.agent_profiles.find({}, {"_id": 0}).to_list(500)
    return agents


@api.post("/admin/agents/{agent_id}/verify")
async def admin_verify(agent_id: str, user: dict = Depends(get_current_user)):
    await require_role(user, "admin")
    await db.agent_profiles.update_one({"agent_id": agent_id}, {"$set": {"verified": True}})
    return {"ok": True}


@api.post("/admin/agents/{agent_id}/unverify")
async def admin_unverify(agent_id: str, user: dict = Depends(get_current_user)):
    await require_role(user, "admin")
    await db.agent_profiles.update_one({"agent_id": agent_id}, {"$set": {"verified": False}})
    return {"ok": True}


@api.get("/admin/stats")
async def admin_stats(user: dict = Depends(get_current_user)):
    await require_role(user, "admin")
    return {
        "users": await db.users.count_documents({}),
        "agents": await db.agent_profiles.count_documents({}),
        "verified_agents": await db.agent_profiles.count_documents({"verified": True}),
        "rfqs": await db.rfqs.count_documents({}),
        "quotes": await db.quotes.count_documents({}),
    }


# ---------- Buyer funnel: Niches & Blueprint ----------
@api.get("/network/stats")
async def network_stats():
    """Aggregate counts per category — used on landing page Number Cards."""
    pipeline = [
        {"$unwind": "$categories"},
        {"$group": {"_id": "$categories", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
    ]
    rows = await db.agent_profiles.aggregate(pipeline).to_list(100)
    total = await db.agent_profiles.count_documents({})
    verified = await db.agent_profiles.count_documents({"verified": True})
    return {
        "total": total,
        "verified": verified,
        "by_category": [{"category": r["_id"], "count": r["count"]} for r in rows if r.get("_id")],
    }


@api.get("/niches")
async def list_niches():
    return NICHES


@api.get("/niches/{niche_key}")
async def get_niche(niche_key: str):
    n = niche_for(niche_key)
    if not n:
        raise HTTPException(404, "Niche not found")
    return n


@api.get("/blueprints/{niche_key}/{sub_category}")
async def get_blueprint(niche_key: str, sub_category: str):
    n = niche_for(niche_key)
    if not n:
        raise HTTPException(404, "Niche not found")
    return blueprint_for(niche_key, sub_category)


@api.put("/users/me/profile")
async def update_buyer_profile(inp: BuyerProfileInput, user: dict = Depends(get_current_user)):
    await db.users.update_one(
        {"user_id": user["user_id"]},
        {"$set": {
            "niche_preference": inp.niche,
            "sub_category_preference": inp.sub_category,
            "business_model": inp.business_model,
            "phone": inp.phone,
            "chat_answers": inp.chat_answers,
        }},
    )
    return await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0})


# ---------- Public ----------
@api.get("/")
async def root():
    return {"service": "SourceHQ", "ok": True}


app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")


@app.on_event("startup")
async def startup_event():
    try:
        if init_storage():
            logging.info("Object storage initialized")
        else:
            logging.warning("Object storage init failed at startup; will retry on first upload")
    except Exception as e:
        logging.error(f"Storage init error: {e}")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
