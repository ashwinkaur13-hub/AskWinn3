import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import AgentCard from "@/components/AgentCard";
import axios from "axios";
import { API } from "@/context/AuthContext";
import { Search } from "lucide-react";

const CATEGORIES = ["Textile & Apparel", "Consumer Electronics", "Packaging", "Home Goods", "Beauty & Cosmetics", "Food & Beverage", "Hardware", "Toys & Games"];
const REGIONS = ["China", "India", "Vietnam", "Turkey", "Mexico", "Portugal", "Italy", "USA"];

export default function Directory() {
  const [params, setParams] = useSearchParams();
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const category = params.get("category") || "";
  const region = params.get("region") || "";
  const verified = params.get("verified") === "true";

  useEffect(() => {
    setLoading(true);
    const q = new URLSearchParams();
    if (category) q.set("category", category);
    if (region) q.set("region", region);
    if (verified) q.set("verified", "true");
    if (search) q.set("search", search);
    axios.get(`${API}/agents?${q.toString()}`).then((r) => {
      setAgents(r.data);
      setLoading(false);
    });
  }, [category, region, verified, search]);

  const setParam = (k, v) => {
    const p = new URLSearchParams(params);
    if (v) p.set(k, v); else p.delete(k);
    setParams(p);
  };

  return (
    <div className="min-h-screen bg-bone">
      <Navbar />
      <div className="max-w-[1400px] mx-auto px-6 lg:px-10 py-16">
        <div className="overline mb-4">§ DIRECTORY</div>
        <h1 className="font-serif text-5xl lg:text-7xl font-light leading-none tracking-tight mb-10">
          Every agent, <em className="text-klein not-italic">on record</em>.
        </h1>

        <div className="editorial-card p-6 mb-10">
          <div className="flex items-center gap-3 mb-6">
            <Search className="w-4 h-4 text-[--muted-foreground]" />
            <input
              type="text"
              placeholder="SEARCH AGENTS, CAPABILITIES, MATERIALS…"
              className="input-underline font-mono text-sm uppercase tracking-[0.12em]"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              data-testid="directory-search"
            />
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            <div>
              <div className="overline mb-3">CATEGORY</div>
              <div className="flex flex-wrap gap-2">
                <FilterChip active={!category} onClick={() => setParam("category", "")} label="All" />
                {CATEGORIES.map((c) => (
                  <FilterChip key={c} active={category === c} onClick={() => setParam("category", c)} label={c} />
                ))}
              </div>
            </div>
            <div>
              <div className="overline mb-3">REGION</div>
              <div className="flex flex-wrap gap-2">
                <FilterChip active={!region} onClick={() => setParam("region", "")} label="All" />
                {REGIONS.map((r) => (
                  <FilterChip key={r} active={region === r} onClick={() => setParam("region", r)} label={r} />
                ))}
              </div>
            </div>
            <div>
              <div className="overline mb-3">STATUS</div>
              <div className="flex flex-wrap gap-2">
                <FilterChip active={!verified} onClick={() => setParam("verified", "")} label="All" />
                <FilterChip active={verified} onClick={() => setParam("verified", "true")} label="Verified only" />
              </div>
            </div>
          </div>
        </div>

        <div className="font-mono text-xs text-[--muted-foreground] mb-6">{loading ? "LOADING…" : `${agents.length} AGENT${agents.length === 1 ? "" : "S"} FOUND`}</div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6" data-testid="directory-grid">
          {agents.map((a, i) => <AgentCard key={a.agent_id} agent={a} index={i} />)}
        </div>
        {!loading && agents.length === 0 && (
          <div className="editorial-card p-16 text-center">
            <div className="font-serif text-3xl mb-3">No matches yet.</div>
            <p className="text-sm text-[--muted-foreground]">Loosen your filters — or post an RFQ and let AI find the fit.</p>
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}

const FilterChip = ({ active, onClick, label }) => (
  <button
    onClick={onClick}
    className={`tag ${active ? "verified" : ""} cursor-pointer transition-colors`}
    style={active ? {} : { opacity: 0.8 }}
    data-testid={`filter-${label.toLowerCase().replace(/\s+/g, "-")}`}
  >
    {label}
  </button>
);
