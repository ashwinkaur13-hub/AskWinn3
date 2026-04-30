import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import { useAuth, API } from "@/context/AuthContext";
import axios from "axios";
import { Plus } from "lucide-react";

export default function MyRFQs() {
  const { user } = useAuth();
  const [rfqs, setRfqs] = useState([]);

  useEffect(() => {
    axios.get(`${API}/rfqs`).then((r) => setRfqs(r.data));
  }, []);

  const title = user.role === "buyer" ? "My RFQs" : user.role === "agent" ? "Open Briefs" : "All RFQs";

  return (
    <div className="min-h-screen bg-bone">
      <Navbar />
      <div className="max-w-[1400px] mx-auto px-6 lg:px-10 py-16">
        <div className="flex justify-between items-end mb-10 flex-wrap gap-4">
          <div>
            <div className="overline mb-3">§ RFQs</div>
            <h1 className="font-serif text-5xl lg:text-6xl font-light leading-none tracking-tight">{title}</h1>
          </div>
          {user.role === "buyer" && (
            <Link to="/rfqs/new" className="btn-primary" data-testid="new-rfq-btn">
              <Plus className="w-4 h-4" /> New RFQ
            </Link>
          )}
        </div>

        <div className="grid gap-4" data-testid="rfq-list">
          {rfqs.map((r, i) => (
            <Link key={r.rfq_id} to={`/rfqs/${r.rfq_id}`} className="editorial-card p-6 block" data-testid={`rfq-item-${r.rfq_id}`}>
              <div className="flex items-baseline justify-between gap-4 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="overline mb-2">Nº{String(i + 1).padStart(3, "0")}</div>
                  <div className="font-serif text-3xl leading-tight tracking-tight mb-2">{r.title}</div>
                  <div className="font-mono text-xs text-[--muted-foreground]">{r.category} · {r.target_region} · QTY {r.quantity} · ${r.budget_usd} · {r.timeline}</div>
                </div>
                <span className={`tag ${r.status === "open" ? "verified" : ""}`}>{r.status}</span>
              </div>
            </Link>
          ))}
          {rfqs.length === 0 && (
            <div className="editorial-card p-16 text-center">
              <div className="font-serif text-3xl mb-3">Nothing here yet.</div>
              {user.role === "buyer" && <Link to="/rfqs/new" className="btn-primary mt-4 inline-flex">Post your first RFQ</Link>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
