import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { KeyRound, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

export function JoinBatchByCode() {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const qc = useQueryClient();
  const navigate = useNavigate();

  const handleJoin = async () => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;
    setLoading(true);
    const { data, error } = await supabase.rpc("join_batch_with_code" as any, { _code: trimmed });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    const result = data as any;
    if (!result?.success) {
      toast.error(result?.error || "Could not join");
      return;
    }
    toast.success("Joined batch successfully!");
    qc.invalidateQueries({ queryKey: ["enrolled-batch-ids"] });
    qc.invalidateQueries({ queryKey: ["batches"] });
    setCode("");
    if (result.batch_id) navigate(`/batches/${result.batch_id}`);
  };

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <KeyRound className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-sm">Have a Batch Code?</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-3">Enter the code shared by your institute to instantly join a private batch.</p>
        <div className="flex gap-2">
          <Input
            placeholder="e.g. ABC123"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            className="uppercase font-mono"
            maxLength={10}
            onKeyDown={(e) => e.key === "Enter" && handleJoin()}
          />
          <Button onClick={handleJoin} disabled={loading || !code.trim()}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Join"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
