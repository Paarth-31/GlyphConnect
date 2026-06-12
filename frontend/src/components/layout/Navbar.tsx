import { Monitor, User, LogOut } from "lucide-react";

interface NavbarProps {
  userName?: string;
  onLogout?: () => void;
}

export const Navbar = ({ userName, onLogout }: NavbarProps) => (
  <nav className="w-full flex items-center justify-between px-6 py-4 border-b border-white/10 bg-black/50 backdrop-blur-xl sticky top-0 z-50">
    <div className="flex items-center gap-8">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20">
          <Monitor className="text-primary w-5 h-5" />
        </div>
        <span className="text-xl font-bold tracking-tighter text-white">
          GlyphConnect<span className="text-primary">.</span>
        </span>
      </div>
      <div className="hidden lg:flex items-center gap-8">
        {["News", "Favorites", "Recent Sessions", "Discovered", "Invitations"].map((item) => (
          <div key={item} className="relative group cursor-pointer">
            <span className={`text-[11px] font-bold uppercase tracking-widest transition-colors ${
              item === "Favorites" ? "text-white" : "text-muted-foreground hover:text-white"
            }`}>
              {item}
            </span>
            {item === "Favorites" && (
              <div className="absolute -bottom-6 left-0 w-full h-[2px] bg-primary shadow-[0_0_10px_cyan]" />
            )}
          </div>
        ))}
      </div>
    </div>

    <div className="flex items-center gap-6">
      {}
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 shadow-[0_0_10px_rgba(6,182,212,0.1)]">
        <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse shadow-[0_0_8px_cyan]" />
        <span className="text-[10px] font-bold text-primary uppercase tracking-widest">System Live</span>
      </div>

      {}
      <div className="flex items-center gap-3">
        <span className="text-[10px] font-mono text-muted-foreground">v1.0 PRE-E</span>

        {}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center border border-white/10">
            <User className="w-4 h-4 text-white" />
          </div>
          {}
          {userName && (
            <span className="text-[11px] font-medium text-white/80 hidden lg:block">
              {userName}
            </span>
          )}
        </div>

        {}
        {onLogout && (
          <button
            onClick={onLogout}
            title="Logout"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-muted-foreground hover:text-white hover:bg-white/5 border border-transparent hover:border-white/10 transition-all group"
          >
            <LogOut className="w-3.5 h-3.5 group-hover:text-red-400 transition-colors" />
            <span className="text-[10px] font-bold uppercase tracking-widest hidden lg:block group-hover:text-red-400 transition-colors">
              Logout
            </span>
          </button>
        )}
      </div>
    </div>
  </nav>
);