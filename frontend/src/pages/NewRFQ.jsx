import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import axios from "axios";
import { API } from "@/context/AuthContext";
import { toast } from "sonner";
import { Upload, X, FileText, ArrowRight } from "lucide-react";

const CATEGORIES = ["Textile & Apparel", "Consumer Electronics", "Packaging", "Home Goods", "Beauty & Cosmetics", "Food & Beverage", "Hardware", "Toys & Games"];
const REGIONS = ["Any", "China", "India", "Vietnam", "Turkey", "Mexico", "Portugal", "Italy", "USA"];

export default function NewRFQ() {
  const nav = useNavigate();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    title: "", description: "", category: CATEGORIES[0], target_region: "Any",
    quantity: 100, budget_usd: 5000, timeline: "8 weeks",
  });
  const [requirements, setRequirements] = useState({});
  const [schema, setSchema] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [createdRfq, setCreatedRfq] = useState(null);
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  // Load schema when category changes
  useEffect(() => {
    axios.get(`${API}/rfqs/categories/${encodeURIComponent(form.category)}/schema`).then((r) => {
      setSchema(r.data.fields?.length ? r.data : null);
      setRequirements({});
    });
  }, [form.category]);

  const setReq = (k, v) => setRequirements((r) => ({ ...r, [k]: v }));
  const toggleReq = (k, v) => setRequirements((r) => {
    const cur = r[k] || [];
    return { ...r, [k]: cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v] };
  });

  const submitRfq = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const r = await axios.post(`${API}/rfqs`, {
        ...form,
        quantity: Number(form.quantity),
        budget_usd: Number(form.budget_usd),
        requirements,
      });
      setCreatedRfq(r.data);
      setStep(3);
      toast.success("RFQ created. Add attachments next.");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed");
    } finally {
      setSubmitting(false);
    }
  };

  const onFileChange = async (e) => {
    const newFiles = Array.from(e.target.files || []);
    if (!newFiles.length || !createdRfq) return;
    setUploading(true);
    for (const f of newFiles) {
      const fd = new FormData();
      fd.append("file", f);
      try {
        const r = await axios.post(`${API}/rfqs/${createdRfq.rfq_id}/attachments`, fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        setFiles((prev) => [...prev, r.data]);
        toast.success(`Uploaded ${f.name}`);
      } catch (err) {
        toast.error(`${f.name}: ${err.response?.data?.detail || "upload failed"}`);
      }
    }
    setUploading(false);
    e.target.value = "";
  };

  const removeFile = async (file_id) => {
    await axios.delete(`${API}/rfqs/${createdRfq.rfq_id}/attachments/${file_id}`);
    setFiles((p) => p.filter((f) => f.file_id !== file_id));
  };

  const finalize = () => nav(`/rfqs/${createdRfq.rfq_id}`);

  return (
    <div className="min-h-screen bg-bone">
      <Navbar />
      <div className="max-w-3xl mx-auto px-6 lg:px-10 py-16">
        <div className="overline mb-4">§ NEW BRIEF · STEP {step} OF 3</div>
        <h1 className="font-serif text-5xl lg:text-6xl font-light leading-none tracking-tight mb-4">Post an <em className="text-klein not-italic">RFQ</em>.</h1>
        <div className="flex gap-2 mb-10 mt-6">
          {[1, 2, 3].map((n) => (
            <div key={n} className={`h-1 flex-1 ${n <= step ? "bg-klein" : "bg-[--border-soft]"}`} />
          ))}
        </div>

        {step === 1 && (
          <form onSubmit={(e) => { e.preventDefault(); setStep(2); }} className="space-y-8" data-testid="rfq-form-step1">
            <Field label="Product title">
              <input required className="input-underline" value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Vitamin C serum, 30ml" data-testid="rfq-title" />
            </Field>
            <Field label="Description">
              <textarea required className="input-underline min-h-[120px]" value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Brief overview, vision, what makes this product special…" data-testid="rfq-description" />
            </Field>
            <div className="grid md:grid-cols-2 gap-8">
              <Field label="Category">
                <select className="input-underline" value={form.category} onChange={(e) => set("category", e.target.value)} data-testid="rfq-category">
                  {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="Preferred region">
                <select className="input-underline" value={form.target_region} onChange={(e) => set("target_region", e.target.value)} data-testid="rfq-region">
                  {REGIONS.map((c) => <option key={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="Quantity">
                <input type="number" min="1" required className="input-underline" value={form.quantity} onChange={(e) => set("quantity", e.target.value)} data-testid="rfq-qty" />
              </Field>
              <Field label="Budget (USD)">
                <input type="number" min="0" required className="input-underline" value={form.budget_usd} onChange={(e) => set("budget_usd", e.target.value)} data-testid="rfq-budget" />
              </Field>
              <Field label="Timeline" className="md:col-span-2">
                <input required className="input-underline" value={form.timeline} onChange={(e) => set("timeline", e.target.value)} placeholder="e.g. 8 weeks to delivery" data-testid="rfq-timeline" />
              </Field>
            </div>
            <div className="flex gap-4 pt-6">
              <button type="submit" className="btn-primary" data-testid="rfq-next-1">
                {schema ? "Next: detailed brief" : "Next: review"} <ArrowRight className="w-4 h-4" />
              </button>
              <button type="button" onClick={() => nav(-1)} className="btn-outline">Cancel</button>
            </div>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={submitRfq} className="space-y-6" data-testid="rfq-form-step2">
            {schema ? (
              <>
                <div className="overline">{schema.label?.toUpperCase()}</div>
                <p className="text-sm text-[--muted-foreground] mb-4">Specific spec questions help us match you to the right factory faster.</p>
                {schema.fields.map((f) => (
                  <div key={f.key} data-testid={`req-${f.key}`}>
                    <div className="overline mb-2">{f.label}</div>
                    {f.type === "select" && (
                      <select className="input-underline" value={requirements[f.key] || ""} onChange={(e) => setReq(f.key, e.target.value)}>
                        <option value="">— select —</option>
                        {f.options.map((o) => <option key={o}>{o}</option>)}
                      </select>
                    )}
                    {f.type === "text" && (
                      <input className="input-underline" value={requirements[f.key] || ""} onChange={(e) => setReq(f.key, e.target.value)} placeholder={f.placeholder} />
                    )}
                    {f.type === "multi" && (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {f.options.map((o) => (
                          <button type="button" key={o} onClick={() => toggleReq(f.key, o)}
                            className={`tag ${(requirements[f.key] || []).includes(o) ? "verified" : ""} cursor-pointer`}>
                            {o}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </>
            ) : (
              <div className="editorial-card p-6">
                <p className="text-sm text-[--muted-foreground]">No structured form for this category yet. Click submit to continue with the basics + attachments.</p>
              </div>
            )}
            <div className="flex gap-4 pt-6">
              <button type="button" onClick={() => setStep(1)} className="btn-outline">Back</button>
              <button type="submit" disabled={submitting} className="btn-primary" data-testid="rfq-submit">
                {submitting ? "Posting…" : "Post RFQ →"}
              </button>
            </div>
          </form>
        )}

        {step === 3 && createdRfq && (
          <div className="space-y-6" data-testid="rfq-form-step3">
            <div className="editorial-card p-6 border-l-4 border-l-klein">
              <div className="overline mb-2">✓ RFQ POSTED</div>
              <p className="text-sm">Now attach tech packs, mood boards or spec sheets — agents will see them when reviewing your brief.</p>
            </div>

            <label className="editorial-card p-10 border-dashed border-2 border-[--border-soft] hover:border-klein flex flex-col items-center cursor-pointer transition-colors" data-testid="rfq-upload-zone">
              <Upload className="w-8 h-8 text-klein mb-3" />
              <div className="font-serif text-2xl mb-1">Drop files or click to select</div>
              <div className="overline text-[10px]">PDF · PNG · JPG · XLSX · DOCX · MAX 20MB · UP TO 10 FILES</div>
              <input type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.xlsx,.docx" onChange={onFileChange} className="hidden" data-testid="rfq-file-input" />
            </label>

            {uploading && <div className="font-mono text-xs text-[--muted-foreground]">UPLOADING…</div>}

            <div className="space-y-2" data-testid="rfq-attachments-list">
              {files.map((f) => (
                <div key={f.file_id} className="editorial-card p-4 flex items-center justify-between" data-testid={`attachment-${f.file_id}`}>
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-klein" />
                    <div>
                      <div className="font-serif text-lg">{f.filename}</div>
                      <div className="font-mono text-[10px] text-[--muted-foreground]">{(f.size / 1024).toFixed(0)} KB</div>
                    </div>
                  </div>
                  <button onClick={() => removeFile(f.file_id)} className="p-2 hover:bg-[--muted]" data-testid={`remove-${f.file_id}`}>
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex gap-4 pt-6">
              <button onClick={finalize} className="btn-primary" data-testid="rfq-finish">
                Finish & view RFQ <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const Field = ({ label, children, className = "" }) => (
  <div className={className}>
    <div className="overline mb-1">{label}</div>
    {children}
  </div>
);
