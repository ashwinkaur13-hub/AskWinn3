import React, { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import axios from "axios";
import { useAuth, API } from "@/context/AuthContext";
import { CheckCircle2, MapPin, Star, MessageSquare, Award, Building2 } from "lucide-react";
import { toast } from "sonner";
import VendorBadges from "@/components/VendorBadges";
import FavouriteButton from "@/components/FavouriteButton";

export default function AgentDetail() {
  const { agentId } = useParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const [data, setData] = useState(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");

  useEffect(() => {
    axios.get(`${API}/agents/${agentId}`).then((r) => setData(r.data));
  }, [agentId]);

  if (!data) return <div className="min-h-screen bg-bone"><Navbar /><div className="p-20 text-center font-mono">Loading…</div></div>;
  const { agent, reviews } = data;

  const submitReview = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/agents/${agentId}/reviews`, { rating: Number(rating), comment });
      toast.success("Review posted");
      setComment("");
      const r = await axios.get(`${API}/agents/${agentId}`);
      setData(r.data);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed");
    }
  };

  const startChat = () => {
    if (!user) return nav("/");
    nav(`/messages/${agent.user_id}`);
  };

  return (
    <div className="min-h-screen bg-bone">
      <Navbar />
      <div className="max-w-[1400px] mx-auto px-6 lg:px-10 py-16">
        <Link to="/directory" className="font-mono text-xs underline mb-8 block">← BACK TO DIRECTORY</Link>

        <div className="grid lg:grid-cols-12 gap-10 mb-16">
          <div className="lg:col-span-8">
            <div className="flex items-center gap-3 mb-6 flex-wrap">
              {agent.verified && <div className="tag verified flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />Verified</div>}
              {(agent.regions || []).map((r) => <span key={r} className="tag flex items-center gap-1"><MapPin className="w-3 h-3" />{r}</span>)}
            </div>
            <h1 className="font-serif text-6xl lg:text-7xl font-light leading-none tracking-tight mb-6">{agent.company_name}</h1>
            <p className="text-xl text-[--muted-foreground] mb-10 leading-relaxed max-w-2xl">{agent.tagline}</p>
            <div className="flex items-center gap-8 mb-10 flex-wrap">
              <div>
                <div className="font-serif text-4xl">{(agent.rating || 0).toFixed(1)}<span className="text-klein">★</span></div>
                <div className="overline mt-1">{agent.reviews_count || 0} REVIEWS</div>
              </div>
              <div>
                <div className="font-serif text-4xl">{agent.min_order_qty || 0}</div>
                <div className="overline mt-1">MIN ORDER QTY</div>
              </div>
              {agent.years_in_operation > 0 && (
                <div>
                  <div className="font-serif text-4xl">{agent.years_in_operation}</div>
                  <div className="overline mt-1">YRS IN OPERATION</div>
                </div>
              )}
              {agent.vendor_score > 0 && (
                <div>
                  <div className="font-serif text-4xl">{agent.vendor_score}<span className="text-klein text-xl">/100</span></div>
                  <div className="overline mt-1">VENDOR SCORE</div>
                </div>
              )}
            </div>
            {(agent.factory_city || agent.factory_state) && (
              <div className="font-mono text-xs text-[--muted-foreground] mb-6 flex items-center gap-2"><Building2 className="w-3 h-3" /> FACTORY · {[agent.factory_city, agent.factory_state].filter(Boolean).join(", ").toUpperCase()}</div>
            )}
            {user && user.user_id !== agent.user_id && (
              <div className="flex items-center gap-3 flex-wrap">
                <button onClick={startChat} className="btn-primary" data-testid="agent-chat-btn">
                  <MessageSquare className="w-4 h-4" /> Start a conversation
                </button>
                <FavouriteButton agentId={agent.agent_id} size="lg" />
              </div>
            )}
          </div>
          <div className="lg:col-span-4">
            <div className="editorial-card p-6">
              <div className="overline mb-4">ABOUT</div>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{agent.bio || "No bio provided yet."}</p>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-10 mb-16">
          <section>
            <div className="overline mb-4">§ SERVICES</div>
            <div className="flex flex-wrap gap-2">
              {(agent.services || []).map((s) => <span key={s} className="tag">{s}</span>)}
              {(agent.services || []).length === 0 && <span className="text-sm text-[--muted-foreground] font-mono">—</span>}
            </div>
          </section>
          <section>
            <div className="overline mb-4">§ CATEGORIES</div>
            <div className="flex flex-wrap gap-2">
              {(agent.categories || []).map((s) => <span key={s} className="tag">{s}</span>)}
              {(agent.categories || []).length === 0 && <span className="text-sm text-[--muted-foreground] font-mono">—</span>}
            </div>
          </section>
          <section>
            <div className="overline mb-4">§ CERTIFICATIONS</div>
            <div className="space-y-2">
              {(agent.certifications || []).map((c) => (
                <div key={c} className="flex items-center gap-2"><Award className="w-4 h-4 text-klein" /><span className="text-sm">{c}</span></div>
              ))}
              {(agent.certifications || []).length === 0 && <span className="text-sm text-[--muted-foreground] font-mono">—</span>}
            </div>
          </section>
        </div>

        {(agent.portfolio_images || []).length > 0 && (
          <section className="mb-16">
            <div className="overline mb-4">§ PORTFOLIO</div>
            <div className="grid md:grid-cols-3 gap-4">
              {agent.portfolio_images.map((url, i) => (
                <div key={i} className="aspect-square overflow-hidden border border-[--border-soft]">
                  <img src={url} alt="" className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="mb-16">
          <div className="overline mb-4">§ REVIEWS</div>
          <div className="space-y-4 mb-10">
            {reviews.map((r) => (
              <div key={r.review_id} className="editorial-card p-6">
                <div className="flex justify-between items-baseline mb-2">
                  <div className="font-serif text-xl">{r.buyer_name}</div>
                  <div className="flex items-center gap-0.5 text-klein">
                    {Array.from({ length: r.rating }).map((_, i) => <Star key={i} className="w-3 h-3 fill-current" />)}
                  </div>
                </div>
                <div className="font-mono text-xs text-[--muted-foreground] mb-3">{new Date(r.created_at).toLocaleDateString()}</div>
                <p className="text-sm leading-relaxed">{r.comment}</p>
              </div>
            ))}
            {reviews.length === 0 && <div className="text-sm text-[--muted-foreground] font-mono">— No reviews yet.</div>}
          </div>

          {user?.role === "buyer" && (
            <form onSubmit={submitReview} className="editorial-card p-8" data-testid="review-form">
              <div className="overline mb-4">LEAVE A REVIEW</div>
              <div className="mb-4">
                <label className="overline mb-2 block">Rating</label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button type="button" key={n} onClick={() => setRating(n)} data-testid={`star-${n}`}>
                      <Star className={`w-7 h-7 ${n <= rating ? "fill-klein text-klein" : "text-[--border-soft]"}`} />
                    </button>
                  ))}
                </div>
              </div>
              <textarea
                className="input-underline min-h-[100px]"
                placeholder="What was it like working with them?"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                required
                data-testid="review-comment"
              />
              <button type="submit" className="btn-primary mt-6" data-testid="review-submit">Post review</button>
            </form>
          )}
        </section>
      </div>
      <Footer />
    </div>
  );
}
