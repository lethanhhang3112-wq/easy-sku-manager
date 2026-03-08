import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Bar, BarChart, XAxis, YAxis, CartesianGrid } from "recharts";
import { DollarSign, ShoppingCart, PackagePlus, AlertTriangle } from "lucide-react";
import { formatCurrency } from "@/components/CurrencyInput";
import { startOfDay, endOfDay, subDays, format } from "date-fns";

const fetchDashboardData = async () => {
  const now = new Date();
  const todayStart = startOfDay(now).toISOString();
  const todayEnd = endOfDay(now).toISOString();
  const sevenDaysAgo = startOfDay(subDays(now, 6)).toISOString();

  const [salesToday, importToday, lowStock, recentSales, last7DaysSales] = await Promise.all([
    supabase.from("sales_orders").select("total_amount").gte("created_at", todayStart).lte("created_at", todayEnd),
    supabase.from("import_orders").select("total_amount").gte("created_at", todayStart).lte("created_at", todayEnd),
    supabase.from("products").select("id, code, name, stock_quantity").lte("stock_quantity", 5).order("stock_quantity", { ascending: true }),
    supabase.from("sales_orders").select("id, code, created_at, total_amount, customers(name)").order("created_at", { ascending: false }).limit(5),
    supabase.from("sales_orders").select("total_amount, created_at").gte("created_at", sevenDaysAgo).lte("created_at", todayEnd),
  ]);

  const todayRevenue = (salesToday.data || []).reduce((s, o) => s + Number(o.total_amount), 0);
  const todayOrderCount = (salesToday.data || []).length;
  const todayImportTotal = (importToday.data || []).reduce((s, o) => s + Number(o.total_amount), 0);
  const lowStockProducts = lowStock.data || [];
  const recentOrders = recentSales.data || [];

  // Group last 7 days revenue by date
  const revenueByDay: Record<string, number> = {};
  for (let i = 6; i >= 0; i--) {
    const d = subDays(now, i);
    revenueByDay[format(d, "dd/MM")] = 0;
  }
  for (const order of last7DaysSales.data || []) {
    const key = format(new Date(order.created_at), "dd/MM");
    if (key in revenueByDay) revenueByDay[key] += Number(order.total_amount);
  }
  const chartData = Object.entries(revenueByDay).map(([date, revenue]) => ({ date, revenue }));

  return { todayRevenue, todayOrderCount, todayImportTotal, lowStockCount: lowStockProducts.length, lowStockProducts, recentOrders, chartData };
};

const chartConfig = {
  revenue: { label: "Doanh thu", color: "hsl(var(--primary))" },
};

const Index = () => {
  const { data, isLoading } = useQuery({ queryKey: ["dashboard"], queryFn: fetchDashboardData });

  const stats = [
    { title: "Doanh thu hôm nay", value: data ? `${formatCurrency(data.todayRevenue)} ₫` : "—", icon: DollarSign, color: "text-primary" },
    { title: "Đơn hàng hôm nay", value: data ? String(data.todayOrderCount) : "—", icon: ShoppingCart, color: "text-emerald-500" },
    { title: "Tổng nhập hôm nay", value: data ? `${formatCurrency(data.todayImportTotal)} ₫` : "—", icon: PackagePlus, color: "text-blue-500" },
    { title: "Cảnh báo tồn kho", value: data ? String(data.lowStockCount) : "—", icon: AlertTriangle, color: "text-destructive" },
  ];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Tổng quan</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}><CardHeader className="pb-2"><Skeleton className="h-4 w-24" /></CardHeader><CardContent><Skeleton className="h-8 w-32" /></CardContent></Card>
          ))}
        </div>
        <Skeleton className="h-64 w-full rounded-lg" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Skeleton className="h-48 rounded-lg" />
          <Skeleton className="h-48 rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Tổng quan</h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{stat.title}</CardTitle>
              <stat.icon className={`h-5 w-5 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Revenue Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Doanh thu 7 ngày gần nhất</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-64 w-full">
            <BarChart data={data?.chartData} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} tickFormatter={(v) => formatCurrency(v)} width={80} />
              <ChartTooltip content={<ChartTooltipContent formatter={(value) => `${formatCurrency(Number(value))} ₫`} />} />
              <Bar dataKey="revenue" fill="var(--color-revenue)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Bottom Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Low Stock */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Hàng hóa sắp hết</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {data?.lowStockProducts.length === 0 ? (
              <p className="text-sm text-muted-foreground p-6 pt-0">Không có sản phẩm nào sắp hết hàng.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mã hàng</TableHead>
                    <TableHead>Tên hàng</TableHead>
                    <TableHead className="text-right">Tồn kho</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.lowStockProducts.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-mono text-xs">{p.code}</TableCell>
                      <TableCell>{p.name}</TableCell>
                      <TableCell className="text-right font-bold text-destructive">{p.stock_quantity}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Recent Transactions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Giao dịch gần đây</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {data?.recentOrders.length === 0 ? (
              <p className="text-sm text-muted-foreground p-6 pt-0">Chưa có giao dịch nào.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mã HĐ</TableHead>
                    <TableHead>Thời gian</TableHead>
                    <TableHead>Khách hàng</TableHead>
                    <TableHead className="text-right">Tổng tiền</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.recentOrders.map((o: any) => (
                    <TableRow key={o.id}>
                      <TableCell className="font-mono text-xs">{o.code}</TableCell>
                      <TableCell className="text-xs">{format(new Date(o.created_at), "HH:mm dd/MM")}</TableCell>
                      <TableCell>{o.customers?.name || "—"}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(Number(o.total_amount))} ₫</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Index;
