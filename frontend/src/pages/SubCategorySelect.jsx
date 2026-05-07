import React, { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { API, useAuth } from "@/context/AuthContext";
import Navbar from "@/components/Navbar";
import { ArrowRight, Lock, Phone } from "lucide-react";

export default function SubCategorySelect() {
  const [params] = useSearchParams();
  const niche = params.get("niche");
  const nav = useNavigate();
  const { user, refresh } = useAuth();
  const [niches, setNiche] = useState(null);
  const [picked, setPicked] = useState("");
  const [otherText, setOtherText] = useState("");
  const [showPhoneGate, setShowPhoneGate] = useState(false);
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!niche) return;
    axios.get(`${API}/niches/${niche}`).then((r) => setNiche(r.data));
  }, [niche]);

  const proceedToBlueprint = async (finalSub) => {
    setBusy(true);
    let answers = {};
    try { answers = JSON.parse(sessionStorage.getItem("askwinn_funnel_answers") || "{}"); } catch {}
    try {
      await axios.put(`${API}/users/me/profile`, {
        niche,
        sub_category: finalSub,
        business_model: answers.business_model || "",
        phone: phone || (user?.phone || ""),
        chat_answers: answers,
      });
    } catch {}
    nav(`/blueprint/${niche}/${encodeURIComponent(finalSub)}`);
  };

  const next = async () => {
    if (!picked) return;
    const isOther = picked === "__other__";
    const finalSub = isOther ? otherText.trim() : picked;
    if (isOther && !finalSub) return;

    // Lead-capture gate: require phone before unlocking blueprint (per AskWinn.xlsx)
    if (!user?.phone && !phone) {
      sessionStorage.setItem("askwinn_pending_sub", finalSub);
      setShowPhoneGate(true);
      return;
    }
    await proceedToBlueprint(finalSub);
  };

  const submitPhone = async (e) => {
    e.preventDefault();
    const cleaned = phone.replace(/\s|-/g, "");
    if (!/^\+?\d{10,15}$/.test(cleaned)) {
      alert("Please enter a valid phone / WhatsApp number");
      return;
    }
    const finalSub = sessionStorage.getItem("askwinn_pending_sub") || (picked === "__other__" ? otherText.trim() : picked);
    setShowPhoneGate(false);
    await refresh?.();
    await proceedToBlueprint(finalSub);
  };

  if (!niches) return <div className="min-h-screen bg-bone p-20 text-center font-mono text-sm">Loading…</div>;

  return (
    <div className="min-h-screen bg-bone">
      <Navbar />
      <div className="max-w-[1100px] mx-auto px-6 lg:px-10 py-16">
        <div className="overline mb-3">§ STEP 03 / 04 — NARROW IT DOWN</div>
        <h1 className="font-serif text-4xl lg:text-6xl font-light leading-tight tracking-tight mb-4">
          Which slice of <em className="text-klein not-italic">{niches.label.toLowerCase()}</em>?
        </h1>
        <p className="text-base text-[--muted-foreground] mb-12 max-w-xl">
          Different sub-categories have wildly different MOQs, margins, and risks — pick the closest fit.
        </p>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6" data-testid="sub-category-grid">
          {niches.sub_categories.map((s) => (
            <button
              key={s}
              onClick={() => setPicked(s)}
              className={`editorial-card p-7 text-left transition-all ${picked === s ? "border-klein border-2 bg-klein/5" : "hover:border-ink"}`}
              data-testid={`sub-cat-${s.replace(/\s+/g, "-").toLowerCase()}`}
            >
              <div className="font-mono text-[10px] text-[--muted-foreground] mb-3">SUB-CATEGORY</div>
              <div className="font-serif text-2xl tracking-tight">{s}</div>
              {picked === s && <div className="overline text-[10px] text-klein mt-3">SELECTED ✓</div>}
            </button>
          ))}
          <button
            onClick={() => setPicked("__other__")}
            className={`editorial-card p-7 text-left transition-all ${picked === "__other__" ? "border-klein border-2 bg-klein/5" : "border-dashed hover:border-ink"}`}
            data-testid="sub-cat-other"
          >
            <div className="font-mono text-[10px] text-[--muted-foreground] mb-3">DON'T SEE IT?</div>
            <div className="font-serif text-2xl tracking-tight">Other</div>
            {picked === "__other__" && (
              <input
                autoFocus
                className="input-underline mt-3 text-base"
                placeholder="Tell us what you're sourcing"
                value={otherText}
                onChange={(e) => setOtherText(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                data-testid="sub-cat-other-input"
              />
            )}
          </button>
        </div>

        <button
          onClick={next}
          disabled={!picked || busy || (picked === "__other__" && !otherText.trim())}
          className="btn-primary mt-6"
          data-testid="sub-cat-next-btn"
        >
          {busy ? "Loading…" : "See my Blueprint"} <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {showPhoneGate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-ink/70 backdrop-blur-sm" data-testid="phone-gate-modal">
          <form onSubmit={submitPhone} className="bg-bone max-w-md w-full p-10 border-l-4 border-l-klein">
            <Lock className="w-6 h-6 text-klein mb-4" />
            <div className="overline mb-3">§ ONE LAST STEP</div>
            <h3 className="font-serif text-3xl font-light leading-tight tracking-tight mb-3">
              Where should we <em className="text-klein not-italic">WhatsApp</em> you the bids?
            </h3>
            <p className="text-sm text-[--muted-foreground] mb-6">
              Once your RFQ goes live, manufacturers usually bid within 24 hours. We'll text you on this number — no spam, just bid notifications.
            </p>
            <div className="flex items-center gap-3 mb-3">
              <Phone className="w-4 h-4 text-klein flex-shrink-0" />
              <input
                autoFocus
                type="tel"
                required
                className="input-underline flex-1"
                placeholder="+91 98765 43210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                data-testid="phone-gate-input"
              />
            </div>
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[--muted-foreground] mb-6">
              We never share your number with manufacturers — ever.
            </p>
            <div className="flex gap-3">
              <button type="submit" disabled={busy} className="btn-primary flex-1 justify-center" data-testid="phone-gate-submit">
                Unlock my Blueprint <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
