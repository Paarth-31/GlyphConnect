import { Button } from "@/components/ui/button";
import { Lock } from "lucide-react";

interface HeroSectionProps {
  myId: string;
}

export const HeroSection = ({ myId }: HeroSectionProps) => {
  return (
    <div className="flex flex-col items-center text-center mb-12 max-w-4xl">
      <h1 className="text-5xl md:text-7xl font-black tracking-tight text-white mb-6 leading-tight">
        INSTANT SECURE <br />
        <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-cyan-400 to-blue-500">
          GLOBAL CONNECTIONS.
        </span>
      </h1>
      <p className="text-muted-foreground text-lg max-w-2xl mx-auto mb-10">
        Low-latency, peer-to-peer desktop access, re-imagined for the modern web.
      </p>

      {}
      <div className="w-full max-w-lg relative group">
        <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 to-blue-500/20 rounded-xl blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
        <div className="relative bg-black/80 border border-white/10 rounded-xl p-2 flex items-center gap-4">
          <Lock className="w-5 h-5 text-muted-foreground ml-3" />
          <div className="flex-1 text-2xl font-mono text-white tracking-widest font-medium">
             {myId}
          </div>
          <Button 
              variant="ghost" 
              className="text-primary hover:text-primary/80 hover:bg-primary/10 text-xs font-bold uppercase tracking-widest border border-primary/20 h-10 px-6"
          >
              Invite
          </Button>
        </div>
      </div>
    </div>
  );
};