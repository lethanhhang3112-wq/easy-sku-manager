import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { StockAdjustmentModal } from "@/components/StockAdjustmentModal";
import { format, startOfDay, endOfDay, startOfWeek, startOfMonth, startOfQuarter, startOfYear } from "date-fns";
import { vi } from "date-fns/locale";
import {
  PackagePlus, PackageMinus, Package, TrendingUp, CalendarIcon, X, ChevronLeft, ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

// --- Types ---
type LedgerEntry = {
  id: string;
  date: string;
  code: string;
  type: "import" | "sale" | "adjust_in" | "adjust_out";
  partnerName: string;
  quantity: number;
  price: number;
  note?: string;
};

type Product = {
  id: string;
  code: string;
  name: string;
  category_id: string | null;
  cost_price: number;
  sale_price: number;
  stock_quantity: number;
};

type ComputedRow = LedgerEntry & {
  description: string;
  inQty: number;
  outQty: number;
  transactionPrice: number;
  transactionValue: number;
  balanceQty: number;
  balanceMAC: number;
  balanceTotal: number;
  overstock: boolean;
};

const formatVND = (n: number) => new Intl.NumberFormat("vi-VN").format(n);
const ROWS_PER_PAGE = 15;

// --- Data fetching ---
async function fetchStockLedger(productId: string): Promise<LedgerEntry[]> {
  const [importsRes, salesRes, adjustRes] = await Promise.all([
    supabase
      .from("import_order_items")
      .select("id, quantity, unit_cost, import_orders(code, created_at, suppliers(name))")
      .eq("product_id", productId),
    supabase
      .from("sales_order_items")
      .select("id, quantity, unit_price, sales_orders(code, created_at, customers(name))")
      .eq("product_id", productId),
    supabase
      .from("stock_adjustments")
      .select("*")
      .eq("product_id", productId),
  ]);

  if (importsRes.error) throw importsRes.error;
  if (salesRes.error) throw salesRes.error;
  if (adjustRes.error) throw adjustRes.error;

  const importEntries: LedgerEntry[] = (importsRes.data ?? []).map((item: any) => ({
    id: item.id,
    date: item.import_orders?.created_at ?? "",
    code: item.import_orders?.code ?? "",
    type: "import",
    partnerName: item.import_orders?.suppliers?.name ?? "N/A",
    quantity: item.quantity,
    price: item.unit_cost,
  }));

  const saleEntries: LedgerEntry[] = (salesRes.data ?? []).map((item: any) => ({
    id: item.id,
    date: item.sales_orders?.created_at ?? "",
    code: item.sales_orders?.code ?? "",
    type: "sale",
    partnerName: item.sales_orders?.customers?.name ?? "Khách lẻ",
    quantity: -item.quantity,
    price: item.unit_price,
  }));

  const adjustEntries: LedgerEntry[] = (adjustRes.data ?? []).map((item: any) => ({
    id: item.id,
    date: item.created_at,
    code: item.type === "in" ? "ADJ-IN" : "ADJ-OUT",
    type: item.type === "in" ? "adjust_in" : "adjust_out",
    partnerName: "",
    quantity: item.type === "in" ? item.quantity : -item.quantity,
    price: item.unit_price,
    note: item.note,
  }));

  return [...importEntries, ...saleEntries, ...adjustEntries].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
}

// --- Weighted average calculation ---
function computeWeightedAverage(entries: LedgerEntry[]): ComputedRow[] {
  let balanceQty = 0;
  let balanceTotal = 0;

  return entries.map((e) => {
    const isInbound = e.type === "import" || e.type === "adjust_in";
    const qty = Math.abs(e.quantity);
    let inQty = 0, outQty = 0;
    let transactionValue = 0;
    let overstock = false;

    if (isInbound) {
      inQty = qty;
      transactionValue = qty * e.price;
      balanceQty += qty;
      balanceTotal += transactionValue;
    } else {
      outQty = qty;
      if (outQty > balanceQty) overstock = true;
      const avgPriceBefore = balanceQty > 0 ? balanceTotal / balanceQty : 0;
      transactionValue = Math.round(outQty * avgPriceBefore);
      balanceQty -= outQty;
      balanceTotal -= transactionValue;
      if (balanceQty <= 0) { balanceQty = 0; balanceTotal = 0; }
    }

    const balanceAvgPrice = balanceQty > 0 ? Math.round((balanceTotal / balanceQty) * 100) / 100 : 0;

    let description = "";
    switch (e.type) {
      case "import": description = `Nhập từ ${e.partnerName}`; break;
      case "sale": description = `Bán cho ${e.partnerName}`; break;
      case "adjust_in": description = e.note ? `Nhập ĐC: ${e.note}` : "Nhập điều chỉnh"; break;
      case "adjust_out": description = e.note ? `Xuất ĐC: ${e.note}` : "Xuất điều chỉnh"; break;
    }

    return {
      ...e,
      description,
      inQty, outQty,
      transactionValue,
      balanceQty,
      balanceAvgPrice,
      balanceTotal: Math.round(balanceTotal),
      overstock,
    };
  });
}

// --- Badge helpers ---
function TypeBadge({ type }: { type: string }) {
  switch (type) {
    case "import":
      return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100">Nhập hàng</Badge>;
    case "sale":
      return <Badge className="bg-red-100 text-red-700 border-red-200 hover:bg-red-100">Xuất bán</Badge>;
    case "adjust_in":
      return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100">Nhập ĐC</Badge>;
    case "adjust_out":
      return <Badge className="bg-red-100 text-red-700 border-red-200 hover:bg-red-100">Xuất ĐC</Badge>;
    default:
      return <Badge variant="outline">{type}</Badge>;
  }
}

function QtyDisplay({ row }: { row: ComputedRow }) {
  if (row.inQty > 0) return <span className="text-emerald-600 font-semibold">+{row.inQty}</span>;
  if (row.outQty > 0) return <span className="text-destructive font-semibold">-{row.outQty}</span>;
  return <span>0</span>;
}

// --- Mobile Card ---
function MobileCard({ row }: { row: ComputedRow }) {
  return (
    <div className={cn(
      "p-3 border rounded-lg space-y-2",
      row.overstock && "border-destructive/50 bg-destructive/5"
    )}>
      <div className="flex items-center justify-between">
        <span className="text-primary font-mono text-sm font-medium">{row.code}</span>
        <TypeBadge type={row.type} />
      </div>
      <p className="text-xs text-muted-foreground truncate">{row.description}</p>
      <div className="flex items-center justify-between text-sm">
        <div className="space-y-0.5">
          <p className="text-xs text-muted-foreground">Biến động</p>
          <QtyDisplay row={row} />
        </div>
        <div className="text-right space-y-0.5">
          <p className="text-xs text-muted-foreground">Tồn kho</p>
          <span className={cn("font-bold", row.overstock && "text-destructive")}>{row.balanceQty}</span>
        </div>
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{row.date ? format(new Date(row.date), "dd/MM/yyyy HH:mm") : "—"}</span>
        <span>GT: {formatVND(row.transactionValue)}</span>
      </div>
    </div>
  );
}

// --- Main Component ---
export function StockLedgerTab({ product }: { product: Product }) {
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [adjType, setAdjType] = useState<"in" | "out">("in");
  const [adjOpen, setAdjOpen] = useState(false);

  // Filters
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [page, setPage] = useState(1);

  const loadData = () => {
    setLoading(true);
    fetchStockLedger(product.id)
      .then(setEntries)
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, [product.id]);

  // Compute all rows (oldest first for correct balance)
  const allRows = useMemo(() => computeWeightedAverage(entries), [entries]);

  // Filter rows (apply filters AFTER computing running balance so balanceQty stays correct)
  const filteredRows = useMemo(() => {
    let result = allRows;

    if (typeFilter === "in") {
      result = result.filter(r => r.type === "import" || r.type === "adjust_in");
    } else if (typeFilter === "out") {
      result = result.filter(r => r.type === "sale" || r.type === "adjust_out");
    }

    if (startDate) {
      const start = startOfDay(startDate).toISOString();
      result = result.filter(r => r.date >= start);
    }
    if (endDate) {
      const end = endOfDay(endDate).toISOString();
      result = result.filter(r => r.date <= end);
    }

    return result;
  }, [allRows, typeFilter, startDate, endDate]);

  // Reverse for display (newest first) then paginate
  const displayRows = useMemo(() => [...filteredRows].reverse(), [filteredRows]);
  const totalPages = Math.max(1, Math.ceil(displayRows.length / ROWS_PER_PAGE));
  const pagedRows = useMemo(
    () => displayRows.slice((page - 1) * ROWS_PER_PAGE, page * ROWS_PER_PAGE),
    [displayRows, page]
  );

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [typeFilter, startDate, endDate]);

  // Summary stats from full (unfiltered) computed rows
  const lastRow = allRows.length > 0 ? allRows[allRows.length - 1] : null;
  const currentStock = lastRow?.balanceQty ?? product.stock_quantity;
  const stockValue = lastRow?.balanceTotal ?? 0;

  const clearFilters = () => {
    setTypeFilter("all");
    setStartDate(undefined);
    setEndDate(undefined);
  };

  const hasFilters = typeFilter !== "all" || startDate || endDate;

  return (
    <div className="pt-4 space-y-4">
      {/* Header Info Cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="border rounded-lg p-3 flex items-center gap-3 bg-card">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Package className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Tồn kho hiện tại</p>
            <p className="text-xl font-bold">{currentStock}</p>
          </div>
        </div>
        <div className="border rounded-lg p-3 flex items-center gap-3 bg-card">
          <div className="h-10 w-10 rounded-lg bg-accent flex items-center justify-center">
            <TrendingUp className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Giá trị tồn kho</p>
            <p className="text-xl font-bold">{formatVND(stockValue)}</p>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2">
        <Button
          onClick={() => { setAdjType("in"); setAdjOpen(true); }}
          className="bg-emerald-600 hover:bg-emerald-700"
        >
          <PackagePlus className="mr-2 h-4 w-4" /> Nhập kho
        </Button>
        <Button
          variant="destructive"
          onClick={() => { setAdjType("out"); setAdjOpen(true); }}
        >
          <PackageMinus className="mr-2 h-4 w-4" /> Xuất kho
        </Button>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap gap-2 items-end">
        {/* Type filter */}
        <div className="min-w-[140px]">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="Loại giao dịch" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả</SelectItem>
              <SelectItem value="in">Chỉ nhập</SelectItem>
              <SelectItem value="out">Chỉ xuất</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Start Date */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className={cn("h-9 text-sm justify-start min-w-[130px]", !startDate && "text-muted-foreground")}>
              <CalendarIcon className="mr-2 h-3.5 w-3.5" />
              {startDate ? format(startDate, "dd/MM/yyyy") : "Từ ngày"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={startDate}
              onSelect={setStartDate}
              initialFocus
              className="p-3 pointer-events-auto"
            />
          </PopoverContent>
        </Popover>

        {/* End Date */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className={cn("h-9 text-sm justify-start min-w-[130px]", !endDate && "text-muted-foreground")}>
              <CalendarIcon className="mr-2 h-3.5 w-3.5" />
              {endDate ? format(endDate, "dd/MM/yyyy") : "Đến ngày"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={endDate}
              onSelect={setEndDate}
              initialFocus
              className="p-3 pointer-events-auto"
            />
          </PopoverContent>
        </Popover>

        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 text-xs">
            <X className="mr-1 h-3 w-3" /> Xóa lọc
          </Button>
        )}
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block relative w-full overflow-auto max-h-[50vh] border rounded-md">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-muted/95 backdrop-blur-sm">
            <TableRow>
              <TableHead className="min-w-[110px]">Thời gian</TableHead>
              <TableHead className="min-w-[90px]">Mã chứng từ</TableHead>
              <TableHead className="min-w-[80px]">Loại</TableHead>
              <TableHead className="text-right min-w-[60px]">Số lượng</TableHead>
              <TableHead className="text-right min-w-[80px]">Đơn giá</TableHead>
              <TableHead className="text-right min-w-[90px]">Giá trị GD</TableHead>
              <TableHead className="text-right min-w-[70px]">Tồn kho</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 7 }).map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : pagedRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  {hasFilters ? "Không có giao dịch phù hợp bộ lọc" : "Chưa có giao dịch nào"}
                </TableCell>
              </TableRow>
            ) : (
              pagedRows.map((r) => (
                <TableRow key={r.id} className={r.overstock ? "bg-destructive/10" : ""}>
                  <TableCell className="whitespace-nowrap text-xs">
                    {r.date ? format(new Date(r.date), "dd/MM/yyyy HH:mm") : "—"}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-primary">{r.code}</TableCell>
                  <TableCell><TypeBadge type={r.type} /></TableCell>
                  <TableCell className="text-right text-sm">
                    <QtyDisplay row={r} />
                  </TableCell>
                  <TableCell className="text-right text-xs">{formatVND(r.price)}</TableCell>
                  <TableCell className="text-right text-xs font-medium">{formatVND(r.transactionValue)}</TableCell>
                  <TableCell className={cn("text-right text-sm font-bold", r.overstock && "text-destructive")}>
                    {r.balanceQty}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobile Card List */}
      <div className="md:hidden space-y-2">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="p-3 border rounded-lg space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-4 w-full" />
            </div>
          ))
        ) : pagedRows.length === 0 ? (
          <p className="text-center text-muted-foreground py-8 text-sm">
            {hasFilters ? "Không có giao dịch phù hợp bộ lọc" : "Chưa có giao dịch nào"}
          </p>
        ) : (
          pagedRows.map((r) => <MobileCard key={r.id} row={r} />)
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            disabled={page <= 1}
            onClick={() => setPage(p => p - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            disabled={page >= totalPages}
            onClick={() => setPage(p => p + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      <StockAdjustmentModal
        open={adjOpen}
        onOpenChange={(v) => { setAdjOpen(v); if (!v) loadData(); }}
        productId={product.id}
        productName={product.name}
        type={adjType}
        currentStock={product.stock_quantity}
      />
    </div>
  );
}
