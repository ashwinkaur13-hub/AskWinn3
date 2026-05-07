import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { API } from "@/context/AuthContext";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import * as Icons from "lucide-react";
import { ArrowUpRight } from "lucide-react";

export default function StartNiche() {
  const [niches, setNiches] = useState([]);
  const nav = useNavigate();

  useEffect(() => {
    axios.get(`${API}/niches`).then((r) => setNiches(r.data));
  }, []);

  const pick = (n) => {
    sessionStorage.setItem("askwinn_funnel_niche", n.key);
    sessionStorage.setItem("askwinn_funnel_niche_label", n.label);
    nav(`/start/chat?niche=${n.key}`);
  };

  return (
    <div className="min-h-screen bg-bone">
      <Navbar />
      <div className="max-w-[1400px] mx-auto px-6 lg:px-10 py-16">
        <div className="grid lg:grid-cols-12 gap-10 mb-14">
          <div className="lg:col-span-7">
            <div className="overline mb-4">§ STEP 01 / 04 — PICK A NICHE</div>
            <h1 className="font-serif text-5xl lg:text-7xl font-light leading-[0.95] tracking-tight mb-6">
              Build your brand.<br />
              Find the right <em className="text-klein not-italic">manufacturer</em>.
            </h1>
            <p className="text-lg text-[--muted-foreground] max-w-2xl">
              Tell us what you're building and we'll match you with verified manufacturing agents.
              Pick a category to start a 90-second guided brief.
            </p>
          </div>
          <div className="lg:col-span-4 lg:col-start-9 hidden lg:block">
            <div className="editorial-card p-6 border-l-4 border-l-klein">
              <div className="overline mb-3">§ HOW IT WORKS</div>
              <ol className="space-y-3 text-sm">
                <li><span className="font-mono text-klein mr-2">01.</span>Pick a niche</li>
                <li><span className="font-mono text-klein mr-2">02.</span>Answer 3 quick questions</li>
                <li><span className="font-mono text-klein mr-2">03.</span>Unlock your Business Blueprint</li>
                <li><span className="font-mono text-klein mr-2">04.</span>Post your RFQ — bids in 24h</li>
              </ol>
            </div>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4" data-testid="niches-grid">
          {niches.map((n, i) => {
            const Icon = Icons[n.icon] || Icons.Box;
            return (
              <button
                key={n.key}
                onClick={() => pick(n)}
                className="editorial-card p-7 text-left group"
                style={{ animation: `reveal 0.5s ease-out ${i * 60}ms both` }}
                data-testid={`niche-card-${n.key}`}
              >
                <div className="flex items-start justify-between mb-6">
                  <Icon className="w-6 h-6 text-klein" />
                  <ArrowUpRight className="w-4 h-4 opacity-0 group-hover:opacity-100 group-hover:-translate-y-1 group-hover:translate-x-1 transition-all" />
                </div>
                <div className="font-serif text-3xl tracking-tight leading-tight mb-3 group-hover:text-klein transition-colors">{n.label}</div>
                <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-burn">{n.opportunity_teaser}</div>
                <div className="hairline mt-5 pt-4 text-xs text-[--muted-foreground] flex flex-wrap gap-x-3 gap-y-1">
                  {n.sub_categories.slice(0, 3).map((s) => (<span key={s}>· {s}</span>))}
                  {n.sub_categories.length > 3 && <span>· +{n.sub_categories.length - 3} more</span>}
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-16 text-center">
          <p className="text-sm text-[--muted-foreground]">
            Don't see your category? <a href="mailto:experts@askwinn.in?subject=Custom%20brief%20-%20outside%20listed%20niches" className="underline" data-testid="other-niche-expert-link">Talk to an expert →</a>
          </p>
        </div>
      </div>
      <Footer />
    </div>
  );
}
