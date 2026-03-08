import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Search } from "lucide-react";
import { formatCurrency } from "@/components/CurrencyInput";
import { format } from "date-fns";
import { useDebounce } from "@/hooks/use-debounce";

const SalesPage = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["sales_orders", debouncedSearch],
    queryFn: async () => {
      let query = supabase
        .from("sales_orders")
        .select("*, customers(name)")
        .order("created_at", { ascending: false });

      if (debouncedSearch.trim()) {
        query = query.ilike("code", `%${debouncedSearch.trim()}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Hóa đơn bán hàng</h1>
        <Button onClick={() => navigate("/sales/new")}>
          <Plus className="h-4 w-4 mr-2" />
          Tạo đơn hàng
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Tìm theo mã hóa đơn..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Table */}
      <div className="border rounded-lg bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Mã hóa đơn</TableHead>
              <TableHead>Thời gian</TableHead>
              <TableHead>Khách hàng</TableHead>
              <TableHead>Phương thức</TableHead>
              <TableHead className="text-right">Tổng tiền</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 5 }).map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : orders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                  {debouncedSearch ? "Không tìm thấy hóa đơn" : "Chưa có hóa đơn nào"}
                </TableCell>
              </TableRow>
            ) : (
              orders.map((order: any) => (
                <TableRow key={order.id}>
                  <TableCell className="font-mono font-medium">{order.code}</TableCell>
                  <TableCell>{format(new Date(order.created_at), "dd/MM/yyyy HH:mm")}</TableCell>
                  <TableCell>{order.customers?.name || "Khách lẻ"}</TableCell>
                  <TableCell>
                    {order.payment_method === "cash" ? "Tiền mặt" : "Chuyển khoản"}
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {formatCurrency(order.total_amount)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default SalesPage;
