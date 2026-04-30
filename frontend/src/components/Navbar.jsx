import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { User, LogOut, Shield } from "lucide-react";

export default function Navbar({ transparent = false }) {
  const { user, logout } = useAuth();
  const nav = useNavigate();

  return (
    <header
      className={`sticky top-0 z-40 ${transparent ? "bg-transparent" : "backdrop-blur-xl bg-bone/80 border-b border-[--border-soft]"}`}
      data-testid="nav-bar"
    >
      <div className="max-w-[1400px] mx-auto flex items-center justify-between px-6 lg:px-10 h-20">
        <Link to="/" className="flex items-center gap-2" data-testid="nav-logo">
          <span className="font-serif text-3xl font-medium tracking-tighter leading-none">Ask<span className="text-klein">Winn</span>.</span>
        </Link>
        <nav className="hidden md:flex items-center gap-10 text-[13px] font-medium">
          <Link to="/directory" className="hover:text-klein transition-colors" data-testid="nav-directory">Agents</Link>
          {user && <Link to="/rfqs" className="hover:text-klein transition-colors" data-testid="nav-rfqs">RFQs</Link>}
          {user && <Link to="/messages" className="hover:text-klein transition-colors" data-testid="nav-messages">Messages</Link>}
          {user?.role === "admin" && <Link to="/admin" className="hover:text-klein transition-colors flex items-center gap-1" data-testid="nav-admin"><Shield className="w-3.5 h-3.5" />Admin</Link>}
        </nav>
        <div className="flex items-center gap-3">
          {!user ? (
            <Link to="/login" className="btn-primary" data-testid="nav-login-btn">
              Sign in
            </Link>
          ) : (
            <div className="flex items-center gap-3">
              <button
                onClick={() => nav("/dashboard")}
                className="flex items-center gap-2 px-3 py-2 border border-[--border-soft] hover:border-ink transition-colors"
                data-testid="nav-user"
              >
                {user.picture ? (
                  <img src={user.picture} alt="" className="w-7 h-7 rounded-full" />
                ) : (
                  <User className="w-4 h-4" />
                )}
                <span className="text-[13px] font-medium hidden sm:block">{user.name?.split(" ")[0]}</span>
                <span className="overline text-[10px] hidden md:block">{user.role}</span>
              </button>
              <button onClick={logout} className="p-2 border border-[--border-soft] hover:border-ink" data-testid="nav-logout" title="Sign out">
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
