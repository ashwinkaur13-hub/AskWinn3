import React, { useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import { useAuth, API } from "@/context/AuthContext";
import axios from "axios";
import { Send } from "lucide-react";

export default function Messages() {
  const { otherUserId } = useParams();
  const { user } = useAuth();
  const [threads, setThreads] = useState([]);
  const [thread, setThread] = useState(null);
  const [body, setBody] = useState("");
  const scrollRef = useRef(null);

  const loadThreads = () => axios.get(`${API}/threads`).then((r) => setThreads(r.data));
  const loadThread = (id) => axios.get(`${API}/messages/thread/${id}`).then((r) => setThread(r.data));

  useEffect(() => { loadThreads(); }, []);
  useEffect(() => { if (otherUserId) loadThread(otherUserId); }, [otherUserId]);
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [thread]);

  const send = async (e) => {
    e.preventDefault();
    if (!body.trim() || !otherUserId) return;
    await axios.post(`${API}/messages`, { recipient_id: otherUserId, body });
    setBody("");
    loadThread(otherUserId);
    loadThreads();
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
                  <div className="text-xs text-[--muted-foreground] line-clamp-1 mt-1">{t.last.body}</div>
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
                      <div key={m.message_id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[70%] p-4 ${mine ? "bg-klein text-white" : "bg-[--muted] text-ink border border-[--border-soft]"}`}>
                          <div className="text-sm whitespace-pre-wrap">{m.body}</div>
                          <div className={`font-mono text-[10px] mt-2 ${mine ? "opacity-70" : "text-[--muted-foreground]"}`}>{new Date(m.created_at).toLocaleString()}</div>
                        </div>
                      </div>
                    );
                  })}
                  {thread.messages.length === 0 && <div className="text-center text-sm text-[--muted-foreground] font-mono">— Say hello.</div>}
                </div>
                <form onSubmit={send} className="border-t border-[--border-soft] p-4 flex gap-3" data-testid="message-form">
                  <input
                    className="input-underline flex-1"
                    placeholder="Type a message…"
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    data-testid="message-input"
                  />
                  <button type="submit" className="btn-primary" data-testid="message-send">
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
