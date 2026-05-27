import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { toast } from "sonner";
import { Search, UserMinus, Download, Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  batchId: string;
  batchName: string;
}

export function BatchStudentsDialog({ open, onOpenChange, batchId, batchName }: Props) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["batch-students", batchId],
    enabled: open && !!batchId,
    queryFn: async () => {
      const { data: enrollments, error } = await supabase
        .from("batch_enrollments")
        .select("id, user_id, enrolled_at, enrollment_type, payment_status, is_active, expires_at")
        .eq("batch_id", batchId)
        .order("enrolled_at", { ascending: false });
      if (error) throw error;
      const userIds = enrollments?.map((e) => e.user_id) || [];
      if (!userIds.length) return [];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, phone, roll_number")
        .in("id", userIds);
      const profMap = new Map(profiles?.map((p) => [p.id, p]) || []);
      return (enrollments || []).map((e) => ({ ...e, profile: profMap.get(e.user_id) }));
    },
  });

  const filtered = (data || []).filter((row: any) => {
    const q = search.toLowerCase();
    return (
      !q ||
      row.profile?.full_name?.toLowerCase().includes(q) ||
      row.profile?.roll_number?.toLowerCase().includes(q) ||
      row.profile?.phone?.toLowerCase().includes(q)
    );
  });

  const removeEnrollment = async (id: string) => {
    if (!confirm("Deactivate this student's enrollment?")) return;
    const { error } = await supabase
      .from("batch_enrollments")
      .update({ is_active: false })
      .eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Enrollment deactivated");
      refetch();
      qc.invalidateQueries({ queryKey: ["batches"] });
    }
  };

  const exportCsv = () => {
    const header = "Name,Roll No,Phone,Enrolled At,Type,Payment,Active,Expires\n";
    const rows = filtered
      .map(
        (r: any) =>
          `"${r.profile?.full_name || ""}","${r.profile?.roll_number || ""}","${r.profile?.phone || ""}","${r.enrolled_at || ""}","${r.enrollment_type || ""}","${r.payment_status || ""}","${r.is_active}","${r.expires_at || ""}"`,
      )
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${batchName.replace(/\s+/g, "_")}_students.csv`;
    a.click();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Enrolled Students — {batchName}</DialogTitle>
        </DialogHeader>
        <div className="flex items-center gap-2 mb-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, roll no, phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Badge variant="secondary">{filtered.length} students</Badge>
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <Download className="w-4 h-4 mr-1" /> CSV
          </Button>
        </div>
        <ScrollArea className="h-[60vh]">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Roll No</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Enrolled</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((row: any) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.profile?.full_name || "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{row.profile?.roll_number || "—"}</TableCell>
                    <TableCell>{row.profile?.phone || "—"}</TableCell>
                    <TableCell>{row.enrolled_at ? format(new Date(row.enrolled_at), "MMM d, yyyy") : "—"}</TableCell>
                    <TableCell><Badge variant="outline">{row.enrollment_type || "—"}</Badge></TableCell>
                    <TableCell>{row.payment_status || "—"}</TableCell>
                    <TableCell>
                      {row.is_active ? (
                        <Badge className="bg-primary/20 text-primary">Active</Badge>
                      ) : (
                        <Badge variant="secondary">Inactive</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {row.expires_at ? format(new Date(row.expires_at), "MMM d, yyyy") : "—"}
                    </TableCell>
                    <TableCell>
                      {row.is_active && (
                        <Button variant="ghost" size="sm" onClick={() => removeEnrollment(row.id)}>
                          <UserMinus className="w-4 h-4 text-destructive" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {!filtered.length && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                      No students enrolled yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
