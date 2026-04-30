import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import axios from "axios";
import { useAuth, API } from "@/context/AuthContext";
import { PlusCircle, FileText, MessageSquare, TrendingUp, Settings, DollarSign, Trophy, Users, Banknote, Activity } from "lucide-react";
import VendorBadges from "@/components/VendorBadges";

export default function Dashboard() {
  const { user } = useAuth();
  const [rfqs, setRfqs] = useState([]);
  const [threads, setThreads] = useState([]);
  const [stats, setStats] = useState(null);
  const [vmetrics, setVmetrics] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const [r, t] = await Promise.all([
          axios.get(`${API}/rfqs`),
          axios.get(`${API}/threads`),
        ]);
        setRfqs(r.data);
        setThreads(t.data);
        if (user.role === "admin") {
          const s = await axios.get(`${API}/admin/stats`);
          setStats(s.data);
        }
        if (user.role === "agent") {
          const m = await axios.get(`${API}/agents/me/metrics`);
          setVmetrics(m.data);
        }
      } catch {}
    })();
  }, [user]);

  const isBuyer = user.role === "buyer";
  const isAgent = user.role === "agent";
  const isAdmin = user.role === "admin";

  return (
    <div className="min-h-screen bg-bone">
      <Navbar />
      <div className="max-w-[1400px] mx-auto px-6 lg:px-10 py-16">
        <div className="mb-14 flex items-end justify-between flex-wrap gap-6">
          <div>
            <div className="overline mb-3">{user.role.toUpperCase()} DASHBOARD</div>
            <h1 className="font-serif text-5xl lg:text-6xl font-light leading-none tracking-tight">
              Welcome back, <em className="text-klein not-italic">{user.name?.split(" ")[0]}</em>.
            </h1>
          </div>
          {isAgent && vmetrics?.badges?.length > 0 && <VendorBadges badges={vmetrics.badges} size="lg" />}
        </div>

        {isAgent && vmetrics && (
          <div className="grid md:grid-cols-3 lg:grid-cols-6 gap-4 mb-12" data-testid="vendor-metrics">
            <Tile icon={Activity} label="RFQs received" value={vmetrics.rfqs_received} />
            <Tile icon={FileText} label="Active bids" value={vmetrics.active_bids} />
            <Tile icon={Trophy} label="Orders won" value={vmetrics.orders_won} />
            <Tile icon={Banknote} label="Earnings (USD)" value={`$${(vmetrics.earnings_usd || 0).toLocaleString()}`} />
            <Tile icon={DollarSign} label="Vendor score" value={`${vmetrics.vendor_score}/100`} highlight />
            <Tile icon={Users} label="Reviews" value={`${(vmetrics.rating || 0).toFixed(1)}★ (${vmetrics.reviews_count})`} />
          </div>
        )}

        {isBuyer && (
          <div className="grid md:grid-cols-3 gap-6 mb-12">
            <Link to="/rfqs/new" className="editorial-card p-8 block" data-testid="dash-new-rfq">
              <PlusCircle className="w-6 h-6 text-klein mb-5" />
              <div className="overline mb-2">ACTION</div>
              <div className="font-serif text-3xl leading-tight">Post an RFQ</div>
              <p className="text-sm text-[--muted-foreground] mt-3">Describe what you need. AI matches 3 agents.</p>
            </Link>
            <Link to="/directory" className="editorial-card p-8 block" data-testid="dash-browse">
              <FileText className="w-6 h-6 text-klein mb-5" />
              <div className="overline mb-2">BROWSE</div>
              <div className="font-serif text-3xl leading-tight">Agent directory</div>
              <p className="text-sm text-[--muted-foreground] mt-3">Filter by category, region, MOQ, rating.</p>
            </Link>
            <Link to="/messages" className="editorial-card p-8 block" data-testid="dash-messages">
              <MessageSquare className="w-6 h-6 text-klein mb-5" />
              <div className="overline mb-2">INBOX</div>
              <div className="font-serif text-3xl leading-tight">Messages</div>
              <p className="text-sm text-[--muted-foreground] mt-3">{threads.length} active conversation{threads.length === 1 ? "" : "s"}.</p>
            </Link>
          </div>
        )}

        {isAgent && (
          <div className="grid md:grid-cols-3 gap-6 mb-12">
            <Link to="/profile/edit" className="editorial-card p-8 block" data-testid="dash-profile">
              <Settings className="w-6 h-6 text-klein mb-5" />
              <div className="overline mb-2">PROFILE</div>
              <div className="font-serif text-3xl leading-tight">Edit profile & KYC</div>
              <p className="text-sm text-[--muted-foreground] mt-3">PAN, GST, factory tour, capabilities.</p>
            </Link>
            <Link to="/rfqs" className="editorial-card p-8 block" data-testid="dash-rfqs">
              <FileText className="w-6 h-6 text-klein mb-5" />
              <div className="overline mb-2">INCOMING</div>
              <div className="font-serif text-3xl leading-tight">Open RFQs</div>
              <p className="text-sm text-[--muted-foreground] mt-3">{rfqs.length} brief{rfqs.length === 1 ? "" : "s"} matched to you.</p>
            </Link>
            <Link to="/messages" className="editorial-card p-8 block" data-testid="dash-messages">
              <MessageSquare className="w-6 h-6 text-klein mb-5" />
              <div className="overline mb-2">INBOX</div>
              <div className="font-serif text-3xl leading-tight">Messages</div>
              <p className="text-sm text-[--muted-foreground] mt-3">{threads.length} thread{threads.length === 1 ? "" : "s"}.</p>
            </Link>
          </div>
        )}

        {isAdmin && stats && (
          <div className="grid md:grid-cols-5 gap-4 mb-12">
            {[["Users", stats.users], ["Agents", stats.agents], ["Verified", stats.verified_agents], ["RFQs", stats.rfqs], ["Quotes", stats.quotes]].map(([k, v]) => (
              <div key={k} className="editorial-card p-6">
                <TrendingUp className="w-5 h-5 text-klein mb-4" />
                <div className="font-serif text-4xl tracking-tight">{v}</div>
                <div className="overline mt-2 text-[10px]">{k}</div>
              </div>
            ))}
          </div>
        )}

        <div className="grid lg:grid-cols-2 gap-8">
          <section>
            <div className="flex items-baseline justify-between mb-6">
              <div>
                <div className="overline mb-2">§ RECENT</div>
                <h2 className="font-serif text-3xl tracking-tight">{isBuyer ? "Your RFQs" : isAgent ? "Open Briefs" : "All RFQs"}</h2>
              </div>
              <Link to="/rfqs" className="font-mono text-xs underline">ALL →</Link>
            </div>
            <div className="space-y-3">
              {rfqs.slice(0, 5).map((r) => (
                <Link key={r.rfq_id} to={`/rfqs/${r.rfq_id}`} className="editorial-card p-5 block" data-testid={`rfq-row-${r.rfq_id}`}>
                  <div className="flex justify-between items-baseline">
                    <div>
                      <div className="font-serif text-xl tracking-tight">{r.title}</div>
                      <div className="font-mono text-xs text-[--muted-foreground] mt-1">{r.category} · QTY {r.quantity} · ${r.budget_usd}</div>
                    </div>
                    <span className={`tag ${r.status === "open" ? "verified" : ""}`}>{r.status}</span>
                  </div>
                </Link>
              ))}
              {rfqs.length === 0 && <div className="text-sm text-[--muted-foreground] font-mono">— No RFQs yet.</div>}
            </div>
          </section>
          <section>
            <div className="flex items-baseline justify-between mb-6">
              <div>
                <div className="overline mb-2">§ INBOX</div>
                <h2 className="font-serif text-3xl tracking-tight">Messages</h2>
              </div>
              <Link to="/messages" className="font-mono text-xs underline">ALL →</Link>
            </div>
            <div className="space-y-3">
              {threads.slice(0, 5).map((t) => (
                <Link key={t.other.user_id} to={`/messages/${t.other.user_id}`} className="editorial-card p-5 block">
                  <div className="flex justify-between items-baseline">
                    <div className="font-serif text-xl tracking-tight">{t.other.name}</div>
                    <span className="font-mono text-xs text-[--muted-foreground]">{new Date(t.last.created_at).toLocaleDateString()}</span>
                  </div>
                  <div className="text-sm text-[--muted-foreground] mt-1 line-clamp-1">{t.last.body}</div>
                </Link>
              ))}
              {threads.length === 0 && <div className="text-sm text-[--muted-foreground] font-mono">— No conversations yet.</div>}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

const Tile = ({ icon: Icon, label, value, highlight }) => (
  <div className={`editorial-card p-5 ${highlight ? "border-l-4 border-l-klein" : ""}`}>
    <Icon className="w-4 h-4 text-klein mb-3" />
    <div className="font-serif text-2xl lg:text-3xl tracking-tight leading-none">{value}</div>
    <div className="overline mt-2 text-[9px]">{label}</div>
  </div>
);
