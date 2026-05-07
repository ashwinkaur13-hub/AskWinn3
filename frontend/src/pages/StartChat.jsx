import React, { useEffect, useRef, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { API, useAuth } from "@/context/AuthContext";
import Navbar from "@/components/Navbar";
import { Sparkles, ArrowRight, Lock } from "lucide-react";

const NICHE_PRODUCT_EXAMPLES = {
  jewellery: "A handcrafted silver pendant collection for Diwali gifting",
  apparel: "A capsule of heavyweight oversized tees for streetwear",
  beauty: "A vitamin-C niacinamide serum for sensitive skin",
  "home-decor": "Soy-wax candles in handmade ceramic vessels",
  electronics: "Bluetooth earbuds with active noise cancellation",
  packaging: "Eco-kraft mailers for a beauty D2C brand",
  food: "Single-origin millet snack bars",
  toys: "A wooden Montessori activity board for toddlers",
};

const QUESTIONS = [
  {
    key: "product_idea",
    bot: () => "Excellent choice. Let's define your execution strategy. What specific product category are we building?",
    placeholderFn: (key) => `e.g. ${NICHE_PRODUCT_EXAMPLES[key] || "describe the product you want to build"}`,
    type: "text",
  },
  {
    key: "business_model",
    bot: () => "Got it. How will you sell — direct-to-consumer, wholesale, marketplace, or a mix?",
    options: ["D2C / own website", "Marketplace (Amazon, Myntra)", "Wholesale / B2B", "Retail stores", "Subscription"],
    type: "choice",
  },
  {
    key: "budget_range",
    bot: () => "What's your total budget for the first production run?",
    options: ["Under ₹1 L", "₹1–5 L", "₹5–15 L", "₹15–50 L", "₹50 L+"],
    type: "choice",
  },
  {
    key: "timeline",
    bot: () => "Last one — when do you need stock in hand?",
    options: ["ASAP (< 4 weeks)", "1–2 months", "2–4 months", "4+ months / flexible"],
    type: "choice",
  },
];

export default function StartChat() {
  const [params] = useSearchParams();
  const niche = params.get("niche") || sessionStorage.getItem("askwinn_funnel_niche");
  const nicheLabel = sessionStorage.getItem("askwinn_funnel_niche_label") || "your niche";
  const nav = useNavigate();
  const { user } = useAuth();

  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [draft, setDraft] = useState("");
  const [done, setDone] = useState(false);
  const scrollRef = useRef(null);

  const messages = [{ from: "bot", text: `Hi 👋 So you're thinking ${nicheLabel.toLowerCase()}? Let's build together.` }];
  for (let i = 0; i <= step; i++) {
    if (i >= QUESTIONS.length) break;
    const q = QUESTIONS[i];
    messages.push({ from: "bot", text: typeof q.bot === "function" ? q.bot(nicheLabel) : q.bot });
    if (answers[q.key]) messages.push({ from: "user", text: answers[q.key] });
  }
  if (done) {
    messages.push({ from: "bot", text: "Perfect. Your personalised AskWinn Blueprint is ready — sign in to unlock it." });
  }

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [step, draft, done]);

  if (!niche) {
    return (
      <div className="min-h-screen bg-bone p-20 text-center">
        <p className="font-mono text-sm">Missing niche.</p>
        <button onClick={() => nav("/start")} className="btn-primary mt-4">Pick a niche →</button>
      </div>
    );
  }

  const current = QUESTIONS[step];
  const submitText = (val) => {
    const updated = { ...answers, [current.key]: val };
    setAnswers(updated);
    setDraft("");
    if (step + 1 >= QUESTIONS.length) {
      sessionStorage.setItem("askwinn_funnel_answers", JSON.stringify(updated));
      setDone(true);
    } else {
      setStep(step + 1);
    }
  };

  const startLogin = async () => {
    sessionStorage.setItem("askwinn_funnel_answers", JSON.stringify(answers));
    sessionStorage.setItem("askwinn_funnel_complete", "1");
    if (user) {
      // already signed in — save profile and go to sub-category step
      try {
        await axios.put(`${API}/users/me/profile`, {
          niche, business_model: answers.business_model || "", chat_answers: answers,
        });
      } catch {}
      nav(`/onboarding/sub-category?niche=${niche}`);
      return;
    }
    localStorage.setItem("askwinn_desired_role", "buyer");
    const redirectUrl = window.location.origin + `/onboarding/sub-category?niche=${niche}`;
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  return (
    <div className="min-h-screen bg-bone flex flex-col">
      <Navbar />
      <div className="flex-1 max-w-[900px] w-full mx-auto px-6 lg:px-10 py-12">
        <div className="overline mb-3">§ STEP 02 / 04 — BUILDING YOUR BRIEF</div>
        <h1 className="font-serif text-4xl lg:text-5xl font-light leading-tight tracking-tight mb-8">
          Tell us about <em className="text-klein not-italic">{nicheLabel.toLowerCase()}</em>.
        </h1>

        <div className="editorial-card p-0 overflow-hidden flex flex-col" style={{ height: "62vh" }}>
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-3" data-testid="chat-messages">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.from === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[75%] p-4 ${m.from === "user" ? "bg-klein text-white" : "bg-[--muted] text-ink border border-[--border-soft]"}`}>
                  {m.from === "bot" && <Sparkles className="w-3 h-3 inline mr-2 mb-0.5 text-klein" />}
                  <span className="text-sm whitespace-pre-wrap">{m.text}</span>
                </div>
              </div>
            ))}
          </div>

          {!done ? (
            <div className="border-t border-[--border-soft] p-4" data-testid="chat-composer">
              {current?.type === "choice" ? (
                <div className="flex flex-wrap gap-2">
                  {current.options.map((o) => (
                    <button
                      key={o}
                      onClick={() => submitText(o)}
                      className="tag cursor-pointer hover:bg-klein hover:text-white hover:border-klein transition-colors"
                      data-testid={`chat-choice-${o.replace(/\s+/g, "-").toLowerCase()}`}
                    >
                      {o}
                    </button>
                  ))}
                </div>
              ) : (
                <form
                  onSubmit={(e) => { e.preventDefault(); if (draft.trim()) submitText(draft.trim()); }}
                  className="flex gap-3"
                >
                  <input
                    autoFocus
                    className="input-underline flex-1"
                    placeholder={current?.placeholderFn ? current.placeholderFn(niche) : (current?.placeholder || "Type your answer…")}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    data-testid="chat-input"
                  />
                  <button type="submit" className="btn-primary" data-testid="chat-submit">
                    Send <ArrowRight className="w-4 h-4" />
                  </button>
                </form>
              )}
              <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[--muted-foreground] mt-3">
                {step + 1} / {QUESTIONS.length}
              </div>
            </div>
          ) : (
            <div className="border-t border-[--border-soft] p-6 bg-klein/5" data-testid="chat-cta">
              <div className="flex items-start gap-4">
                <Lock className="w-5 h-5 text-klein mt-1" />
                <div className="flex-1">
                  <div className="font-serif text-2xl tracking-tight mb-2">Your personalised Blueprint is ready.</div>
                  <p className="text-sm text-[--muted-foreground] mb-4">
                    Sign in (it's free) to unlock the full report — market size, MOQs, margins, top hubs, and the risks others miss.
                  </p>
                  <button onClick={startLogin} className="btn-primary" data-testid="chat-unlock-btn">
                    Unlock my Blueprint <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
