import React, { useEffect, useState } from "react";
import axios from "axios";
import { Bookmark, BookmarkCheck } from "lucide-react";
import { useAuth, API } from "@/context/AuthContext";
import { toast } from "sonner";

const _cache = { ids: null, listeners: new Set() };

const fetchIds = async () => {
  try {
    const r = await axios.get(`${API}/favourites/ids`);
    _cache.ids = new Set(r.data.agent_ids || []);
  } catch {
    _cache.ids = new Set();
  }
  _cache.listeners.forEach((fn) => fn());
};

export const refreshFavourites = fetchIds;

export default function FavouriteButton({ agentId, size = "sm", className = "" }) {
  const { user } = useAuth();
  const [favourited, setFavourited] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user?.role !== "buyer") return;
    const sync = () => setFavourited(!!_cache.ids?.has(agentId));
    _cache.listeners.add(sync);
    if (_cache.ids === null) {
      fetchIds().then(sync);
    } else {
      sync();
    }
    return () => _cache.listeners.delete(sync);
  }, [agentId, user]);

  if (user?.role !== "buyer") return null;

  const toggle = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    const next = !favourited;
    try {
      if (next) {
        await axios.post(`${API}/favourites/${agentId}`);
        _cache.ids?.add(agentId);
        toast.success("Saved to favourites");
      } else {
        await axios.delete(`${API}/favourites/${agentId}`);
        _cache.ids?.delete(agentId);
        toast.success("Removed from favourites");
      }
      _cache.listeners.forEach((fn) => fn());
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed");
    } finally {
      setBusy(false);
    }
  };

  const Icon = favourited ? BookmarkCheck : Bookmark;
  const px = size === "lg" ? "p-3" : "p-2";
  const ic = size === "lg" ? "w-5 h-5" : "w-4 h-4";

  return (
    <button
      onClick={toggle}
      disabled={busy}
      title={favourited ? "Remove from favourites" : "Save agent"}
      aria-label={favourited ? "Remove from favourites" : "Save agent"}
      className={`${px} border ${
        favourited ? "border-klein bg-klein/10 text-klein" : "border-[--border-soft] hover:border-ink"
      } transition-colors disabled:opacity-50 ${className}`}
      data-testid={`favourite-btn-${agentId}`}
    >
      <Icon className={`${ic} ${favourited ? "fill-current" : ""}`} />
    </button>
  );
}
