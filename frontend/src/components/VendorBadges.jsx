import React from "react";
import { Crown, Zap, Award } from "lucide-react";

const META = {
  top_vendor: { icon: Crown, label: "Top Vendor", color: "bg-klein text-white" },
  fast_responder: { icon: Zap, label: "Fast Responder", color: "bg-burn text-white" },
  high_quality: { icon: Award, label: "High Quality", color: "bg-ink text-white" },
};

export default function VendorBadges({ badges = [], size = "sm" }) {
  if (!badges?.length) return null;
  const cls = size === "sm" ? "text-[9px] px-2 py-1" : "text-xs px-2.5 py-1.5";
  return (
    <div className="flex flex-wrap gap-1.5">
      {badges.map((b) => {
        const m = META[b];
        if (!m) return null;
        const Icon = m.icon;
        return (
          <span key={b} className={`inline-flex items-center gap-1 font-mono uppercase tracking-[0.12em] ${cls} ${m.color}`} data-testid={`badge-${b}`}>
            <Icon className="w-3 h-3" /> {m.label}
          </span>
        );
      })}
    </div>
  );
}
