import React, { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import axios from "axios";
import { API } from "@/context/AuthContext";
import { toast } from "sonner";
import { CheckCircle2, XCircle } from "lucide-react";

export default function AdminDashboard() {
  const [agents, setAgents] = useState([]);
  const [stats, setStats] = useState(null);

  const load = async () => {
    const [a, s] = await Promise.all([
      axios.get(`${API}/admin/agents`),
      axios.get(`${API}/admin/stats`),
    ]);
    setAgents(a.data);
    setStats(s.data);
  };
  useEffect(() => { load(); }, []);

  const verify = async (id, v) => {
    try {
      await axios.post(`${API}/admin/agents/${id}/${v ? "verify" : "unverify"}`);
      toast.success(v ? "Verified" : "Unverified");
      load();
    } catch { toast.error("Failed"); }
  };

  return (
    <div className="min-h-screen bg-bone">
      <Navbar />
      <div className="max-w-[1400px] mx-auto px-6 lg:px-10 py-16">
        <div className="overline mb-3 text-burn">§ ADMIN</div>
        <h1 className="font-serif text-5xl lg:text-6xl font-light leading-none tracking-tight mb-10">Control Room.</h1>

        {stats && (
          <div className="grid md:grid-cols-5 gap-4 mb-12">
            {[["Users", stats.users], ["Agents", stats.agents], ["Verified", stats.verified_agents], ["RFQs", stats.rfqs], ["Quotes", stats.quotes]].map(([k, v]) => (
              <div key={k} className="editorial-card p-6">
                <div className="font-serif text-4xl tracking-tight">{v}</div>
                <div className="overline mt-2 text-[10px]">{k}</div>
              </div>
            ))}
          </div>
        )}

        <h2 className="font-serif text-3xl tracking-tight mb-6">Agents</h2>
        <div className="editorial-card overflow-hidden">
          <div className="grid grid-cols-12 gap-4 p-4 border-b border-[--border-soft] overline text-[10px]">
            <div className="col-span-4">Company</div>
            <div className="col-span-3">Categories</div>
            <div className="col-span-2">Regions</div>
            <div className="col-span-1">Status</div>
            <div className="col-span-2 text-right">Action</div>
          </div>
          {agents.map((a) => (
            <div key={a.agent_id} className="grid grid-cols-12 gap-4 p-4 border-b border-[--border-soft] items-center" data-testid={`admin-row-${a.agent_id}`}>
              <div className="col-span-4">
                <div className="font-serif text-xl leading-tight">{a.company_name}</div>
                <div className="font-mono text-[10px] text-[--muted-foreground]">{a.agent_id}</div>
              </div>
              <div className="col-span-3 flex flex-wrap gap-1">{(a.categories || []).slice(0, 3).map((c) => <span key={c} className="tag text-[10px]">{c}</span>)}</div>
              <div className="col-span-2 font-mono text-xs">{(a.regions || []).join(", ") || "—"}</div>
              <div className="col-span-1">{a.verified ? <span className="tag verified">ON</span> : <span className="tag">OFF</span>}</div>
              <div className="col-span-2 text-right">
                {a.verified ? (
                  <button onClick={() => verify(a.agent_id, false)} className="btn-outline text-xs py-2 px-3" data-testid={`unverify-${a.agent_id}`}>
                    <XCircle className="w-3 h-3" /> Unverify
                  </button>
                ) : (
                  <button onClick={() => verify(a.agent_id, true)} className="btn-primary text-xs py-2 px-3" data-testid={`verify-${a.agent_id}`}>
                    <CheckCircle2 className="w-3 h-3" /> Verify
                  </button>
                )}
              </div>
            </div>
          ))}
          {agents.length === 0 && <div className="p-10 text-center text-sm text-[--muted-foreground] font-mono">— No agents yet.</div>}
        </div>
      </div>
    </div>
  );
}
