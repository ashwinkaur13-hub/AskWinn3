import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuth, API } from "@/context/AuthContext";
import { Briefcase, Factory } from "lucide-react";

export default function RoleSelect() {
  const { user, refresh } = useAuth();
  const nav = useNavigate();
  const [loading, setLoading] = useState(false);

  if (!user) {
    nav("/", { replace: true });
    return null;
  }

  const pick = async (role) => {
    setLoading(true);
    await axios.post(`${API}/auth/role`, { role });
    await refresh();
    nav(role === "agent" ? "/profile/edit" : "/dashboard", { replace: true });
  };

  return (
    <div className="min-h-screen bg-bone flex items-center justify-center px-6 py-20">
      <div className="max-w-4xl w-full">
        <div className="overline mb-6 text-center">WELCOME, {user.name?.toUpperCase()}</div>
        <h1 className="font-serif text-5xl lg:text-7xl font-light leading-none tracking-tight text-center mb-4">
          How will you <em className="text-klein not-italic">show up</em>?
        </h1>
        <p className="text-center text-[--muted-foreground] mb-16 text-lg">Pick one. You can't change this later without contacting support.</p>
        <div className="grid md:grid-cols-2 gap-6">
          <button
            onClick={() => pick("buyer")}
            disabled={loading}
            className="editorial-card p-10 text-left group"
            data-testid="role-buyer-btn"
          >
            <Briefcase className="w-10 h-10 text-klein mb-6" />
            <div className="overline mb-3">A — BUYER</div>
            <h3 className="font-serif text-4xl leading-tight mb-4">I'm building a product.</h3>
            <p className="text-sm text-[--muted-foreground] leading-relaxed">Post RFQs, get AI-matched to verified manufacturing agents, compare quotes, and ship.</p>
          </button>
          <button
            onClick={() => pick("agent")}
            disabled={loading}
            className="editorial-card p-10 text-left group"
            data-testid="role-agent-btn"
          >
            <Factory className="w-10 h-10 text-burn mb-6" />
            <div className="overline mb-3 text-burn">B — MANUFACTURING AGENT</div>
            <h3 className="font-serif text-4xl leading-tight mb-4">I do end-to-end production.</h3>
            <p className="text-sm text-[--muted-foreground] leading-relaxed">Build your profile, receive RFQs from vetted founders, and land your next big client.</p>
          </button>
        </div>
      </div>
    </div>
  );
}
