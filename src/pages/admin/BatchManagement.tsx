import { useState } from "react";
import { Link } from "react-router-dom";
import AdminLayout from "@/components/layout/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Package, 
  Plus, 
  Edit,
  Trash2,
  Eye,
  Search,
  IndianRupee,
  Users,
  MoreHorizontal,
  FileText,
  Link2,
  Users2
} from "lucide-react";
import { useAllBatches, useDeleteBatch, type Batch } from "@/hooks/useBatches";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { BatchEditorDialog } from "@/components/admin/BatchEditorDialog";
import { BatchTestsManager } from "@/components/admin/BatchTestsManager";
import { BatchStudentsDialog } from "@/components/admin/BatchStudentsDialog";

const categoryLabels: Record<string, string> = {
  jee_main: "JEE Main",
  jee_advanced: "JEE Advanced",
  jee_main_advanced: "JEE Main + Advanced",
  neet: "NEET",
  bitsat: "BITSAT",
  mht_cet: "MHT-CET",
  foundation: "Foundation",
};

export default function BatchManagement() {
  const [searchTerm, setSearchTerm] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingBatch, setEditingBatch] = useState<Batch | null>(null);
  const [testsManagerBatch, setTestsManagerBatch] = useState<Batch | null>(null);
  const [studentsBatch, setStudentsBatch] = useState<Batch | null>(null);
  
  const { data: batches, isLoading } = useAllBatches();
  const deleteBatch = useDeleteBatch();

  const filteredBatches = batches?.filter(batch => {
    return batch.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      batch.category?.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const handleDelete = async () => {
    if (!deleteId) return;
    
    try {
      await deleteBatch.mutateAsync(deleteId);
      toast.success("Batch deleted successfully");
    } catch (error: any) {
      toast.error(error.message || "Failed to delete batch");
    } finally {
      setDeleteId(null);
    }
  };

  const stats = {
    totalBatches: batches?.length || 0,
    activeBatches: batches?.filter(b => b.is_active).length || 0,
    featuredBatches: batches?.filter(b => b.is_featured).length || 0,
    totalStudents: batches?.reduce((acc, b) => acc + (b.current_students || 0), 0) || 0,
  };

  return (
    <AdminLayout>
      <div className="p-6 md:p-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold mb-2">Batch Management</h1>
              <p className="text-muted-foreground">
                Create and manage course batches
              </p>
            </div>
            <Button onClick={() => { setEditingBatch(null); setEditorOpen(true); }}>
              <Plus className="w-4 h-4 mr-2" />
              Create Batch
            </Button>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Batches</CardTitle>
                <Package className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalBatches}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Active</CardTitle>
                <Package className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-primary">{stats.activeBatches}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Featured</CardTitle>
                <Package className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.featuredBatches}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Enrollments</CardTitle>
                <Users className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalStudents}</div>
              </CardContent>
            </Card>
          </div>

          {/* Batches Table */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>All Batches</CardTitle>
                  <CardDescription>Manage your course batches</CardDescription>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search batches..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 w-[200px]"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Students</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBatches?.map((batch) => (
                    <TableRow key={batch.id}>
                      <TableCell>
                        <div className="font-medium">{batch.name}</div>
                        {batch.is_featured && (
                          <Badge variant="secondary" className="mt-1 text-xs">Featured</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {categoryLabels[batch.category || ''] || batch.category}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center">
                          <IndianRupee className="w-3 h-3" />
                          {batch.price.toLocaleString('en-IN')}
                        </div>
                        {batch.original_price && batch.original_price > batch.price && (
                          <span className="text-xs text-muted-foreground line-through flex items-center">
                            <IndianRupee className="w-2 h-2" />
                            {batch.original_price.toLocaleString('en-IN')}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {batch.current_students || 0}
                          {batch.max_students && (
                            <span className="text-muted-foreground">/ {batch.max_students}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {batch.is_active ? (
                          <Badge className="bg-primary/20 text-primary">Active</Badge>
                        ) : (
                          <Badge variant="secondary">Inactive</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {format(new Date(batch.created_at!), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link to={`/batches/${batch.id}`}>
                                <Eye className="w-4 h-4 mr-2" />
                                View
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => { setEditingBatch(batch); setEditorOpen(true); }}>
                              <Edit className="w-4 h-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setStudentsBatch(batch)}>
                              <Users2 className="w-4 h-4 mr-2" />
                              View Students ({batch.current_students || 0})
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setTestsManagerBatch(batch)}>
                              <Link2 className="w-4 h-4 mr-2" />
                              Manage Tests
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              className="text-destructive"
                              onClick={() => setDeleteId(batch.id)}
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!filteredBatches || filteredBatches.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        No batches found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Batch Editor Dialog */}
          <BatchEditorDialog 
            open={editorOpen}
            onOpenChange={setEditorOpen}
            batch={editingBatch}
          />

          {/* Batch Tests Manager */}
          {testsManagerBatch && (
            <BatchTestsManager
              open={!!testsManagerBatch}
              onOpenChange={(open) => !open && setTestsManagerBatch(null)}
              batchId={testsManagerBatch.id}
              batchName={testsManagerBatch.name}
            />
          )}

          {studentsBatch && (
            <BatchStudentsDialog
              open={!!studentsBatch}
              onOpenChange={(open) => !open && setStudentsBatch(null)}
              batchId={studentsBatch.id}
              batchName={studentsBatch.name}
            />
          )}

          {/* Delete Confirmation */}
          <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Batch</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete this batch? This action cannot be undone.
                  All enrollments and related data will be affected.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </motion.div>
      </div>
    </AdminLayout>
  );
}
