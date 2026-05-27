import { useState } from "react";
import AdminLayout from "@/components/layout/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  IndianRupee, 
  TrendingUp, 
  TrendingDown,
  CreditCard, 
  Receipt,
  Download,
  Search,
  RefreshCw
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { CouponManager } from "@/components/admin/CouponManager";
import { RefundDialog } from "@/components/admin/RefundDialog";

export default function FinanceDashboard() {
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFilter, setDateFilter] = useState("all");
  const [refundTarget, setRefundTarget] = useState<any>(null);

  // Fetch payments
  const { data: payments, isLoading: paymentsLoading, refetch } = useQuery({
    queryKey: ['admin-payments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payments')
        .select(`
          *,
          batches (name)
        `)
        .order('created_at', { ascending: false })
        .limit(500);
      
      if (error) throw error;
      return data;
    },
  });

  const exportCsv = () => {
    if (!payments?.length) return;
    const header = "Transaction ID,Batch,User ID,Amount,Currency,Status,Method,Refund Amount,Refunded At,Created At\n";
    const rows = payments
      .map(
        (p: any) =>
          `"${p.transaction_id || p.id}","${p.batches?.name || ""}","${p.user_id}","${p.amount}","${p.currency || "INR"}","${p.status || ""}","${p.payment_method || ""}","${p.refund_amount || ""}","${p.refunded_at || ""}","${p.created_at || ""}"`,
      )
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `transactions_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  // Calculate stats
  const stats = {
    totalRevenue: payments?.filter(p => p.status === 'completed').reduce((acc, p) => acc + Number(p.amount), 0) || 0,
    pendingPayments: payments?.filter(p => p.status === 'pending').length || 0,
    totalTransactions: payments?.length || 0,
    refunds: payments?.filter(p => p.refund_amount).reduce((acc, p) => acc + Number(p.refund_amount || 0), 0) || 0,
  };

  const filteredPayments = payments?.filter(payment => {
    const matchesSearch = 
      payment.transaction_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.batches?.name?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-primary/20 text-primary">Completed</Badge>;
      case 'pending':
        return <Badge variant="secondary">Pending</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      case 'refunded':
        return <Badge variant="outline">Refunded</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
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
              <h1 className="text-3xl font-bold mb-2">Finance Dashboard</h1>
              <p className="text-muted-foreground">
                Revenue, payments, and financial analytics
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={exportCsv} disabled={!payments?.length}>
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
              <Button variant="outline" onClick={() => refetch()}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                <IndianRupee className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold flex items-center">
                  <IndianRupee className="w-5 h-5" />
                  {stats.totalRevenue.toLocaleString('en-IN')}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  <TrendingUp className="w-3 h-3 inline mr-1 text-primary" />
                  All time revenue
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Pending Payments</CardTitle>
                <CreditCard className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.pendingPayments}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Awaiting confirmation
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Transactions</CardTitle>
                <Receipt className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalTransactions}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  All payment records
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Refunds</CardTitle>
                <TrendingDown className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold flex items-center">
                  <IndianRupee className="w-5 h-5" />
                  {stats.refunds.toLocaleString('en-IN')}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Amount refunded
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="transactions" className="space-y-4">
            <TabsList>
              <TabsTrigger value="transactions">Transactions</TabsTrigger>
              <TabsTrigger value="refunds">Refunds</TabsTrigger>
              <TabsTrigger value="coupons">Coupons</TabsTrigger>
            </TabsList>

            <TabsContent value="transactions" className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Payment Transactions</CardTitle>
                      <CardDescription>All payment records</CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          placeholder="Search..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="pl-9 w-[200px]"
                        />
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Transaction ID</TableHead>
                        <TableHead>Batch</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredPayments?.map((payment) => (
                        <TableRow key={payment.id}>
                          <TableCell className="font-mono text-xs">
                            {payment.transaction_id || payment.id.slice(0, 8)}
                          </TableCell>
                          <TableCell>{payment.batches?.name || 'N/A'}</TableCell>
                          <TableCell>
                            <div className="flex items-center"><IndianRupee className="w-3 h-3" />{Number(payment.amount).toLocaleString('en-IN')}</div>
                            {payment.refund_amount ? (
                              <div className="text-xs text-destructive flex items-center">refunded <IndianRupee className="w-2 h-2 ml-1" />{Number(payment.refund_amount).toLocaleString('en-IN')}</div>
                            ) : null}
                          </TableCell>
                          <TableCell>{getStatusBadge(payment.status)}</TableCell>
                          <TableCell className="capitalize">
                            {payment.payment_method || 'N/A'}
                          </TableCell>
                          <TableCell>
                            {format(new Date(payment.created_at!), 'MMM d, yyyy')}
                          </TableCell>
                          <TableCell>
                            {payment.status === 'completed' && !payment.refund_amount && (
                              <Button variant="ghost" size="sm" onClick={() => setRefundTarget(payment)}>
                                <TrendingDown className="w-4 h-4 mr-1" /> Refund
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                      {(!filteredPayments || filteredPayments.length === 0) && (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                            No transactions found
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="refunds">
              <Card>
                <CardHeader>
                  <CardTitle>Refunds</CardTitle>
                  <CardDescription>All processed refunds</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Txn</TableHead>
                        <TableHead>Batch</TableHead>
                        <TableHead>Original</TableHead>
                        <TableHead>Refunded</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payments?.filter((p) => p.refund_amount).map((p) => (
                        <TableRow key={p.id}>
                          <TableCell className="font-mono text-xs">{p.transaction_id || p.id.slice(0, 8)}</TableCell>
                          <TableCell>{p.batches?.name || "—"}</TableCell>
                          <TableCell><div className="flex items-center"><IndianRupee className="w-3 h-3" />{Number(p.amount).toLocaleString("en-IN")}</div></TableCell>
                          <TableCell className="text-destructive"><div className="flex items-center"><IndianRupee className="w-3 h-3" />{Number(p.refund_amount).toLocaleString("en-IN")}</div></TableCell>
                          <TableCell className="max-w-xs truncate">{p.refund_reason || "—"}</TableCell>
                          <TableCell>{p.refunded_at ? format(new Date(p.refunded_at), "MMM d, yyyy") : "—"}</TableCell>
                        </TableRow>
                      ))}
                      {!payments?.some((p) => p.refund_amount) && (
                        <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No refunds yet.</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="coupons">
              <Card className="p-6">
                <CouponManager />
              </Card>
            </TabsContent>
          </Tabs>

          {refundTarget && (
            <RefundDialog
              open={!!refundTarget}
              onOpenChange={(o) => !o && setRefundTarget(null)}
              payment={refundTarget}
              onDone={() => refetch()}
            />
          )}
        </motion.div>
      </div>
    </AdminLayout>
  );
}
