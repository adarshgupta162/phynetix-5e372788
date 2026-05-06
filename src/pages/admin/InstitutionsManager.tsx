import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/layout/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Copy, Users, Building2, Loader2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";

export default function InstitutionsManager() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", slug: "", contact_email: "", contact_phone: "" });
  const [membersFor, setMembersFor] = useState<string | null>(null);

  const { data: institutions, isLoading } = useQuery({
    queryKey: ["institutions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("institutions" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const createInst = useMutation({
    mutationFn: async () => {
      if (!form.name.trim() || !form.slug.trim()) throw new Error("Name and slug required");
      const { data, error } = await supabase
        .from("institutions" as any)
        .insert({ ...form, slug: form.slug.toLowerCase().replace(/[^a-z0-9-]/g, "-") })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Institution created");
      qc.invalidateQueries({ queryKey: ["institutions"] });
      setOpen(false);
      setForm({ name: "", slug: "", contact_email: "", contact_phone: "" });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("institutions" as any).update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["institutions"] }),
  });

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success("Code copied");
  };

  return (
    <AdminLayout>
      <div className="p-6 space-y-6 max-w-6xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Building2 className="w-6 h-6" /> Institutions
            </h1>
            <p className="text-sm text-muted-foreground">Grant platform access to other coaching institutes. Their batches, students, and private library stay isolated from yours.</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="w-4 h-4 mr-2" />New Institution</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create Institution</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                <div><Label>Slug</Label><Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="acme-coaching" /></div>
                <div><Label>Contact email</Label><Input value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} /></div>
                <div><Label>Contact phone</Label><Input value={form.contact_phone} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} /></div>
              </div>
              <DialogFooter>
                <Button onClick={() => createInst.mutate()} disabled={createInst.isPending}>
                  {createInst.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Create
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="text-muted-foreground">Loading…</div>
        ) : institutions && institutions.length > 0 ? (
          <div className="grid gap-4">
            {institutions.map((i) => (
              <Card key={i.id}>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {i.name}
                      <Badge variant={i.is_active ? "default" : "secondary"}>{i.is_active ? "Active" : "Disabled"}</Badge>
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">/{i.slug} · {i.contact_email || "no email"}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={i.is_active} onCheckedChange={(v) => toggleActive.mutate({ id: i.id, is_active: v })} />
                  </div>
                </CardHeader>
                <CardContent className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-2 px-3 py-1 rounded-md border bg-muted/30">
                    <span className="text-xs text-muted-foreground">Institution code</span>
                    <code className="font-mono text-sm">{i.code}</code>
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => copyCode(i.code)}>
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setMembersFor(i.id)}>
                    <Users className="w-4 h-4 mr-2" />Manage Staff
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card><CardContent className="py-12 text-center text-muted-foreground">No institutions yet. Create one to give an institute access.</CardContent></Card>
        )}

        {membersFor && <MembersDialog institutionId={membersFor} onClose={() => setMembersFor(null)} />}
      </div>
    </AdminLayout>
  );
}

function MembersDialog({ institutionId, onClose }: { institutionId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("admin");

  const { data: members } = useQuery({
    queryKey: ["inst-members", institutionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("institution_members" as any)
        .select("*, profiles:user_id(full_name)")
        .eq("institution_id", institutionId);
      if (error) throw error;
      return data as any[];
    },
  });

  const addMember = useMutation({
    mutationFn: async () => {
      // find user by email via auth admin not available client-side — look up profile by email match in user_roles fallback isn't possible.
      // We use a simple RPC: assume admin pastes user_id. But friendlier: we look up profiles table join via auth.users — not accessible.
      // Fallback approach: require user_id (admin-only flow).
      const userId = email.trim();
      if (!userId) throw new Error("Paste user ID");
      const { error } = await supabase.from("institution_members" as any).insert({
        institution_id: institutionId,
        user_id: userId,
        role,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Member added");
      qc.invalidateQueries({ queryKey: ["inst-members", institutionId] });
      setEmail("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const removeMember = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("institution_members" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["inst-members", institutionId] }),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Institution Staff</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="flex gap-2">
            <Input placeholder="User ID (UUID)" value={email} onChange={(e) => setEmail(e.target.value)} />
            <select className="border rounded px-2" value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="admin">Admin</option>
              <option value="teacher">Teacher</option>
              <option value="staff">Staff</option>
            </select>
            <Button onClick={() => addMember.mutate()} disabled={addMember.isPending}>Add</Button>
          </div>
          <p className="text-xs text-muted-foreground">Tip: Get the user's UUID from Admin → Users. The institution admin can then invite their own teachers.</p>
          <div className="space-y-2">
            {members?.map((m) => (
              <div key={m.id} className="flex items-center justify-between border rounded p-2">
                <div>
                  <div className="font-medium text-sm">{m.profiles?.full_name || m.user_id}</div>
                  <div className="text-xs text-muted-foreground">{m.role}</div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => removeMember.mutate(m.id)}>Remove</Button>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
