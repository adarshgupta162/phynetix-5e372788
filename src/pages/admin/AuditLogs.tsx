import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { History, Search, Filter, User, FileText, Settings, Shield, Undo2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import AdminLayout from "@/components/layout/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { format } from "date-fns";

interface AuditLog {
  id: string;
  user_id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  old_value: any;
  new_value: any;
  created_at: string;
}

const actionIcons: Record<string, React.ElementType> = {
  create_user: User,
  update_user: User,
  delete_user: User,
  create_test: FileText,
  update_test: FileText,
  delete_test: FileText,
  update_settings: Settings,
  update_role: Shield,
  bulk_import: FileText,
  bulk_import_revert: FileText,
};

const actionColors: Record<string, string> = {
  create: 'bg-green-500/10 text-green-500',
  update: 'bg-blue-500/10 text-blue-500',
  delete: 'bg-red-500/10 text-red-500',
};

export default function AuditLogs() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [filterAction, setFilterAction] = useState<string>("all");
  const [filterEntity, setFilterEntity] = useState<string>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [revertingId, setRevertingId] = useState<string | null>(null);
  const [revertedSet, setRevertedSet] = useState<Set<string>>(new Set());

  const computeReverted = (allLogs: AuditLog[]) => {
    const reverted = new Set<string>();
    allLogs.forEach(l => {
      if (l.action === 'bulk_import_revert') {
        const target = l.new_value?.reverted_log_id || l.new_value?.original_log_id;
        if (target) reverted.add(target);
      }
    });
    return reverted;
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const handleRevertImport = async (log: AuditLog) => {
    if (!user) return;
    const ids: string[] = log.new_value?.question_ids || [];
    if (!ids.length) return toast.error("No question IDs in this log");
    if (!confirm(`Revert this import? ${ids.length} questions will be deleted from the library.`)) return;

    setRevertingId(log.id);
    const { error } = await supabase.from('phynetix_library').delete().in('id', ids);
    if (error) {
      toast.error("Failed to revert: " + error.message);
    } else {
      await supabase.from('audit_logs').insert({
        user_id: user.id,
        action: 'bulk_import_revert',
        entity_type: 'phynetix_library',
        new_value: { count: ids.length, question_ids: ids, reverted_log_id: log.id },
      } as any);
      toast.success(`Reverted ${ids.length} questions`);
      fetchLogs();
    }
    setRevertingId(null);
  };

  const fetchLogs = async () => {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (!error && data) {
      setLogs(data);
      // Fetch profiles
      const userIds = [...new Set(data.map(l => l.user_id))];
      await fetchProfiles(userIds);
    }
    setIsLoading(false);
  };

  const fetchProfiles = async (userIds: string[]) => {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', userIds);
    
    if (data) {
      const profileMap: Record<string, string> = {};
      data.forEach(p => {
        profileMap[p.id] = p.full_name || 'Unknown';
      });
      setProfiles(profileMap);
    }
  };

  const getActionType = (action: string): string => {
    if (action.startsWith('create')) return 'create';
    if (action.startsWith('update')) return 'update';
    if (action.startsWith('delete')) return 'delete';
    return 'update';
  };

  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.entity_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (profiles[log.user_id] || '').toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesAction = filterAction === 'all' || log.action.includes(filterAction);
    const matchesEntity = filterEntity === 'all' || log.entity_type === filterEntity;

    return matchesSearch && matchesAction && matchesEntity;
  });

  const uniqueEntities = [...new Set(logs.map(l => l.entity_type))];

  return (
    <AdminLayout>
      <div className="p-6 lg:p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl lg:text-3xl font-bold font-display mb-1">
            Audit <span className="gradient-text">Logs</span>
          </h1>
          <p className="text-muted-foreground">
            Track all changes and activities in the system
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              placeholder="Search logs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-12"
            />
          </div>
          <Select value={filterAction} onValueChange={setFilterAction}>
            <SelectTrigger className="w-[150px]">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Action" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Actions</SelectItem>
              <SelectItem value="create">Create</SelectItem>
              <SelectItem value="update">Update</SelectItem>
              <SelectItem value="delete">Delete</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterEntity} onValueChange={setFilterEntity}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Entity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Entities</SelectItem>
              {uniqueEntities.map(entity => (
                <SelectItem key={entity} value={entity}>
                  {entity.charAt(0).toUpperCase() + entity.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Logs List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="glass-card p-12 text-center">
            <History className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">No logs found</h3>
            <p className="text-muted-foreground">Activity logs will appear here</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredLogs.map((log, index) => {
              const Icon = actionIcons[log.action] || History;
              const actionType = getActionType(log.action);
              
              return (
                <motion.div
                  key={log.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.02 }}
                  className="glass-card p-4"
                >
                  <div className="flex items-start gap-4">
                    <div className={`p-2 rounded-lg ${actionColors[actionType] || 'bg-muted'}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-medium">
                            {profiles[log.user_id] || 'Unknown User'}
                          </span>
                          <span className="text-muted-foreground mx-2">•</span>
                          <span className="text-muted-foreground">
                            {log.action.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {format(new Date(log.created_at), 'MMM d, yyyy HH:mm')}
                        </span>
                      </div>
                      <div className="mt-2 text-sm text-muted-foreground">
                        <span className="font-medium">Entity:</span> {log.entity_type}
                        {log.entity_id && (
                          <>
                            <span className="mx-2">•</span>
                            <span className="font-mono text-xs">{log.entity_id}</span>
                          </>
                        )}
                      </div>
                      {log.new_value && (
                        <div className="mt-2 p-2 bg-muted/50 rounded text-xs font-mono overflow-x-auto">
                          {JSON.stringify(log.new_value, null, 2)}
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
