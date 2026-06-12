import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Monitor, RefreshCw } from "lucide-react";

interface HostCardProps {
  handleGenerateId: () => void;
}

export const HostCard = ({ handleGenerateId }: HostCardProps) => {
  return (
    <Card className="bg-black/40 backdrop-blur-md border-white/10 hover:border-primary/50 transition-all duration-300 group">
      <CardHeader className="text-center pb-2">
        <div className="mx-auto w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
          <Monitor className="w-6 h-6 text-primary" />
        </div>
        <CardTitle className="text-white text-xl">Host Session</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-center text-muted-foreground">
          Your current session ID is active and ready for connection.
        </p>
        <Button 
          onClick={handleGenerateId}
          className="w-full h-12 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold uppercase tracking-widest flex items-center justify-center gap-2"
        >
          <RefreshCw className="w-4 h-4" /> Generate New ID
        </Button>
      </CardContent>
    </Card>
  );
};