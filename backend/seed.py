"""Seed demo agents for testing."""
import asyncio
import os
import uuid
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).parent / ".env")
client = AsyncIOMotorClient(os.environ["MONGO_URL"])
db = client[os.environ["DB_NAME"]]


AGENTS = [
    {
        "company_name": "Lumen Textile Collective",
        "tagline": "Premium organic cotton, knit & woven, small-to-mid runs for indie brands.",
        "bio": "20 years of organic cotton expertise. GOTS certified. Based in Porto with partner mills in Izmir.",
        "categories": ["Textile & Apparel"],
        "regions": ["Portugal", "Turkey"],
        "services": ["Sampling", "Cut & Sew", "Dyeing", "QC", "Drop shipping"],
        "min_order_qty": 150,
        "certifications": ["GOTS", "OEKO-TEX", "ISO 9001"],
        "verified": True,
        "rating": 4.8,
        "reviews_count": 34,
        "portfolio_images": [
            "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=800",
            "https://images.unsplash.com/photo-1558618047-fd43f1e7c430?auto=format&fit=crop&w=800",
        ],
    },
    {
        "company_name": "Shenzhen Circuit Foundry",
        "tagline": "Consumer electronics ODM — from schematic to shelf in 12 weeks.",
        "bio": "Full-stack electronics manufacturing: PCB assembly, firmware, tooling, injection molding, FCC/CE compliance.",
        "categories": ["Consumer Electronics", "Hardware"],
        "regions": ["China"],
        "services": ["PCB", "Assembly", "Tooling", "Compliance", "Logistics"],
        "min_order_qty": 500,
        "certifications": ["ISO 9001", "FCC", "CE", "RoHS"],
        "verified": True,
        "rating": 4.6,
        "reviews_count": 58,
        "portfolio_images": [
            "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=800",
        ],
    },
    {
        "company_name": "Kraft & Cedar Packaging",
        "tagline": "Sustainable packaging, boutique print runs — Istanbul to the world.",
        "bio": "FSC-certified kraft, soy inks, compostable liners. Perfect for beauty and food startups.",
        "categories": ["Packaging"],
        "regions": ["Turkey", "Portugal"],
        "services": ["Design support", "Die-cutting", "Print", "Foil", "Fulfillment"],
        "min_order_qty": 500,
        "certifications": ["FSC", "BRC", "ISO 14001"],
        "verified": True,
        "rating": 4.9,
        "reviews_count": 22,
        "portfolio_images": [],
    },
    {
        "company_name": "Seoul Skin Labs",
        "tagline": "K-beauty contract manufacturing with clinical testing built-in.",
        "bio": "Serums, creams, sheet masks. Full formulation, stability testing, regulatory filing for US/EU/KR.",
        "categories": ["Beauty & Cosmetics"],
        "regions": ["USA"],
        "services": ["Formulation", "Fill & Finish", "Regulatory", "Stability testing"],
        "min_order_qty": 3000,
        "certifications": ["cGMP", "ISO 22716"],
        "verified": True,
        "rating": 4.7,
        "reviews_count": 19,
        "portfolio_images": [],
    },
    {
        "company_name": "Guadalajara Hardware Works",
        "tagline": "Precision metal and plastic parts for hardware startups.",
        "bio": "CNC, sheet metal, injection mold, anodizing. Nearshore to US with USMCA tariff benefits.",
        "categories": ["Hardware", "Home Goods"],
        "regions": ["Mexico"],
        "services": ["CNC", "Tooling", "Assembly", "Finishing"],
        "min_order_qty": 250,
        "certifications": ["ISO 9001", "IATF 16949"],
        "verified": False,
        "rating": 4.3,
        "reviews_count": 8,
        "portfolio_images": [],
    },
    {
        "company_name": "Hanoi Toy House",
        "tagline": "Wooden and soft toys, CPSIA & EN-71 compliant, ethically made.",
        "bio": "Family-run factory with 15 years of OEM experience for European toy brands.",
        "categories": ["Toys & Games"],
        "regions": ["Vietnam"],
        "services": ["Design", "Prototyping", "Mass production"],
        "min_order_qty": 1000,
        "certifications": ["CPSIA", "EN-71", "BSCI"],
        "verified": True,
        "rating": 4.5,
        "reviews_count": 12,
        "portfolio_images": [],
    },
]


async def main():
    # Only seed if none exist
    existing = await db.agent_profiles.count_documents({})
    if existing > 0:
        print(f"Already have {existing} agents. Skipping seed.")
        return
    # Create a shadow user for each agent
    now = datetime.now(timezone.utc).isoformat()
    for a in AGENTS:
        user_id = f"seed_user_{uuid.uuid4().hex[:8]}"
        await db.users.insert_one({
            "user_id": user_id,
            "email": f"{user_id}@sourcehq.seed",
            "name": a["company_name"],
            "picture": None,
            "role": "agent",
            "created_at": now,
        })
        doc = {
            "agent_id": f"agent_{uuid.uuid4().hex[:12]}",
            "user_id": user_id,
            "created_at": now,
            **a,
        }
        await db.agent_profiles.insert_one(doc)
        print(f"Seeded: {a['company_name']}")
    print("Done.")


asyncio.run(main())
