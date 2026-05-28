import { Monitor, Link, Heart, FileEdit, Trash2} from "lucide-react";

export const ContextDropdown = () => {
  return (
    <div className="absolute top-[60%] right-[20%] w-64 bg-[#0a0a0a] border border-white/10 rounded-xl shadow-2xl shadow-black overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-200">
      <div className="px-4 py-3 border-b border-white/5 bg-white/5">
        <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Contextual Menu</span>
      </div>
      <div className="p-2 space-y-1">
        <div className="flex items-center gap-3 px-3 py-2 text-sm text-white hover:bg-primary/10 hover:text-primary rounded-md cursor-pointer transition-colors">
          <Monitor className="w-4 h-4" /> Connect
        </div>
        <div className="flex items-center gap-3 px-3 py-2 text-sm text-white hover:bg-primary/10 hover:text-primary rounded-md cursor-pointer transition-colors">
          <Link className="w-4 h-4" /> Invite
        </div>
        <div className="flex items-center gap-3 px-3 py-2 text-sm text-white hover:bg-primary/10 hover:text-primary rounded-md cursor-pointer transition-colors">
          <Heart className="w-4 h-4" /> Add to Favorites
        </div>
        <div className="flex items-center gap-3 px-3 py-2 text-sm text-white hover:bg-primary/10 hover:text-primary rounded-md cursor-pointer transition-colors">
          <FileEdit className="w-4 h-4" /> Rename
        </div>
        <div className="h-px bg-white/10 my-1" />
        <div className="flex items-center gap-3 px-3 py-2 text-sm text-red-500 hover:bg-red-500/10 rounded-md cursor-pointer transition-colors">
          <Trash2 className="w-4 h-4" /> Remove Selected
        </div>
      </div>
    </div>
  );
};