import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { ArrowUpRight, Zap, ShieldCheck, MessageSquare, Sparkles, Briefcase, Factory } from "lucide-react";
import axios from "axios";
import { API } from "@/context/AuthContext";

const HERO_TEXTURE = "https://static.prod-images.emergentagent.com/jobs/cc07fdd8-74b2-4bb7-a874-33220127e764/images/9bb95dabd9ff5d0452db5805fbde0e07bd2d55b09c73129a50483f31a89641b0.png";
const ABSTRACT = "https://static.prod-images.emergentagent.com/jobs/cc07fdd8-74b2-4bb7-a874-33220127e764/images/7c7a0768dddc8939296fa181c0046def32f71a13720a185229cb718cd268aca9.png";
const FACTORY = "https://images.pexels.com/photos/34783124/pexels-photo-34783124.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940";

const CATEGORIES = [
  "Textile & Apparel", "Consumer Electronics", "Packaging", "Home Goods",
  "Beauty & Cosmetics", "Food & Beverage", "Hardware", "Toys & Games",
];

export default function Landing() {
  const [featured, setFeatured] = useState([]);
  const [networkStats, setNetworkStats] = useState(null);
  const nav = useNavigate();

  useEffect(() => {
    axios.get(`${API}/agents?verified=true`).then((r) => setFeatured(r.data.slice(0, 3))).catch(() => {});
    axios.get(`${API}/network/stats`).then((r) => setNetworkStats(r.data)).catch(() => {});
  }, []);

  const startLogin = (role) => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    if (role) localStorage.setItem("askwinn_desired_role", role);
    else localStorage.removeItem("askwinn_desired_role");
    const redirectUrl = window.location.origin + "/dashboard";
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  const startBuyerFunnel = () => {
    nav("/start");
  };

  return (
    <div className="min-h-screen bg-bone text-ink">
      <Navbar />

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-10 pt-16 pb-24 grid lg:grid-cols-12 gap-10">
          <div className="lg:col-span-7 flex flex-col justify-center reveal">
            <h1 className="font-serif text-[3.4rem] sm:text-[5rem] lg:text-[7rem] font-light leading-[0.92] tracking-[-0.04em]">
              Don't search for <em className="text-klein not-italic">manufacturers</em>.<br />
              Make them <span className="relative">bid<span className="absolute -bottom-1 left-0 right-0 h-1 bg-burn"></span></span> for your brand.
            </h1>
            <p className="mt-10 max-w-xl text-lg leading-relaxed text-[--muted-foreground]">
              AskWinn is the closed bidding engine where verified Indian manufacturers compete for your order. You set the brief — they bring the bids.
            </p>
            <div className="mt-12 flex flex-wrap gap-4">
              <button onClick={startBuyerFunnel} className="btn-primary" data-testid="hero-buyer-btn">
                <Briefcase className="w-4 h-4" /> Start your brief
              </button>
              <button onClick={() => startLogin("agent")} className="btn-accent" data-testid="hero-agent-btn">
                <Factory className="w-4 h-4" /> Manufacturer sign in
              </button>
              <a href="mailto:experts@askwinn.in?subject=I'd%20like%20to%20talk%20to%20an%20AskWinn%20expert" className="btn-outline" data-testid="hero-expert-btn">
                <MessageSquare className="w-4 h-4" /> Talk to an expert
              </a>
            </div>
            <div className="mt-16 grid grid-cols-3 gap-6 max-w-xl">
              <Stat n="240+" l="Verified manufacturers" />
              <Stat n="38" l="Cities" />
              <Stat n="$12M" l="RFQs matched" />
            </div>
          </div>
          <div className="lg:col-span-5 relative reveal-2">
            <div className="relative aspect-[3/4] overflow-hidden">
              <img src={HERO_TEXTURE} alt="Manufacturing materials" className="absolute inset-0 w-full h-full object-cover" />
              <div className="absolute top-4 left-4 tag accent">NEW — AI MATCH</div>
              <div className="absolute bottom-6 right-6 font-mono text-xs text-white/90">MAT_001 · STEEL + WEAVE</div>
            </div>
            <div className="absolute -bottom-8 -left-8 bg-bone border ink-border p-6 w-64 hidden lg:block">
              <Sparkles className="w-5 h-5 text-klein mb-3" />
              <div className="font-serif text-2xl leading-tight">AI-matched in 90 seconds.</div>
              <div className="overline mt-3 text-[10px]">POWERED BY CLAUDE</div>
            </div>
          </div>
        </div>
      </section>

      {/* MARQUEE */}
      <section className="border-y border-[--border-soft] overflow-hidden py-6 bg-ink text-white">
        <div className="marquee whitespace-nowrap font-mono text-sm tracking-[0.2em] uppercase">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="flex items-center gap-12 pr-12">
              {["Textile · Shenzhen", "Packaging · Istanbul", "Electronics · Taipei", "Ceramics · Porto", "Leather · Florence", "Cosmetics · Seoul", "Hardware · Guadalajara"].map((t) => (
                <span key={t} className="flex items-center gap-12"><span>{t}</span><span className="text-burn">◆</span></span>
              ))}
            </div>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="max-w-[1400px] mx-auto px-6 lg:px-10 py-28">
        <div className="grid lg:grid-cols-12 gap-10 mb-16">
          <div className="lg:col-span-4">
            <div className="overline mb-4">§ 01 — Method</div>
            <h2 className="font-serif text-5xl lg:text-6xl font-light leading-[0.95] tracking-tight">
              Three moves.<br />One clean line.
            </h2>
          </div>
          <div className="lg:col-span-7 lg:col-start-6 text-lg text-[--muted-foreground] leading-relaxed">
            From a half-sketched idea to a verified manufacturing partner — without Alibaba tabs, WhatsApp chaos, or agents who go dark.
          </div>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { i: Zap, t: "Post an RFQ", d: "Drop your spec — quantity, timeline, budget. We keep it private by default.", tag: "STEP 01" },
            { i: Sparkles, t: "AI curates agents", d: "Claude scans 240+ vetted partners and surfaces the three best fits for your brief.", tag: "STEP 02" },
            { i: MessageSquare, t: "Quote → chat → ship", d: "Agents respond in-thread. Compare quotes, lead times, and start the build.", tag: "STEP 03" },
          ].map((s, i) => (
            <div key={i} className="editorial-card p-8" style={{ animation: `reveal 0.6s ease-out ${i * 100}ms both` }}>
              <div className="overline mb-6">{s.tag}</div>
              <s.i className="w-6 h-6 text-klein mb-6" />
              <h3 className="font-serif text-3xl mb-3 tracking-tight leading-tight">{s.t}</h3>
              <p className="text-sm text-[--muted-foreground] leading-relaxed">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CATEGORIES */}
      <section className="bg-ink text-white">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-10 py-28">
          <div className="flex items-end justify-between mb-12 flex-wrap gap-6">
            <div>
              <div className="overline mb-4 text-burn">§ 02 — Industries we cover</div>
              <h2 className="font-serif text-5xl lg:text-6xl font-light leading-none tracking-tight">What do you<br /><em>actually</em> need to ship?</h2>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-white/10">
            {CATEGORIES.map((c, i) => (
              <button
                key={c}
                onClick={startBuyerFunnel}
                className="bg-ink hover:bg-klein p-8 transition-colors group text-left"
                data-testid={`cat-${c.replace(/\s+/g, "-").toLowerCase()}`}
              >
                <div className="font-mono text-xs opacity-50 mb-8">{String(i + 1).padStart(2, "0")}</div>
                <div className="font-serif text-2xl leading-tight group-hover:translate-x-1 transition-transform">{c}</div>
                <ArrowUpRight className="w-4 h-4 mt-6 opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* NETWORK NUMBER CARDS */}
      <section className="max-w-[1400px] mx-auto px-6 lg:px-10 py-28">
        <div className="grid lg:grid-cols-12 gap-10 mb-12">
          <div className="lg:col-span-7">
            <div className="overline mb-4">§ 03 — Network</div>
            <h2 className="font-serif text-5xl lg:text-6xl font-light leading-none tracking-tight">
              Verified manufacturers,<br /><em className="text-klein not-italic">on tap</em>.
            </h2>
          </div>
          <div className="lg:col-span-4 lg:col-start-9 text-base text-[--muted-foreground] leading-relaxed self-end">
            Our closed network is what makes bids competitive. Every manufacturer is verified — factory walkthrough, audits, references on file.
          </div>
        </div>

        {networkStats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {networkStats.by_category.map((row, i) => (
              <div key={row.category} className="editorial-card p-7" data-testid={`network-card-${row.category.replace(/\s+/g, "-").toLowerCase()}`}>
                <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-[--muted-foreground] mb-4">Nº{String(i + 1).padStart(2, "0")}</div>
                <div className="font-serif text-6xl tracking-tight leading-none">{row.count}<span className="text-2xl text-klein ml-1">+</span></div>
                <div className="overline mt-3 text-[10px]">{row.category} manufacturers</div>
              </div>
            ))}
            {networkStats.by_category.length === 0 && (
              <div className="col-span-full text-sm text-[--muted-foreground] font-mono">— Network warming up. Be the first brief.</div>
            )}
          </div>
        )}
      </section>

      {/* TRUST */}
      <section className="max-w-[1400px] mx-auto px-6 lg:px-10 py-28 grid lg:grid-cols-12 gap-10 items-center">
        <div className="lg:col-span-6 relative aspect-[4/5] order-2 lg:order-1">
          <img src={FACTORY} alt="Factory" className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute top-6 left-6 tag verified">VERIFIED PARTNER</div>
        </div>
        <div className="lg:col-span-5 lg:col-start-8 order-1 lg:order-2">
          <div className="overline mb-4">§ 04 — Trust</div>
          <h2 className="font-serif text-5xl lg:text-6xl font-light leading-[0.95] tracking-tight mb-8">
            Every agent, <em className="text-klein not-italic">verified</em>.
          </h2>
          <p className="text-lg text-[--muted-foreground] mb-8 leading-relaxed">
            Our ops team checks business licences, factory audits, and capacity against actual orders. You won't find drop-shippers wearing factory uniforms here.
          </p>
          <div className="space-y-4">
            {["Business licence & tax ID verified", "Factory walkthrough video on record", "Minimum 3 production references", "NDA + IP protection by default"].map((x) => (
              <div key={x} className="flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-klein mt-0.5 flex-shrink-0" />
                <span className="text-sm">{x}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-[1400px] mx-auto px-6 lg:px-10 py-20">
        <div className="bg-klein text-white p-12 lg:p-20 relative overflow-hidden">
          <img src={ABSTRACT} alt="" className="absolute right-0 top-0 h-full w-1/2 object-cover opacity-30 mix-blend-screen" />
          <div className="relative max-w-3xl">
            <div className="overline text-white/70 mb-6">READY?</div>
            <h2 className="font-serif text-5xl lg:text-7xl font-light leading-[0.95] tracking-tight mb-10">
              Your next SKU is<br />one RFQ away.
            </h2>
            <button onClick={startBuyerFunnel} className="btn-accent" data-testid="cta-start-btn">
              Start as a buyer <ArrowUpRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

const Stat = ({ n, l }) => (
  <div>
    <div className="font-serif text-4xl lg:text-5xl tracking-tight leading-none">{n}</div>
    <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[--muted-foreground] mt-2">{l}</div>
  </div>
);
