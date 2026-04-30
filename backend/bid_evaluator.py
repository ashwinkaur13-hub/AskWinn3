"""Pluggable bid evaluator — rank quotes for an RFQ.

Provider is selected via env vars so an open-source model (Ollama / OpenRouter)
can be swapped in without touching business logic.

env:
  BID_EVAL_PROVIDER   -- "gemini" (default, cheapest via Emergent key),
                         "anthropic", "openai", "ollama", "openrouter"
  BID_EVAL_MODEL      -- model name (defaults per provider)
  OLLAMA_URL          -- required if provider=ollama (e.g. http://localhost:11434)
  OPENROUTER_API_KEY  -- required if provider=openrouter
"""
from __future__ import annotations

import json
import os
import re
from typing import Any

EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY")
PROVIDER = os.environ.get("BID_EVAL_PROVIDER", "gemini").lower()
MODEL = os.environ.get("BID_EVAL_MODEL")


SYSTEM_PROMPT = (
    "You are an expert B2B sourcing analyst. Given an RFQ and a list of supplier "
    "quotes, rank every quote from best fit to worst. Consider price vs budget, "
    "lead time vs timeline, supplier verification, rating, category match, and "
    "quote quality. Return JSON only — no prose."
)


def _build_prompt(rfq: dict, quotes: list[dict]) -> str:
    quote_brief = [
        {
            "quote_id": q["quote_id"],
            "price_usd": q["price_usd"],
            "lead_time_days": q["lead_time_days"],
            "message": q.get("message", "")[:400],
            "agent": {
                "company": q.get("agent", {}).get("company_name"),
                "verified": q.get("agent", {}).get("verified", False),
                "rating": q.get("agent", {}).get("rating", 0),
                "categories": q.get("agent", {}).get("categories", []),
                "regions": q.get("agent", {}).get("regions", []),
            } if q.get("agent") else {},
        }
        for q in quotes
    ]
    return f"""RFQ:
{json.dumps({
    'title': rfq['title'], 'description': rfq['description'],
    'category': rfq['category'], 'region': rfq['target_region'],
    'quantity': rfq['quantity'], 'budget_usd': rfq['budget_usd'],
    'timeline': rfq['timeline'],
}, indent=2)}

Quotes:
{json.dumps(quote_brief, indent=2)}

Return JSON with this exact shape:
{{
  "winner_quote_id": "<best quote_id>",
  "ranked": [
    {{"quote_id": "...", "score": 0-100, "verdict": "strong|ok|weak",
       "pros": ["..."], "cons": ["..."], "reason": "1-sentence summary"}}
  ],
  "summary": "2-sentence overall take for the buyer"
}}"""


async def _call_emergent(provider: str, model: str, prompt: str, session_id: str) -> str:
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    chat = LlmChat(
        api_key=EMERGENT_KEY, session_id=session_id, system_message=SYSTEM_PROMPT,
    ).with_model(provider, model)
    return await chat.send_message(UserMessage(text=prompt))


async def _call_ollama(model: str, prompt: str) -> str:
    import httpx
    url = os.environ["OLLAMA_URL"].rstrip("/") + "/api/chat"
    async with httpx.AsyncClient(timeout=60) as http:
        r = await http.post(url, json={
            "model": model, "stream": False,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
        })
    return r.json()["message"]["content"]


async def _call_openrouter(model: str, prompt: str) -> str:
    import httpx
    key = os.environ["OPENROUTER_API_KEY"]
    async with httpx.AsyncClient(timeout=60) as http:
        r = await http.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers={"Authorization": f"Bearer {key}"},
            json={
                "model": model,
                "messages": [
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": prompt},
                ],
            },
        )
    return r.json()["choices"][0]["message"]["content"]


def _parse(raw: str) -> dict[str, Any]:
    m = re.search(r"\{[\s\S]*\}", raw)
    if not m:
        return {"ranked": [], "summary": raw[:200]}
    return json.loads(m.group(0))


def _heuristic(rfq: dict, quotes: list[dict]) -> dict[str, Any]:
    """Deterministic fallback when no LLM is available."""
    budget = float(rfq["budget_usd"] or 1)
    ranked = []
    for q in quotes:
        price_fit = max(0, 100 - abs(q["price_usd"] - budget) / budget * 100)
        ag = q.get("agent", {}) or {}
        verif = 20 if ag.get("verified") else 0
        rating = (ag.get("rating") or 0) * 8
        lead = max(0, 40 - q["lead_time_days"] * 0.5)
        score = round(price_fit * 0.5 + verif + rating + lead * 0.2, 1)
        ranked.append({
            "quote_id": q["quote_id"], "score": min(100, score),
            "verdict": "strong" if score > 70 else "ok" if score > 45 else "weak",
            "pros": [f"${q['price_usd']} vs ${budget} budget"] + (["Verified"] if ag.get("verified") else []),
            "cons": [] if score > 60 else ["Review specs carefully"],
            "reason": f"Score {score} based on price/lead/verification.",
        })
    ranked.sort(key=lambda x: x["score"], reverse=True)
    return {
        "winner_quote_id": ranked[0]["quote_id"] if ranked else None,
        "ranked": ranked,
        "summary": "Heuristic ranking (no LLM configured).",
    }


async def evaluate_bids(rfq: dict, quotes: list[dict]) -> dict[str, Any]:
    if not quotes:
        return {"winner_quote_id": None, "ranked": [], "summary": "No quotes to evaluate yet."}
    prompt = _build_prompt(rfq, quotes)
    session_id = f"bids_{rfq['rfq_id']}"
    try:
        if PROVIDER == "gemini":
            raw = await _call_emergent("gemini", MODEL or "gemini-2.5-flash-lite", prompt, session_id)
        elif PROVIDER == "anthropic":
            raw = await _call_emergent("anthropic", MODEL or "claude-sonnet-4-5-20250929", prompt, session_id)
        elif PROVIDER == "openai":
            raw = await _call_emergent("openai", MODEL or "gpt-5-mini", prompt, session_id)
        elif PROVIDER == "ollama":
            raw = await _call_ollama(MODEL or "llama3.1", prompt)
        elif PROVIDER == "openrouter":
            raw = await _call_openrouter(MODEL or "meta-llama/llama-3.1-8b-instruct:free", prompt)
        else:
            return _heuristic(rfq, quotes)
        parsed = _parse(raw)
        parsed["provider"] = PROVIDER
        parsed["model"] = MODEL or "default"
        # attach agent details to each ranked item
        by_id = {q["quote_id"]: q for q in quotes}
        for r in parsed.get("ranked", []):
            q = by_id.get(r.get("quote_id"))
            if q:
                r["agent"] = q.get("agent")
                r["price_usd"] = q["price_usd"]
                r["lead_time_days"] = q["lead_time_days"]
        return parsed
    except Exception as e:
        fallback = _heuristic(rfq, quotes)
        fallback["error"] = f"{PROVIDER} failed: {e}"
        return fallback
