import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import AgentCard from "@/components/AgentCard";
import axios from "axios";
import { API } from "@/context/AuthContext";
import { Bookmark } from "lucide-react";

export default function Favourites() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const r = await axios.get(`${API}/favourites`);
      setItems(r.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="min-h-screen bg-bone">
      <Navbar />
      <div className="max-w-[1400px] mx-auto px-6 lg:px-10 py-16">
        <div className="overline mb-4 flex items-center gap-2">
          <Bookmark className="w-3 h-3" /> § SAVED
        </div>
        <h1 className="font-serif text-5xl lg:text-7xl font-light leading-none tracking-tight mb-3">
          Your <em className="text-klein not-italic">shortlist</em>.
        </h1>
        <p className="text-base text-[--muted-foreground] max-w-xl mb-10">
          Agents you've bookmarked for future projects. Tap any to revisit, message, or kick off an RFQ.
        </p>

        {loading ? (
          <div className="font-mono text-xs text-[--muted-foreground]">LOADING…</div>
        ) : items.length === 0 ? (
          <div className="editorial-card p-16 text-center" data-testid="favourites-empty">
            <div className="font-serif text-3xl mb-3">No saved agents yet.</div>
            <p className="text-sm text-[--muted-foreground] mb-6">
              Browse the directory and tap the bookmark to save anyone who looks like a fit.
            </p>
            <Link to="/directory" className="btn-primary inline-flex" data-testid="favourites-browse-link">
              Open the directory
            </Link>
          </div>
        ) : (
          <>
            <div className="font-mono text-xs text-[--muted-foreground] mb-6">
              {items.length} SAVED AGENT{items.length === 1 ? "" : "S"}
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6" data-testid="favourites-grid">
              {items.map((it, i) => (
                <AgentCard key={it.agent.agent_id} agent={it.agent} index={i} />
              ))}
            </div>
          </>
        )}
      </div>
      <Footer />
    </div>
  );
}
