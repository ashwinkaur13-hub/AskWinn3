import React, { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import { useAuth, API } from "@/context/AuthContext";
import axios from "axios";
import { toast } from "sonner";

const CATEGORIES = ["Textile & Apparel", "Consumer Electronics", "Packaging", "Home Goods", "Beauty & Cosmetics", "Food & Beverage", "Hardware", "Toys & Games"];
const INDIAN_STATES = [
  "Andhra Pradesh", "Bihar", "Delhi", "Gujarat", "Haryana", "Karnataka", "Kerala",
  "Madhya Pradesh", "Maharashtra", "Punjab", "Rajasthan", "Tamil Nadu", "Telangana",
  "Uttar Pradesh", "West Bengal", "Other",
];
const YEARS_OPTIONS = ["0-2 Years", "3-5 Years", "6-10 Years", "10+ Years"];

const yearsLabelToInt = (label) => ({ "0-2 Years": 1, "3-5 Years": 4, "6-10 Years": 8, "10+ Years": 12 }[label] || 0);
const intToYearsLabel = (n) => {
  if (!n || n < 3) return "0-2 Years";
  if (n <= 5) return "3-5 Years";
  if (n <= 10) return "6-10 Years";
  return "10+ Years";
};

export default function AgentProfileEdit() {
  const { user } = useAuth();
  const [form, setForm] = useState(null);

  useEffect(() => {
    axios.get(`${API}/agents/by-user/me`).then((r) => {
      const d = r.data;
      setForm({
        company_name: d.company_name || "", tagline: d.tagline || "",
        bio: d.bio || "",
        categories: d.categories || [],
        country: "India",
        services: (d.services || []).join(", "),
        certifications: (d.certifications || []).join(", "),
        portfolio_images: (d.portfolio_images || []).join("\n"),
        min_order_qty: d.min_order_qty || 0,
        // KYC
        pan_number: d.pan_number || "",
        gst_number: d.gst_number || "",
        business_address: d.business_address || "",
        factory_city: d.factory_city || "",
        factory_state: d.factory_state || "",
        years_band: intToYearsLabel(d.years_in_operation),
        factory_video_url: d.factory_video_url || "",
        catalogue_url: d.catalogue_url || "",
        availability_status: d.availability_status || "active",
        turnkey_manufacturing: d.turnkey_manufacturing ?? true,
      });
    });
  }, [user]);

  const toggle = (key, val) => {
    setForm((f) => ({ ...f, [key]: f[key].includes(val) ? f[key].filter((x) => x !== val) : [...f[key], val] }));
  };

  const save = async (e) => {
    e.preventDefault();
    if (!form.turnkey_manufacturing) {
      toast.error("AskWinn is a Turnkey Manufacturing network — please confirm End-to-End Turnkey capability.");
      return;
    }
    const payload = {
      company_name: form.company_name,
      tagline: form.tagline,
      bio: form.bio,
      categories: form.categories,
      regions: ["India"],
      min_order_qty: Number(form.min_order_qty) || 0,
      years_in_operation: yearsLabelToInt(form.years_band),
      services: form.services.split(",").map((s) => s.trim()).filter(Boolean),
      certifications: form.certifications.split(",").map((s) => s.trim()).filter(Boolean),
      portfolio_images: form.portfolio_images.split("\n").map((s) => s.trim()).filter(Boolean),
      pan_number: form.pan_number,
      gst_number: form.gst_number,
      business_address: form.business_address,
      factory_city: form.factory_city,
      factory_state: form.factory_state,
      factory_video_url: form.factory_video_url,
      catalogue_url: form.catalogue_url,
      availability_status: form.availability_status,
      turnkey_manufacturing: !!form.turnkey_manufacturing,
    };
    try {
      await axios.put(`${API}/agents/me`, payload);
      toast.success("Profile saved");
    } catch (err) {
      toast.error("Save failed");
    }
  };

  if (!form) return <div className="min-h-screen bg-bone"><Navbar /><div className="p-20 text-center font-mono">Loading…</div></div>;

  return (
    <div className="min-h-screen bg-bone">
      <Navbar />
      <div className="max-w-3xl mx-auto px-6 lg:px-10 py-16">
        <div className="overline mb-4">§ VENDOR PROFILE</div>
        <h1 className="font-serif text-5xl lg:text-6xl font-light leading-none tracking-tight mb-10">Your <em className="text-klein not-italic">story</em>.</h1>

        <form onSubmit={save} className="space-y-10" data-testid="profile-form">
          <Section label="Brand">
            <F label="Company name">
              <input required className="input-underline" value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} data-testid="profile-company" />
            </F>
            <F label="Tagline (one line)">
              <input className="input-underline" value={form.tagline} onChange={(e) => setForm({ ...form, tagline: e.target.value })} data-testid="profile-tagline" />
            </F>
            <F label="Core Manufacturing Capabilities">
              <textarea className="input-underline min-h-[120px]" value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} placeholder="What can your factory build end-to-end? Capacity, machinery, IP, processes…" data-testid="profile-bio" />
            </F>
            <F label="">
              <label className="flex items-start gap-3 p-4 border border-klein bg-klein/5 cursor-pointer" data-testid="profile-turnkey-wrap">
                <input
                  type="checkbox"
                  required
                  checked={!!form.turnkey_manufacturing}
                  onChange={(e) => setForm({ ...form, turnkey_manufacturing: e.target.checked })}
                  className="mt-1"
                  data-testid="profile-turnkey"
                />
                <div>
                  <div className="font-serif text-lg leading-tight">End-to-End Turnkey Manufacturing</div>
                  <p className="text-xs text-[--muted-foreground] mt-1">AskWinn is a Turnkey network — confirm you can take an RFQ from raw material to dispatched goods without sub-contracting outside your control.</p>
                </div>
              </label>
            </F>
            <F label="Availability">
              <select className="input-underline" value={form.availability_status} onChange={(e) => setForm({ ...form, availability_status: e.target.value })} data-testid="profile-availability">
                <option value="active">Active — open to new RFQs</option>
                <option value="paused">Paused — temporarily not bidding</option>
              </select>
            </F>
          </Section>

          <Section label="KYC & Business">
            <div className="grid md:grid-cols-2 gap-6">
              <F label="PAN number">
                <input className="input-underline" value={form.pan_number} onChange={(e) => setForm({ ...form, pan_number: e.target.value })} placeholder="ABCDE1234F" data-testid="profile-pan" />
              </F>
              <F label="GST number">
                <input className="input-underline" value={form.gst_number} onChange={(e) => setForm({ ...form, gst_number: e.target.value })} placeholder="29ABCDE1234F1Z5" data-testid="profile-gst" />
              </F>
            </div>
            <F label="Business address">
              <textarea className="input-underline min-h-[80px]" value={form.business_address} onChange={(e) => setForm({ ...form, business_address: e.target.value })} data-testid="profile-address" />
            </F>
            <div className="grid md:grid-cols-3 gap-6">
              <F label="Country">
                <input disabled className="input-underline opacity-60" value="India" data-testid="profile-country" />
              </F>
              <F label="State">
                <select className="input-underline" value={form.factory_state} onChange={(e) => setForm({ ...form, factory_state: e.target.value })} data-testid="profile-state">
                  <option value="">— select state —</option>
                  {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </F>
              <F label="Factory city">
                <input className="input-underline" value={form.factory_city} onChange={(e) => setForm({ ...form, factory_city: e.target.value })} placeholder="e.g. Jaipur" data-testid="profile-city" />
              </F>
            </div>
            <F label="Years in operation">
              <select className="input-underline" value={form.years_band} onChange={(e) => setForm({ ...form, years_band: e.target.value })} data-testid="profile-years">
                {YEARS_OPTIONS.map((y) => <option key={y}>{y}</option>)}
              </select>
            </F>
            <F label="Factory tour video URL (YouTube / Vimeo)">
              <input type="url" className="input-underline" value={form.factory_video_url} onChange={(e) => setForm({ ...form, factory_video_url: e.target.value })} placeholder="https://youtu.be/..." data-testid="profile-video" />
            </F>
            <F label="Catalogue URL (PDF / Google Drive link)">
              <input type="url" className="input-underline" value={form.catalogue_url} onChange={(e) => setForm({ ...form, catalogue_url: e.target.value })} data-testid="profile-catalogue" />
            </F>
          </Section>

          <Section label="Capabilities">
            <F label="Min order quantity">
              <input type="number" min="0" className="input-underline" value={form.min_order_qty} onChange={(e) => setForm({ ...form, min_order_qty: e.target.value })} data-testid="profile-moq" />
            </F>
            <F label="Categories">
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((c) => (
                  <button type="button" key={c} onClick={() => toggle("categories", c)} className={`tag ${form.categories.includes(c) ? "verified" : ""} cursor-pointer`}>{c}</button>
                ))}
              </div>
            </F>
            <F label="Services (comma-separated)">
              <input className="input-underline" value={form.services} onChange={(e) => setForm({ ...form, services: e.target.value })} placeholder="Sampling, Tooling, Assembly, QC" data-testid="profile-services" />
            </F>
            <F label="Certifications (comma-separated)">
              <input className="input-underline" value={form.certifications} onChange={(e) => setForm({ ...form, certifications: e.target.value })} placeholder="ISO 9001, BSCI, GOTS" data-testid="profile-certs" />
            </F>
            <F label="Portfolio images (one URL per line)">
              <textarea className="input-underline min-h-[80px]" value={form.portfolio_images} onChange={(e) => setForm({ ...form, portfolio_images: e.target.value })} data-testid="profile-portfolio" />
            </F>
          </Section>

          <button type="submit" className="btn-primary" data-testid="profile-save">Save profile</button>
        </form>
      </div>
    </div>
  );
}

const Section = ({ label, children }) => (
  <div>
    <div className="overline mb-6 text-burn">§ {label}</div>
    <div className="space-y-6">{children}</div>
  </div>
);
const F = ({ label, children }) => (<div><div className="overline mb-1">{label}</div>{children}</div>);
