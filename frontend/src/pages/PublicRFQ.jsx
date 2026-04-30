import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import axios from "axios";
import { API } from "@/context/AuthContext";
import { ArrowRight, Lock, FileText } from "lucide-react";

export default function PublicRFQ() {
  const { token } = useParams();
  const [rfq, setRfq] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    axios.get(`${API}/public/rfqs/${token}`)
      .then((r) => setRfq(r.data))
      .catch((e) => setError(e.response?.data?.detail || "Link is invalid or has been revoked"));
  }, [token]);

  if (error) {
    return (
      <div className="min-h-screen bg-bone flex items-center justify-center px-6">
        <div className="editorial-card p-12 max-w-lg text-center" data-testid="public-rfq-error">
          <Lock className="w-8 h-8 text-burn mx-auto mb-4" />
          <div className="overline mb-3">§ NOT AVAILABLE</div>
          <div className="font-serif text-3xl mb-3">{error}</div>
          <p className="text-sm text-[--muted-foreground] mb-6">
            The buyer may have revoked this link, or the RFQ has been removed.
          </p>
          <Link to="/" className="btn-primary inline-flex">Back to AskWinn</Link>
        </div>
      </div>
    );
  }

  if (!rfq) {
    return <div className="min-h-screen bg-bone p-20 text-center font-mono text-sm">Loading…</div>;
  }

  return (
    <div className="min-h-screen bg-bone">
      <header className="border-b border-[--border-soft] bg-bone/80 backdrop-blur-xl">
        <div className="max-w-[1100px] mx-auto px-6 lg:px-10 h-20 flex items-center justify-between">
          <Link to="/" className="font-serif text-2xl font-medium tracking-tighter">
            Ask<span className="text-klein">Winn</span>.
          </Link>
          <Link to="/login" className="btn-primary text-xs" data-testid="public-rfq-cta">
            Bid on this RFQ <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </header>

      <div className="max-w-[1100px] mx-auto px-6 lg:px-10 py-16" data-testid="public-rfq-view">
        <div className="overline mb-3">§ PUBLIC RFQ · READ-ONLY</div>
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <span className="tag">{rfq.category}</span>
          <span className="tag">{rfq.target_region}</span>
          <span className={`tag ${rfq.status === "open" ? "verified" : ""}`}>{rfq.status}</span>
        </div>
        <h1 className="font-serif text-5xl lg:text-7xl font-light leading-none tracking-tight mb-6">
          {rfq.title}
        </h1>
        <div className="font-mono text-xs text-[--muted-foreground] mb-10">
          POSTED {rfq.created_at ? new Date(rfq.created_at).toLocaleDateString() : "—"} · IDENTITY HIDDEN · {rfq.quote_count} BID{rfq.quote_count === 1 ? "" : "S"} SO FAR
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-12">
          <Stat l="Quantity" v={rfq.quantity} />
          <Stat l="Budget" v={`$${rfq.budget_usd}`} />
          <Stat l="Timeline" v={rfq.timeline} />
        </div>

        <div className="editorial-card p-8 mb-10">
          <div className="overline mb-4">§ BRIEF</div>
          <p className="text-base leading-relaxed whitespace-pre-wrap">{rfq.description}</p>
        </div>

        {rfq.requirements && Object.keys(rfq.requirements).length > 0 && (
          <div className="editorial-card p-8 mb-10" data-testid="public-rfq-requirements">
            <div className="overline mb-5">§ STRUCTURED REQUIREMENTS</div>
            <div className="grid sm:grid-cols-2 gap-x-10 gap-y-4">
              {Object.entries(rfq.requirements)
                .filter(([, v]) => v && (Array.isArray(v) ? v.length : true))
                .map(([k, v]) => (
                  <div key={k}>
                    <div className="overline text-[10px] mb-1">{k.replace(/_/g, " ")}</div>
                    <div className="text-base">{Array.isArray(v) ? v.join(", ") : String(v)}</div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {rfq.attachment_count > 0 && (
          <div className="editorial-card p-8 mb-10 flex items-center gap-4">
            <FileText className="w-6 h-6 text-klein" />
            <div>
              <div className="font-serif text-2xl">{rfq.attachment_count} attachment{rfq.attachment_count === 1 ? "" : "s"} available</div>
              <p className="text-sm text-[--muted-foreground] mt-1">Sign in as a verified agent to view & download.</p>
            </div>
          </div>
        )}

        <div className="editorial-card p-10 border-l-4 border-l-klein bg-klein/5 text-center">
          <div className="overline mb-3">READY TO BID?</div>
          <h2 className="font-serif text-4xl mb-3">Submit your quote in 90 seconds.</h2>
          <p className="text-sm text-[--muted-foreground] mb-6 max-w-md mx-auto">
            Sign in (or join AskWinn as a service provider) to see the buyer, attachments, and competing bid count.
          </p>
          <Link to="/login" className="btn-primary inline-flex" data-testid="public-rfq-bid-cta">
            Bid on this RFQ <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}

const Stat = ({ l, v }) => (
  <div className="editorial-card p-6">
    <div className="overline mb-2">{l}</div>
    <div className="font-serif text-3xl tracking-tight">{v}</div>
  </div>
);
