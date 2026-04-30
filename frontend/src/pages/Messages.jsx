import React, { useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import { useAuth, API } from "@/context/AuthContext";
import axios from "axios";
import { Send, Paperclip, X, FileText, Download, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";

const isImage = (ct = "") => ct.startsWith("image/");

export default function Messages() {
  const { otherUserId } = useParams();
  const { user } = useAuth();
  const [threads, setThreads] = useState([]);
  const [thread, setThread] = useState(null);
  const [body, setBody] = useState("");
  const [pending, setPending] = useState([]); // attachments not yet sent
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const fileRef = useRef(null);
  const scrollRef = useRef(null);

  const loadThreads = () => axios.get(`${API}/threads`).then((r) => setThreads(r.data));
  const loadThread = (id) => axios.get(`${API}/messages/thread/${id}`).then((r) => setThread(r.data));

  useEffect(() => { loadThreads(); }, []);
  useEffect(() => {
    setPending([]);
    setBody("");
    if (otherUserId) loadThread(otherUserId);
  }, [otherUserId]);
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [thread]);

  const onPickFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !otherUserId) return;
    if (file.size > 20 * 1024 * 1024) {
      toast.error("File too large (>20MB)");
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await axios.post(`${API}/messages/attachment?recipient_id=${encodeURIComponent(otherUserId)}`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setPending((p) => [...p, r.data]);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const removePending = (file_id) => setPending((p) => p.filter((a) => a.file_id !== file_id));

  const send = async (e) => {
    e.preventDefault();
    if (!otherUserId) return;
    if (!body.trim() && pending.length === 0) return;
    setSending(true);
    try {
      await axios.post(`${API}/messages`, {
        recipient_id: otherUserId,
        body,
        attachments: pending,
      });
      setBody("");
      setPending([]);
      loadThread(otherUserId);
      loadThreads();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-bone">
      <Navbar />
      <div className="max-w-[1400px] mx-auto px-6 lg:px-10 py-12">
        <div className="overline mb-3">§ INBOX</div>
        <h1 className="font-serif text-5xl lg:text-6xl font-light leading-none tracking-tight mb-10">Messages</h1>

        <div className="grid lg:grid-cols-12 gap-6" style={{ height: "70vh" }}>
          <aside className="lg:col-span-4 editorial-card p-0 overflow-hidden flex flex-col">
            <div className="overline p-4 border-b border-[--border-soft]">THREADS</div>
            <div className="flex-1 overflow-y-auto">
              {threads.map((t) => (
                <Link
                  key={t.other.user_id}
                  to={`/messages/${t.other.user_id}`}
                  className={`block p-4 border-b border-[--border-soft] hover:bg-[--muted] ${otherUserId === t.other.user_id ? "bg-[--muted]" : ""}`}
                  data-testid={`thread-${t.other.user_id}`}
                >
                  <div className="font-serif text-lg tracking-tight">{t.other.name}</div>
                  <div className="text-xs text-[--muted-foreground] line-clamp-1 mt-1">
                    {t.last.body || (t.last.attachments?.length ? `📎 ${t.last.attachments.length} attachment${t.last.attachments.length === 1 ? "" : "s"}` : "")}
                  </div>
                </Link>
              ))}
              {threads.length === 0 && <div className="p-6 text-sm text-[--muted-foreground] font-mono">— Empty inbox.</div>}
            </div>
          </aside>

          <section className="lg:col-span-8 editorial-card p-0 overflow-hidden flex flex-col">
            {!thread ? (
              <div className="flex-1 flex items-center justify-center text-[--muted-foreground] font-mono text-sm">SELECT A THREAD</div>
            ) : (
              <>
                <div className="p-4 border-b border-[--border-soft]">
                  <div className="font-serif text-2xl tracking-tight">{thread.other?.name}</div>
                  <div className="overline text-[10px]">{thread.other?.role}</div>
                </div>
                <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-3">
                  {thread.messages.map((m) => {
                    const mine = m.sender_id === user.user_id;
                    return (
                      <div key={m.message_id} className={`flex ${mine ? "justify-end" : "justify-start"}`} data-testid={`msg-${m.message_id}`}>
                        <div className={`max-w-[70%] p-4 ${mine ? "bg-klein text-white" : "bg-[--muted] text-ink border border-[--border-soft]"}`}>
                          {m.body && <div className="text-sm whitespace-pre-wrap">{m.body}</div>}
                          {(m.attachments || []).length > 0 && (
                            <div className={`mt-2 space-y-2 ${m.body ? "" : ""}`}>
                              {m.attachments.map((a) => (
                                <a
                                  key={a.file_id}
                                  href={`${API}/messages/${m.message_id}/attachment/${a.file_id}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className={`flex items-center gap-2 p-2 border ${mine ? "border-white/30 hover:border-white" : "border-[--border-soft] hover:border-ink"} transition-colors`}
                                  data-testid={`msg-attachment-${a.file_id}`}
                                >
                                  {isImage(a.content_type) ? <ImageIcon className="w-4 h-4 flex-shrink-0" /> : <FileText className="w-4 h-4 flex-shrink-0" />}
                                  <div className="flex-1 min-w-0">
                                    <div className="text-xs font-medium truncate">{a.filename}</div>
                                    <div className={`font-mono text-[10px] ${mine ? "opacity-70" : "text-[--muted-foreground]"}`}>{(a.size / 1024).toFixed(0)} KB</div>
                                  </div>
                                  <Download className="w-3 h-3 flex-shrink-0" />
                                </a>
                              ))}
                            </div>
                          )}
                          <div className={`font-mono text-[10px] mt-2 ${mine ? "opacity-70" : "text-[--muted-foreground]"}`}>{new Date(m.created_at).toLocaleString()}</div>
                        </div>
                      </div>
                    );
                  })}
                  {thread.messages.length === 0 && <div className="text-center text-sm text-[--muted-foreground] font-mono">— Say hello.</div>}
                </div>

                {pending.length > 0 && (
                  <div className="border-t border-[--border-soft] p-3 flex gap-2 flex-wrap" data-testid="pending-attachments">
                    {pending.map((a) => (
                      <div key={a.file_id} className="flex items-center gap-2 bg-[--muted] border border-[--border-soft] px-3 py-2 text-xs" data-testid={`pending-${a.file_id}`}>
                        {isImage(a.content_type) ? <ImageIcon className="w-3 h-3" /> : <FileText className="w-3 h-3" />}
                        <span className="max-w-[180px] truncate">{a.filename}</span>
                        <button onClick={() => removePending(a.file_id)} className="opacity-60 hover:opacity-100" aria-label="Remove" data-testid={`remove-pending-${a.file_id}`}>
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <form onSubmit={send} className="border-t border-[--border-soft] p-4 flex gap-3 items-center" data-testid="message-form">
                  <input ref={fileRef} type="file" hidden onChange={onPickFile} accept=".pdf,.png,.jpg,.jpeg,.docx,.xlsx" data-testid="attachment-input" />
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="p-2 border border-[--border-soft] hover:border-ink transition-colors disabled:opacity-50"
                    title="Attach file"
                    aria-label="Attach file"
                    data-testid="attach-btn"
                  >
                    <Paperclip className="w-4 h-4" />
                  </button>
                  <input
                    className="input-underline flex-1"
                    placeholder={uploading ? "Uploading file…" : "Type a message…"}
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    data-testid="message-input"
                  />
                  <button type="submit" disabled={sending || (!body.trim() && pending.length === 0)} className="btn-primary disabled:opacity-50" data-testid="message-send">
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
