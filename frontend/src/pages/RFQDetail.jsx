import React, { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import { useAuth, API } from "@/context/AuthContext";
import axios from "axios";
import { toast } from "sonner";
import { Sparkles, MessageSquare, Gavel, Trophy, FileText, Download, Truck, X, Share2, Copy, Link2Off } from "lucide-react";
import VendorBadges from "@/components/VendorBadges";

export default function RFQDetail() {
  const { rfqId } = useParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const [data, setData] = useState(null);
  const [matches, setMatches] = useState(null);
  const [matching, setMatching] = useState(false);
  const [bidEval, setBidEval] = useState(null);
  const [evaluating, setEvaluating] = useState(false);
  const [accepting, setAccepting] = useState("");
  const [passing, setPassing] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState("");
  const [trackingUrl, setTrackingUrl] = useState("");
  const [shareToken, setShareToken] = useState(null);
  const [shareBusy, setShareBusy] = useState(false);
  const [quote, setQuote] = useState({ price_usd: "", lead_time_days: "", message: "", contact_number: "", sample_available: false, sample_cost_usd: 0 });

  const load = () => axios.get(`${API}/rfqs/${rfqId}`).then((r) => {
    setData(r.data);
    setShareToken(r.data?.rfq?.share_token || null);
  });
  useEffect(() => { load(); }, [rfqId]);

  if (!data) return <div className="min-h-screen bg-bone"><Navbar /><div className="p-20 text-center font-mono">Loading…</div></div>;
  const { rfq, quotes, buyer_name, buyer_anonymised } = data;

  const passRfq = async () => {
    if (!window.confirm("Pass on this RFQ? It will be removed from your incoming list.")) return;
    setPassing(true);
    try {
      await axios.post(`${API}/rfqs/${rfqId}/pass`);
      toast.success("Passed");
      nav("/rfqs");
    } catch (err) {
      toast.error("Failed");
    } finally { setPassing(false); }
  };

  const generateShare = async () => {
    setShareBusy(true);
    try {
      const r = await axios.post(`${API}/rfqs/${rfqId}/share`);
      setShareToken(r.data.share_token);
      const url = `${window.location.origin}/p/rfq/${r.data.share_token}`;
      try {
        await navigator.clipboard.writeText(url);
        toast.success("Public link copied to clipboard");
      } catch {
        toast.success("Public link generated");
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed");
    } finally { setShareBusy(false); }
  };

  const copyShare = async () => {
    if (!shareToken) return;
    const url = `${window.location.origin}/p/rfq/${shareToken}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied");
    } catch {
      toast.error("Could not copy");
    }
  };

  const revokeShare = async () => {
    if (!window.confirm("Revoke the public link? Anyone with the URL will lose access.")) return;
    setShareBusy(true);
    try {
      await axios.delete(`${API}/rfqs/${rfqId}/share`);
      setShareToken(null);
      toast.success("Public link revoked");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed");
    } finally { setShareBusy(false); }
  };

  const updateStatus = async (quoteId, nextStatus, tracking = "") => {
    setStatusUpdating(quoteId);
    try {
      await axios.post(`${API}/quotes/${quoteId}/status`, { status: nextStatus, tracking_url: tracking });
      toast.success(`Marked as ${nextStatus}`);
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed");
    } finally { setStatusUpdating(""); }
  };

  const runMatch = async () => {
    setMatching(true);
    try {
      const r = await axios.post(`${API}/rfqs/${rfqId}/match`);
      setMatches(r.data);
    } catch (err) {
      toast.error("Match failed");
    } finally { setMatching(false); }
  };

  const evaluateBids = async () => {
    setEvaluating(true);
    try {
      const r = await axios.post(`${API}/rfqs/${rfqId}/evaluate-bids`);
      setBidEval(r.data);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Evaluation failed");
    } finally { setEvaluating(false); }
  };

  const submitQuote = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/rfqs/${rfqId}/quotes`, {
        price_usd: Number(quote.price_usd),
        lead_time_days: Number(quote.lead_time_days),
        message: quote.message,
        contact_number: quote.contact_number,
      });
      toast.success("Quote submitted");
      setQuote({ price_usd: "", lead_time_days: "", message: "", contact_number: "" });
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed");
    }
  };

  const acceptQuote = async (quoteId) => {
    if (!window.confirm("Accept this quote and close the RFQ?")) return;
    setAccepting(quoteId);
    try {
      await axios.post(`${API}/rfqs/${rfqId}/accept`, { quote_id: quoteId });
      toast.success("Winner accepted. RFQ closed.");
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed");
    } finally { setAccepting(""); }
  };

  const isBuyer = user?.role === "buyer" && user?.user_id === rfq.buyer_id;
  const isAgent = user?.role === "agent";

  return (
    <div className="min-h-screen bg-bone">
      <Navbar />
      <div className="max-w-[1200px] mx-auto px-6 lg:px-10 py-16">
        <Link to="/rfqs" className="font-mono text-xs underline mb-8 block">← BACK</Link>
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <span className="tag">{rfq.category}</span>
          <span className="tag">{rfq.target_region}</span>
          <span className={`tag ${rfq.status === "open" ? "verified" : ""}`}>{rfq.status}</span>
        </div>
        <h1 className="font-serif text-5xl lg:text-6xl font-light leading-none tracking-tight mb-6">{rfq.title}</h1>
        <div className="font-mono text-xs text-[--muted-foreground] mb-4">FROM {buyer_name?.toUpperCase()}{buyer_anonymised ? " · IDENTITY HIDDEN UNTIL ACCEPT" : ""} · {new Date(rfq.created_at).toLocaleDateString()}</div>
        {isAgent && rfq.status === "open" && (
          <div className="mb-8">
            <button onClick={passRfq} disabled={passing} className="btn-outline text-xs" data-testid="pass-rfq-btn">
              <X className="w-3 h-3" /> Pass on this RFQ
            </button>
          </div>
        )}

        {isBuyer && (
          <div className="editorial-card p-6 mb-8" data-testid="rfq-share-panel">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-start gap-4">
                <Share2 className="w-5 h-5 text-klein mt-1" />
                <div>
                  <div className="overline mb-1">§ PUBLIC LINK</div>
                  <div className="font-serif text-2xl tracking-tight leading-tight">
                    {shareToken ? "Share this RFQ anywhere" : "Generate a shareable link"}
                  </div>
                  <p className="text-sm text-[--muted-foreground] mt-1 max-w-md">
                    {shareToken
                      ? "A read-only public link. Buyer identity, attachments, and bidder info stay hidden."
                      : "Post on LinkedIn, WhatsApp, email — anyone can read the brief without signing in."}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {shareToken ? (
                  <>
                    <button onClick={copyShare} className="btn-primary text-xs" data-testid="copy-share-link">
                      <Copy className="w-3 h-3" /> Copy link
                    </button>
                    <button onClick={revokeShare} disabled={shareBusy} className="btn-outline text-xs" data-testid="revoke-share-link">
                      <Link2Off className="w-3 h-3" /> Revoke
                    </button>
                  </>
                ) : (
                  <button onClick={generateShare} disabled={shareBusy} className="btn-primary text-xs" data-testid="generate-share-link">
                    <Share2 className="w-3 h-3" /> {shareBusy ? "Generating…" : "Generate link"}
                  </button>
                )}
              </div>
            </div>
            {shareToken && (
              <div className="mt-4 pt-4 border-t border-[--border-soft] font-mono text-xs text-[--muted-foreground] break-all" data-testid="share-link-text">
                {`${window.location.origin}/p/rfq/${shareToken}`}
              </div>
            )}
          </div>
        )}

        <div className="grid md:grid-cols-3 gap-6 mb-12">
          <Stat l="Quantity" v={rfq.quantity} />
          <Stat l="Budget" v={`$${rfq.budget_usd}`} />
          <Stat l="Timeline" v={rfq.timeline} />
        </div>

        <div className="editorial-card p-8 mb-12">
          <div className="overline mb-4">§ BRIEF</div>
          <p className="text-base leading-relaxed whitespace-pre-wrap">{rfq.description}</p>
        </div>

        {rfq.requirements && Object.keys(rfq.requirements).length > 0 && (
          <div className="editorial-card p-8 mb-12" data-testid="rfq-requirements">
            <div className="overline mb-5">§ STRUCTURED REQUIREMENTS</div>
            <div className="grid sm:grid-cols-2 gap-x-10 gap-y-4">
              {Object.entries(rfq.requirements).filter(([, v]) => v && (Array.isArray(v) ? v.length : true)).map(([k, v]) => (
                <div key={k}>
                  <div className="overline text-[10px] mb-1">{k.replace(/_/g, " ")}</div>
                  <div className="text-base">
                    {Array.isArray(v) ? v.join(", ") : String(v)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {(rfq.attachments || []).length > 0 && (
          <div className="editorial-card p-8 mb-12" data-testid="rfq-attachments">
            <div className="overline mb-5">§ ATTACHMENTS ({rfq.attachments.length})</div>
            <div className="space-y-2">
              {rfq.attachments.map((a) => (
                <a
                  key={a.file_id}
                  href={`${API}/rfqs/${rfq.rfq_id}/attachments/${a.file_id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between p-4 border border-[--border-soft] hover:border-ink transition-colors"
                  data-testid={`attachment-link-${a.file_id}`}
                >
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-klein" />
                    <div>
                      <div className="font-serif text-lg leading-tight">{a.filename}</div>
                      <div className="font-mono text-[10px] text-[--muted-foreground]">{(a.size / 1024).toFixed(0)} KB · {a.content_type}</div>
                    </div>
                  </div>
                  <Download className="w-4 h-4" />
                </a>
              ))}
            </div>
          </div>
        )}

        {isBuyer && (
          <section className="mb-12">
            <div className="flex justify-between items-center mb-6">
              <div>
                <div className="overline mb-2">AI MATCH</div>
                <h2 className="font-serif text-3xl tracking-tight">Let Claude find your fit.</h2>
              </div>
              <button onClick={runMatch} disabled={matching} className="btn-accent" data-testid="run-match-btn">
                <Sparkles className="w-4 h-4" /> {matching ? "Matching…" : "Run AI match"}
              </button>
            </div>
            {matches && (
              <div className="grid md:grid-cols-3 gap-4" data-testid="ai-matches">
                {(matches.matches || []).map((m) => (
                  <div key={m.agent_id} className="editorial-card p-6">
                    <div className="tag accent mb-4">AI PICK</div>
                    <div className="font-serif text-2xl mb-2">{m.agent?.company_name || m.agent_id}</div>
                    <p className="text-sm text-[--muted-foreground] mb-4">{m.reason}</p>
                    {m.agent && (
                      <Link to={`/agents/${m.agent_id}`} className="font-mono text-xs underline">VIEW PROFILE →</Link>
                    )}
                  </div>
                ))}
                {(matches.matches || []).length === 0 && <div className="text-sm text-[--muted-foreground] font-mono">No matches.</div>}
              </div>
            )}
          </section>
        )}

        <section className="mb-12">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <div className="overline">§ QUOTES ({quotes.length})</div>
            {isBuyer && quotes.length > 0 && (
              <button onClick={evaluateBids} disabled={evaluating} className="btn-primary text-xs py-2 px-4" data-testid="evaluate-bids-btn">
                <Gavel className="w-3.5 h-3.5" /> {evaluating ? "Evaluating…" : "Evaluate bids with AI"}
              </button>
            )}
          </div>

          {bidEval && (
            <div className="editorial-card p-6 mb-6 border-l-4 border-l-klein" data-testid="bid-eval-results">
              <div className="flex items-center gap-2 mb-3">
                <Trophy className="w-5 h-5 text-klein" />
                <div className="overline">AI VERDICT · {bidEval.provider || "heuristic"}{bidEval.model ? ` · ${bidEval.model}` : ""}</div>
              </div>
              <p className="text-base leading-relaxed mb-5">{bidEval.summary}</p>
              <div className="space-y-3">
                {(bidEval.ranked || []).map((r, i) => (
                  <div key={r.quote_id} className={`p-4 border ${r.quote_id === bidEval.winner_quote_id ? "border-klein bg-klein/5" : "border-[--border-soft]"}`} data-testid={`bid-rank-${i}`}>
                    <div className="flex items-baseline justify-between mb-2 flex-wrap gap-2">
                      <div className="flex items-center gap-3">
                        <span className="font-serif text-3xl tracking-tight">#{i + 1}</span>
                        <span className="font-serif text-xl">{r.agent?.company_name || r.quote_id}</span>
                        {r.quote_id === bidEval.winner_quote_id && <span className="tag verified">WINNER</span>}
                      </div>
                      <div className="flex items-center gap-3 font-mono text-xs">
                        <span>SCORE {r.score}</span>
                        <span className={`tag ${r.verdict === "strong" ? "verified" : r.verdict === "weak" ? "accent" : ""}`}>{r.verdict}</span>
                      </div>
                    </div>
                    <p className="text-sm text-[--muted-foreground] mb-2">{r.reason}</p>
                    {(r.pros?.length > 0 || r.cons?.length > 0) && (
                      <div className="grid sm:grid-cols-2 gap-3 mt-2 text-xs">
                        <div><span className="overline text-[10px]">+ PROS</span><ul className="mt-1 space-y-0.5">{(r.pros || []).map((p, j) => <li key={j}>· {p}</li>)}</ul></div>
                        <div><span className="overline text-[10px] text-burn">− CONS</span><ul className="mt-1 space-y-0.5">{(r.cons || []).map((p, j) => <li key={j}>· {p}</li>)}</ul></div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {bidEval.error && <div className="mt-4 font-mono text-[10px] text-[--muted-foreground]">fallback: {bidEval.error}</div>}
            </div>
          )}

          <div className="space-y-4">
            {quotes.map((q) => {
              const isWinner = q.status === "won" || rfq.winner_quote_id === q.quote_id || ["confirmed","packed","dispatched","delivered"].includes(q.status);
              const notSelected = q.status === "not_selected";
              const mine = user?.user_id === q.agent_user_id;
              const STATUS_FLOW = ["won", "confirmed", "packed", "dispatched", "delivered"];
              const idx = STATUS_FLOW.indexOf(q.status);
              const inFulfilment = idx >= 0;
              return (
                <div key={q.quote_id} className={`editorial-card p-6 ${isWinner ? "border-l-4 border-l-klein bg-klein/5" : notSelected ? "opacity-60" : ""}`} data-testid={`quote-${q.quote_id}`}>
                  <div className="flex justify-between items-baseline flex-wrap gap-3 mb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      {q.agent?.company_name === "Anonymous bidder" ? (
                        <span className="font-serif text-2xl leading-tight italic text-[--muted-foreground]">Anonymous bidder</span>
                      ) : (
                        <Link to={`/agents/${q.agent_id}`} className="font-serif text-2xl leading-tight">{q.agent?.company_name || "Agent"}</Link>
                      )}
                      <VendorBadges badges={q.agent?.badges || []} />
                      {isWinner && <span className="tag verified flex items-center gap-1"><Trophy className="w-3 h-3" />WINNER</span>}
                      {notSelected && <span className="tag">NOT SELECTED</span>}
                      {mine && isWinner && <span className="tag accent">YOU WON 🏆</span>}
                    </div>
                    <div className="font-mono text-xs text-[--muted-foreground]">{new Date(q.created_at).toLocaleDateString()}</div>
                  </div>
                  <div className="flex gap-6 mb-4 flex-wrap">
                    <div><div className="overline">Price</div><div className="font-serif text-2xl">${q.price_usd}</div></div>
                    <div><div className="overline">Lead time</div><div className="font-serif text-2xl">{q.lead_time_days}d</div></div>
                    {q.sample_available && (
                      <div><div className="overline">Sample</div><div className="font-serif text-2xl">${q.sample_cost_usd || 0}</div></div>
                    )}
                    {q.contact_number && (
                      <div><div className="overline">Contact</div><div className="font-serif text-2xl">{q.contact_number}</div></div>
                    )}
                  </div>
                  {q.message && <p className="text-sm whitespace-pre-wrap mb-4">{q.message}</p>}

                  {inFulfilment && (
                    <div className="mb-4 p-4 bg-bone border border-[--border-soft]" data-testid={`status-flow-${q.quote_id}`}>
                      <div className="overline mb-3 flex items-center gap-2"><Truck className="w-3 h-3" /> ORDER STATUS</div>
                      <div className="flex items-center gap-1">
                        {STATUS_FLOW.map((s, i) => (
                          <React.Fragment key={s}>
                            <div className={`flex-1 text-center py-2 px-1 font-mono text-[10px] uppercase tracking-wider ${i <= idx ? "bg-klein text-white" : "bg-[--muted] text-[--muted-foreground]"}`}>{s}</div>
                            {i < STATUS_FLOW.length - 1 && <div className={`w-1 h-1 ${i < idx ? "bg-klein" : "bg-[--border-soft]"}`}></div>}
                          </React.Fragment>
                        ))}
                      </div>
                      {q.tracking_url && (
                        <a href={q.tracking_url} target="_blank" rel="noreferrer" className="font-mono text-[10px] underline mt-3 inline-block">TRACK SHIPMENT →</a>
                      )}
                    </div>
                  )}

                  <div className="flex gap-2 flex-wrap">
                    {user && user.user_id !== q.agent_user_id && q.agent_user_id !== "hidden" && (
                      <button onClick={() => nav(`/messages/${q.agent_user_id}`)} className="btn-outline text-xs" data-testid={`quote-chat-${q.quote_id}`}>
                        <MessageSquare className="w-3 h-3" /> Message
                      </button>
                    )}
                    {isBuyer && rfq.status === "open" && (
                      <button onClick={() => acceptQuote(q.quote_id)} disabled={accepting === q.quote_id} className="btn-primary text-xs" data-testid={`accept-quote-${q.quote_id}`}>
                        <Trophy className="w-3 h-3" /> {accepting === q.quote_id ? "Accepting…" : "Accept & close RFQ"}
                      </button>
                    )}
                    {/* Agent (winner) status update buttons */}
                    {isAgent && mine && q.status === "won" && (
                      <button onClick={() => updateStatus(q.quote_id, "confirmed")} disabled={statusUpdating === q.quote_id} className="btn-primary text-xs" data-testid={`mark-confirmed-${q.quote_id}`}>Mark confirmed</button>
                    )}
                    {isAgent && mine && q.status === "confirmed" && (
                      <button onClick={() => updateStatus(q.quote_id, "packed")} disabled={statusUpdating === q.quote_id} className="btn-primary text-xs" data-testid={`mark-packed-${q.quote_id}`}>Mark packed</button>
                    )}
                    {isAgent && mine && q.status === "packed" && (
                      <div className="flex gap-2 items-center flex-wrap">
                        <input type="url" placeholder="Tracking URL (optional)" className="input-underline text-xs px-3 py-2 border" value={trackingUrl} onChange={(e) => setTrackingUrl(e.target.value)} data-testid={`tracking-input-${q.quote_id}`} />
                        <button onClick={() => updateStatus(q.quote_id, "dispatched", trackingUrl)} disabled={statusUpdating === q.quote_id} className="btn-primary text-xs" data-testid={`mark-dispatched-${q.quote_id}`}>Mark dispatched</button>
                      </div>
                    )}
                    {/* Buyer marks delivered */}
                    {isBuyer && q.status === "dispatched" && (
                      <button onClick={() => updateStatus(q.quote_id, "delivered")} disabled={statusUpdating === q.quote_id} className="btn-accent text-xs" data-testid={`mark-delivered-${q.quote_id}`}>
                        <Truck className="w-3 h-3" /> Confirm delivery
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            {quotes.length === 0 && <div className="text-sm text-[--muted-foreground] font-mono">— No quotes yet.</div>}
          </div>
        </section>

        {isAgent && rfq.status === "open" && (
          <form onSubmit={submitQuote} className="editorial-card p-8" data-testid="quote-form">
            <div className="overline mb-4">SUBMIT A QUOTE</div>
            <div className="grid md:grid-cols-2 gap-6 mb-6">
              <div>
                <div className="overline mb-1">Price (USD)</div>
                <input type="number" required className="input-underline" value={quote.price_usd} onChange={(e) => setQuote({ ...quote, price_usd: e.target.value })} data-testid="quote-price" />
              </div>
              <div>
                <div className="overline mb-1">Lead time (days)</div>
                <input type="number" required className="input-underline" value={quote.lead_time_days} onChange={(e) => setQuote({ ...quote, lead_time_days: e.target.value })} data-testid="quote-lead" />
              </div>
              <div className="md:col-span-2">
                <div className="overline mb-1">Contact number (WhatsApp / phone) — optional</div>
                <input type="tel" className="input-underline" value={quote.contact_number} onChange={(e) => setQuote({ ...quote, contact_number: e.target.value })} placeholder="+1 555 123 4567" data-testid="quote-contact" />
              </div>
              <div className="md:col-span-2 grid grid-cols-2 gap-6">
                <label className="flex items-center gap-3 cursor-pointer pt-6">
                  <input type="checkbox" checked={!!quote.sample_available} onChange={(e) => setQuote({ ...quote, sample_available: e.target.checked })} data-testid="quote-sample-toggle" />
                  <span className="text-sm">I can ship a sample</span>
                </label>
                {quote.sample_available && (
                  <div>
                    <div className="overline mb-1">Sample cost (USD)</div>
                    <input type="number" min="0" className="input-underline" value={quote.sample_cost_usd} onChange={(e) => setQuote({ ...quote, sample_cost_usd: e.target.value })} data-testid="quote-sample-cost" />
                  </div>
                )}
              </div>
            </div>
            <div className="mb-6">
              <div className="overline mb-1">Message</div>
              <textarea required className="input-underline min-h-[100px]" value={quote.message} onChange={(e) => setQuote({ ...quote, message: e.target.value })} data-testid="quote-message" placeholder="Approach, capabilities, why you're a fit…" />
            </div>
            <button type="submit" className="btn-primary" data-testid="quote-submit">Submit quote</button>
          </form>
        )}
        {isAgent && rfq.status === "closed" && (
          <div className="editorial-card p-8 border-l-4 border-l-klein">
            <div className="overline mb-2">§ CLOSED</div>
            <p className="text-sm">This RFQ has been closed by the buyer. Check the quotes above to see the outcome.</p>
          </div>
        )}
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
