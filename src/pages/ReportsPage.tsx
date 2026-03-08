import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";
import { DollarSign, TrendingUp, Package, AlertTriangle } from "lucide-react";

const formatVND = (n: number) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(n);

const CHART_COLORS = [
  "hsl(211, 90%, 42%)",
  "hsl(43, 96%, 56%)",
  "hsl(142, 72%, 40%)",
  "hsl(0, 72%, 51%)",
  "hsl(280, 60%, 50%)",
  "hsl(190, 80%, 45%)",
];

type Period = "today" | "7days" | "30days" | "all";

function getDateFilter(period: Period): string | null {
  const now = new Date();
  if (period === "today") {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  }
  if (period === "7days") {
    const d = new Date(now);
    d.setDate(d.getDate() - 7);
    return d.toISOString();
  }
  if (period === "30days") {
    const d = new Date(now);
    d.setDate(d.getDate() - 30);
    return d.toISOString();
  }
  return null;
}

const ReportsPage = () => {
  const [period, setPeriod] = useState<Period>("30days");
  const dateFrom = getDateFilter(period);

  // Sales orders
  const { data: salesOrders = [] } = useQuery({
    queryKey: ["report_sales", period],
    queryFn: async () => {
      let q = supabase.from("sales_orders").select("*").order("created_at", { ascending: false });
      if (dateFrom) q = q.gte("created_at", dateFrom);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  // Sales order items with product info
  const { data: salesItems = [] } = useQuery({
    queryKey: ["report_sales_items", period],
    queryFn: async () => {
      const orderIds = salesOrders.map((o) => o.id);
      if (orderIds.length === 0) return [];
      const { data, error } = await supabase
        .from("sales_order_items")
        .select("*, products:product_id(code, name, cost_price)")
        .in("sales_order_id", orderIds);
      if (error) throw error;
      return data;
    },
    enabled: salesOrders.length > 0,
  });

  // Import orders
  const { data: importOrders = [] } = useQuery({
    queryKey: ["report_imports", period],
    queryFn: async () => {
      let q = supabase.from("import_orders").select("*").order("created_at", { ascending: false });
      if (dateFrom) q = q.gte("created_at", dateFrom);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  // Products for inventory
  const { data: products = [] } = useQuery({
    queryKey: ["report_products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*, categories:category_id(name)")
        .order("stock_quantity", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  // KPIs
  const totalRevenue = salesOrders.reduce((s, o) => s + Number(o.total_amount), 0);
  const totalImportCost = importOrders.reduce((s, o) => s + Number(o.total_amount), 0);

  const totalCOGS = salesItems.reduce((s, item) => {
    const costPrice = (item.products as any)?.cost_price || 0;
    return s + item.quantity * Number(costPrice);
  }, 0);
  const grossProfit = totalRevenue - totalCOGS;

  const totalStock = products.reduce((s, p) => s + p.stock_quantity, 0);
  const lowStockProducts = products.filter((p) => p.stock_quantity <= 5 && p.stock_quantity > 0);
  const outOfStockProducts = products.filter((p) => p.stock_quantity === 0);

  // Revenue by day chart
  const revenueByDay = salesOrders.reduce<Record<string, number>>((acc, o) => {
    const day = new Date(o.created_at).toLocaleDateString("vi-VN");
    acc[day] = (acc[day] || 0) + Number(o.total_amount);
    return acc;
  }, {});
  const revenueChartData = Object.entries(revenueByDay)
    .map(([date, revenue]) => ({ date, revenue }))
    .reverse()
    .slice(-14);

  // Top products by quantity sold
  const productSales = salesItems.reduce<Record<string, { name: string; qty: number; revenue: number }>>((acc, item) => {
    const name = (item.products as any)?.name || "N/A";
    if (!acc[item.product_id]) acc[item.product_id] = { name, qty: 0, revenue: 0 };
    acc[item.product_id].qty += item.quantity;
    acc[item.product_id].revenue += item.quantity * Number(item.unit_price);
    return acc;
  }, {});
  const topProducts = Object.values(productSales)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 6);

  // Inventory by category pie chart
  const inventoryByCategory = products.reduce<Record<string, number>>((acc, p) => {
    const cat = (p.categories as any)?.name || "Chưa phân loại";
    acc[cat] = (acc[cat] || 0) + p.stock_quantity;
    return acc;
  }, {});
  const pieData = Object.entries(inventoryByCategory).map(([name, value]) => ({ name, value }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Báo cáo</h1>
        <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Hôm nay</SelectItem>
            <SelectItem value="7days">7 ngày qua</SelectItem>
            <SelectItem value="30days">30 ngày qua</SelectItem>
            <SelectItem value="all">Tất cả</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Doanh thu</CardTitle>
            <DollarSign className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatVND(totalRevenue)}</p>
            <p className="text-xs text-muted-foreground">{salesOrders.length} đơn hàng</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Lợi nhuận gộp</CardTitle>
            <TrendingUp className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatVND(grossProfit)}</p>
            <p className="text-xs text-muted-foreground">
              Tỷ suất: {totalRevenue > 0 ? ((grossProfit / totalRevenue) * 100).toFixed(1) : 0}%
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Nhập hàng</CardTitle>
            <Package className="h-4 w-4 text-accent-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatVND(totalImportCost)}</p>
            <p className="text-xs text-muted-foreground">{importOrders.length} phiếu nhập</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Tồn kho</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totalStock.toLocaleString("vi-VN")}</p>
            <p className="text-xs text-muted-foreground">
              {outOfStockProducts.length} hết hàng · {lowStockProducts.length} sắp hết
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Doanh thu theo ngày</CardTitle>
          </CardHeader>
          <CardContent>
            {revenueChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={revenueChartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="date" fontSize={11} className="fill-muted-foreground" />
                  <YAxis fontSize={11} className="fill-muted-foreground" tickFormatter={(v) => `${(v / 1000000).toFixed(1)}M`} />
                  <Tooltip formatter={(v: number) => formatVND(v)} labelFormatter={(l) => `Ngày ${l}`} />
                  <Bar dataKey="revenue" fill="hsl(211, 90%, 42%)" radius={[4, 4, 0, 0]} name="Doanh thu" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-muted-foreground py-10">Chưa có dữ liệu</p>
            )}
          </CardContent>
        </Card>

        {/* Inventory Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tồn kho theo nhóm</CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" outerRadius={100} dataKey="value" nameKey="name" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={11}>
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Legend />
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-muted-foreground py-10">Chưa có dữ liệu</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Products & Low Stock */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sản phẩm bán chạy</CardTitle>
          </CardHeader>
          <CardContent>
            {topProducts.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sản phẩm</TableHead>
                    <TableHead className="text-right">SL bán</TableHead>
                    <TableHead className="text-right">Doanh thu</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topProducts.map((p, i) => (
                    <TableRow key={i}>
                      <TableCell>{p.name}</TableCell>
                      <TableCell className="text-right">{p.qty}</TableCell>
                      <TableCell className="text-right">{formatVND(p.revenue)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-center text-muted-foreground py-6">Chưa có dữ liệu bán hàng</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sản phẩm sắp hết / hết hàng</CardTitle>
          </CardHeader>
          <CardContent>
            {[...outOfStockProducts, ...lowStockProducts].length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mã SP</TableHead>
                    <TableHead>Tên</TableHead>
                    <TableHead className="text-right">Tồn kho</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...outOfStockProducts, ...lowStockProducts].slice(0, 10).map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-mono">{p.code}</TableCell>
                      <TableCell>{p.name}</TableCell>
                      <TableCell className="text-right">
                        <span className={p.stock_quantity === 0 ? "text-destructive font-bold" : "text-accent-foreground font-medium"}>
                          {p.stock_quantity}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-center text-muted-foreground py-6">Tất cả sản phẩm đều đủ hàng</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ReportsPage;
