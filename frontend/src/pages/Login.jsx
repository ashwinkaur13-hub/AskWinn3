import React from "react";
import { Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import { Briefcase, Factory, ArrowUpRight } from "lucide-react";

const startGoogle = (role) => {
  // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
  if (role) localStorage.setItem("askwinn_desired_role", role);
  else localStorage.removeItem("askwinn_desired_role");
  const redirectUrl = window.location.origin + "/dashboard";
  window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
};

export default function Login() {
  return (
    <div className="min-h-screen bg-bone flex flex-col">
      <Navbar />
      <div className="flex-1 flex items-center justify-center px-6 py-20">
        <div className="max-w-5xl w-full">
          <div className="text-center mb-16 reveal">
            <div className="overline mb-4">§ ENTRY</div>
            <h1 className="font-serif text-5xl lg:text-7xl font-light leading-[0.95] tracking-tight">
              Who are you<br />
              <em className="text-klein not-italic">today</em>?
            </h1>
            <p className="mt-6 text-[--muted-foreground] text-lg max-w-xl mx-auto">
              Pick a side to sign in. This shapes your dashboard — you can always reach out if it changes.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <button
              onClick={() => startGoogle("buyer")}
              className="editorial-card p-10 text-left group relative overflow-hidden reveal-2"
              data-testid="login-as-buyer"
            >
              <Briefcase className="w-10 h-10 text-klein mb-8" />
              <div className="overline mb-3">A — BUYER</div>
              <h2 className="font-serif text-4xl leading-tight tracking-tight mb-4">I'm building a product.</h2>
              <p className="text-sm text-[--muted-foreground] leading-relaxed mb-8">
                Post RFQs, get AI-matched to verified manufacturing agents, compare quotes, and ship.
              </p>
              <div className="flex items-center justify-between font-mono text-xs uppercase tracking-[0.15em]">
                <span>Sign in with Google</span>
                <ArrowUpRight className="w-4 h-4 transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" />
              </div>
            </button>

            <button
              onClick={() => startGoogle("agent")}
              className="editorial-card p-10 text-left group relative overflow-hidden reveal-3"
              data-testid="login-as-provider"
            >
              <Factory className="w-10 h-10 text-burn mb-8" />
              <div className="overline mb-3 text-burn">B — SERVICE PROVIDER</div>
              <h2 className="font-serif text-4xl leading-tight tracking-tight mb-4">I do end-to-end production.</h2>
              <p className="text-sm text-[--muted-foreground] leading-relaxed mb-8">
                Build your profile, receive RFQs from vetted founders, and land your next big client.
              </p>
              <div className="flex items-center justify-between font-mono text-xs uppercase tracking-[0.15em]">
                <span>Sign in with Google</span>
                <ArrowUpRight className="w-4 h-4 transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" />
              </div>
            </button>
          </div>

          <div className="text-center mt-12">
            <Link to="/" className="font-mono text-xs underline text-[--muted-foreground]">← BACK TO HOME</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
