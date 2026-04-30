import React from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Star, MapPin } from "lucide-react";

export default function AgentCard({ agent, index = 0 }) {
  const delay = Math.min(index, 5) * 80;
  return (
    <Link
      to={`/agents/${agent.agent_id}`}
      className="editorial-card p-6 block group"
      style={{ animation: `reveal 0.6s ease-out ${delay}ms both` }}
      data-testid={`agent-card-${agent.agent_id}`}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="overline text-[10px]">{String(index + 1).padStart(2, "0")} /</div>
        {agent.verified && (
          <div className="tag verified flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />Verified</div>
        )}
      </div>
      <h3 className="font-serif text-3xl leading-tight tracking-tight mb-2 group-hover:text-klein transition-colors">
        {agent.company_name}
      </h3>
      {agent.tagline && (
        <p className="text-sm text-[--muted-foreground] mb-5 line-clamp-2">{agent.tagline}</p>
      )}
      <div className="flex flex-wrap gap-1.5 mb-5">
        {(agent.categories || []).slice(0, 3).map((c) => (
          <span key={c} className="tag">{c}</span>
        ))}
      </div>
      <div className="hairline pt-4 flex items-center justify-between text-xs font-mono text-[--muted-foreground]">
        <span className="flex items-center gap-1.5">
          <MapPin className="w-3 h-3" />
          {(agent.regions || []).join(" · ") || "GLOBAL"}
        </span>
        <span className="flex items-center gap-1">
          <Star className="w-3 h-3 fill-current" />
          {(agent.rating || 0).toFixed(1)} ({agent.reviews_count || 0})
        </span>
      </div>
    </Link>
  );
}
