import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { IndianRupee, Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payment: any;
  onDone?: () => void;
}

export function RefundDialog({ open, onOpenChange, payment, onDone }: Props) {
  const { user } = useAuth();
  const [amount, setAmount] = useState<number>(Number(payment?.amount || 0));
  const [reason, setReason] = useState("");
  const [revoke, setRevoke] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!payment) return;
    if (!reason.trim()) return toast.error("Please enter a refund reason");
    if (amount <= 0 || amount > Number(payment.amount)) return toast.error("Invalid amount");
    setSubmitting(true);
    const isFull = amount >= Number(payment.amount);

    const { error } = await supabase
      .from("payments")
      .update({
        refund_amount: amount,
        refund_reason: reason,
        refunded_at: new Date().toISOString(),
        refunded_by: user?.id,
        status: isFull ? "refunded" : payment.status,
      })
      .eq("id", payment.id);

    if (error) {
      toast.error(error.message);
      setSubmitting(false);
      return;
    }

    if (revoke && isFull && payment.user_id && payment.batch_id) {
      await supabase
        .from("batch_enrollments")
        .update({ is_active: false })
        .eq("user_id", payment.user_id)
        .eq("batch_id", payment.batch_id);
    }

    if (user) {
      await supabase.from("audit_logs").insert({
        user_id: user.id,
        action: "payment_refund",
        entity_type: "payments",
        entity_id: payment.id,
        new_value: { amount, reason, revoke_access: revoke && isFull },
      });
    }

    toast.success(`Refund of ₹${amount.toLocaleString("en-IN")} recorded`);
    setSubmitting(false);
    onDone?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Process Refund</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-lg bg-muted/30 p-3 text-sm">
            <div>Original amount: <span className="font-bold inline-flex items-center"><IndianRupee className="w-3 h-3" />{Number(payment?.amount || 0).toLocaleString("en-IN")}</span></div>
            <div className="text-xs text-muted-foreground">Txn: {payment?.transaction_id || payment?.id?.slice(0, 8)}</div>
          </div>
          <div>
            <Label>Refund amount (₹)</Label>
            <Input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
          </div>
          <div>
            <Label>Reason</Label>
            <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Customer request, duplicate charge, etc." />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label>Revoke batch access</Label>
              <p className="text-xs text-muted-foreground">Deactivate enrollment on full refund</p>
            </div>
            <Switch checked={revoke} onCheckedChange={setRevoke} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={submitting} variant="destructive">
            {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Process refund
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
