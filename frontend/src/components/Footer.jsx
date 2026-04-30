import React from "react";

export default function Footer() {
  return (
    <footer className="mt-32 border-t border-[--border-soft] bg-bone">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-10 py-16 grid md:grid-cols-4 gap-10">
        <div className="md:col-span-2">
          <div className="font-serif text-4xl tracking-tighter leading-none mb-4">Ask<span className="text-klein">Winn</span>.</div>
          <p className="text-sm text-[--muted-foreground] max-w-sm leading-relaxed">
            The editorial marketplace for founders who ship. End-to-end manufacturing agents, curated.
          </p>
        </div>
        <div>
          <div className="overline mb-4">Platform</div>
          <ul className="space-y-2 text-sm">
            <li>Agent Directory</li>
            <li>Post an RFQ</li>
            <li>AI Match</li>
            <li>Verified Partners</li>
          </ul>
        </div>
        <div>
          <div className="overline mb-4">Company</div>
          <ul className="space-y-2 text-sm">
            <li>About</li>
            <li>How it works</li>
            <li>Trust & safety</li>
            <li>Contact</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-[--border-soft]">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-10 py-6 flex items-center justify-between">
          <span className="font-mono text-xs text-[--muted-foreground]">© 2026 ASKWINN — EDITORIAL SOURCING</span>
          <span className="font-mono text-xs text-[--muted-foreground]">MADE FOR FOUNDERS</span>
        </div>
      </div>
    </footer>
  );
}
