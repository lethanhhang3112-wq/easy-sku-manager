import { useState, useMemo, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, subDays } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import {
  Plus, Search, Filter, ChevronUp, ChevronDown, CalendarIcon,
  Printer, FileDown, Ban, PanelLeftClose, PanelLeft,
  CheckSquare, Star,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useDebounce } from "@/hooks/use-debounce";
import { formatCurrency } from "@/components/CurrencyInput";
import { SalesOrderDetailRow } from "@/components/sales/SalesOrderDetailRow";
import { EntityLink } from "@/components/shared/EntityLink";

// ─── Types ───────────────────────────────────────────────────────
type SalesOrder = {
  id: string;
  code: string;
  customer_id: string | null;
  total_amount: number;
  payment_method: string;
  created_at: string;
  status: string;
  customers: { name: string; code: string } | null;
};

type SortField = "created_at" | "code" | "total_amount";
type SortDir = "asc" | "desc";

const fmt = (n: number) => formatCurrency(n);

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" }> = {
  completed: { label: "Hoàn thành", variant: "default" },
  cancelled: { label: "Đã hủy", variant: "destructive" },
};

const TIME_FILTERS = [
  { value: "all", label: "Tất cả" },
  { value: "today", label: "Hôm nay" },
  { value: "yesterday", label: "Hôm qua" },
  { value: "this_week", label: "Tuần này" },
  { value: "this_month", label: "Tháng này" },
  { value: "this_year", label: "Năm nay" },
  { value: "custom", label: "Tùy chỉnh" },
];

const TABLE_COL_COUNT = 11;

function getTimeDates(value: string): { start?: Date; end?: Date } {
  const now = new Date();
  switch (value) {
    case "today": return { start: startOfDay(now), end: endOfDay(now) };
    case "yesterday": { const y = subDays(now, 1); return { start: startOfDay(y), end: endOfDay(y) }; }
    case "this_week": return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
    case "this_month": return { start: startOfMonth(now), end: endOfMonth(now) };
    case "this_year": return { start: startOfYear(now), end: endOfYear(now) };
    default: return {};
  }
}

// ═════════════════════════════════════════════════════════════════
const SalesPage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();

  // Filter state
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [timeFilter, setTimeFilter] = useState("all");
  const [customStart, setCustomStart] = useState<Date | undefined>();
  const [customEnd, setCustomEnd] = useState<Date | undefined>();
  const [statusFilters, setStatusFilters] = useState<string[]>(["completed", "cancelled"]);
  const debouncedSearch = useDebounce(searchQuery, 300);

  // Sort state
  const [sortField, setSortField] = useState<SortField>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // Bulk select
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Inline expansion
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  // Void confirm
  const [voidTarget, setVoidTarget] = useState<SalesOrder | null>(null);
  const [bulkVoidOpen, setBulkVoidOpen] = useState(false);

  // Star/favorite (local state)
  const [starredIds, setStarredIds] = useState<Set<string>>(new Set());

  // ─── Queries ─────────────────────────────────────────────────
  const { data: salesOrders = [], isLoading } = useQuery({
    queryKey: ["sales_orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales_orders")
        .select("*, customers(code, name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as SalesOrder[];
    },
  });

  // ─── Filter & Sort ──────────────────────────────────────────
  const filteredOrders = useMemo(() => {
    let result = salesOrders;

    if (statusFilters.length < Object.keys(STATUS_MAP).length) {
      result = result.filter((o) => statusFilters.includes(o.status || "completed"));
    }

    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      result = result.filter((o) =>
        o.code.toLowerCase().includes(q) ||
        (o.customers?.name || "").toLowerCase().includes(q)
      );
    }

    let start: Date | undefined;
    let end: Date | undefined;
    if (timeFilter === "custom") {
      start = customStart;
      end = customEnd;
    } else if (timeFilter !== "all") {
      const dates = getTimeDates(timeFilter);
      start = dates.start;
      end = dates.end;
    }
    if (start) result = result.filter((o) => new Date(o.created_at) >= start!);
    if (end) result = result.filter((o) => new Date(o.created_at) <= end!);

    result = [...result].sort((a, b) => {
      let cmp = 0;
      if (sortField === "created_at") cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      else if (sortField === "code") cmp = a.code.localeCompare(b.code);
      else if (sortField === "total_amount") cmp = a.total_amount - b.total_amount;
      return sortDir === "desc" ? -cmp : cmp;
    });

    return result;
  }, [salesOrders, statusFilters, debouncedSearch, timeFilter, customStart, customEnd, sortField, sortDir]);

  // ─── Void mutation (single) ────────────────────────────────
  const voidMutation = useMutation({
    mutationFn: async (order: SalesOrder) => {
      if (order.status === "cancelled") throw new Error("Hóa đơn đã hủy trước đó");
      const { data: items, error: itemsErr } = await supabase
        .from("sales_order_items")
        .select("product_id, quantity")
        .eq("sales_order_id", order.id);
      if (itemsErr) throw itemsErr;

      if (items && items.length > 0) {
        await Promise.all(items.map(async (item) => {
          const { data: product } = await supabase
            .from("products")
            .select("stock_quantity")
            .eq("id", item.product_id)
            .single();
          if (product) {
            const { error } = await supabase
              .from("products")
              .update({ stock_quantity: product.stock_quantity + item.quantity })
              .eq("id", item.product_id);
            if (error) throw error;
          }
        }));
      }

      const { error: updateErr } = await supabase
        .from("sales_orders")
        .update({ status: "cancelled" })
        .eq("id", order.id);
      if (updateErr) throw updateErr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales_orders"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Đã hủy hóa đơn và hoàn tồn kho thành công");
      setVoidTarget(null);
      setExpandedOrderId(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  // ─── Bulk void mutation ────────────────────────────────────
  const bulkVoidMutation = useMutation({
    mutationFn: async (orderIds: string[]) => {
      const orders = salesOrders.filter((o) => orderIds.includes(o.id) && o.status !== "cancelled");
      for (const order of orders) {
        const { data: items } = await supabase
          .from("sales_order_items")
          .select("product_id, quantity")
          .eq("sales_order_id", order.id);
        if (items && items.length > 0) {
          await Promise.all(items.map(async (item) => {
            const { data: product } = await supabase
              .from("products")
              .select("stock_quantity")
              .eq("id", item.product_id)
              .single();
            if (product) {
              await supabase
                .from("products")
                .update({ stock_quantity: product.stock_quantity + item.quantity })
                .eq("id", item.product_id);
            }
          }));
        }
        await supabase.from("sales_orders").update({ status: "cancelled" }).eq("id", order.id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales_orders"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success(`Đã hủy ${selectedIds.size} hóa đơn và hoàn tồn kho`);
      setSelectedIds(new Set());
      setBulkVoidOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  // ─── Handlers ──────────────────────────────────────────────
  const toggleExpand = (orderId: string) => {
    setExpandedOrderId((prev) => (prev === orderId ? null : orderId));
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(field); setSortDir("desc"); }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDir === "asc" ? <ChevronUp className="h-3 w-3 ml-1 inline" /> : <ChevronDown className="h-3 w-3 ml-1 inline" />;
  };

  const toggleStatus = (status: string) => {
    setStatusFilters((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
    );
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredOrders.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredOrders.map((o) => o.id)));
    }
  };

  const handleCopy = (order: SalesOrder, items: any[]) => {
    if (!items.length) return;
    const cartItems = items.map((item: any) => ({
      product_id: item.product_id,
      product_code: item.products?.code || "",
      product_name: item.products?.name || "",
      quantity: item.quantity,
      unit_price: item.unit_price,
      max_stock: 9999,
    }));
    navigate("/sales/new", {
      state: {
        prefillCart: cartItems,
        prefillCustomerId: order.customer_id,
      },
    });
  };

  const handlePrint = () => window.print();

  const handleExportCSV = (data: SalesOrder[]) => {
    const headers = ["Mã hóa đơn,Khách hàng,Phương thức,Tổng tiền,Trạng thái,Ngày tạo"];
    const rows = data.map((o) =>
      `${o.code},${o.customers?.name || "Khách lẻ"},${o.payment_method === "cash" ? "Tiền mặt" : "Chuyển khoản"},${o.total_amount},${STATUS_MAP[o.status]?.label || o.status},${format(new Date(o.created_at), "dd/MM/yyyy HH:mm")}`
    );
    const csv = [headers, ...rows].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `hoa-don-${format(new Date(), "ddMMyyyy")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Đã xuất file CSV");
  };

  const handleExportDetail = (order: SalesOrder, items: any[]) => {
    if (!items.length) return;
    const headers = ["Mã SP,Tên SP,Số lượng,Đơn giá,Thành tiền"];
    const rows = items.map((item: any) =>
      `${item.products?.code || ""},${item.products?.name || ""},${item.quantity},${item.unit_price},${item.quantity * item.unit_price}`
    );
    const csv = [headers, ...rows].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `hoa-don-${order.code}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Đã xuất file CSV");
  };

  // ─── Render ────────────────────────────────────────────────
  return (
    <div className="flex h-[calc(100vh-2rem)] -m-6 print:m-0">
      {/* ═══ LEFT SIDEBAR — FILTERS ═══════════════════════════ */}
      {sidebarOpen && (
        <div className="w-[260px] shrink-0 border-r bg-muted/30 flex flex-col overflow-y-auto print:hidden">
          <div className="p-4 border-b flex items-center justify-between">
            <h2 className="text-sm font-semibold flex items-center gap-1.5">
              <Filter className="h-4 w-4" /> Bộ lọc
            </h2>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSidebarOpen(false)}>
              <PanelLeftClose className="h-4 w-4" />
            </Button>
          </div>

          {/* Search */}
          <div className="p-4 border-b space-y-2">
            <Label className="text-xs font-medium">Tìm kiếm</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Mã HĐ, khách hàng..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-8 text-xs"
              />
            </div>
          </div>

          {/* Time Filter */}
          <div className="p-4 border-b space-y-2">
            <Label className="text-xs font-medium">Thời gian</Label>
            <div className="space-y-1">
              {TIME_FILTERS.map((tf) => (
                <button
                  key={tf.value}
                  onClick={() => setTimeFilter(tf.value)}
                  className={cn(
                    "w-full text-left text-xs px-2.5 py-1.5 rounded-md transition-colors",
                    timeFilter === tf.value
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-accent text-foreground"
                  )}
                >
                  {tf.label}
                </button>
              ))}
            </div>
            {timeFilter === "custom" && (
              <div className="space-y-2 mt-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="w-full justify-start text-xs h-8">
                      <CalendarIcon className="mr-1.5 h-3 w-3" />
                      {customStart ? format(customStart, "dd/MM/yyyy") : "Từ ngày"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={customStart} onSelect={setCustomStart} className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="w-full justify-start text-xs h-8">
                      <CalendarIcon className="mr-1.5 h-3 w-3" />
                      {customEnd ? format(customEnd, "dd/MM/yyyy") : "Đến ngày"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={customEnd} onSelect={setCustomEnd} className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
            )}
          </div>

          {/* Status Filter */}
          <div className="p-4 space-y-2">
            <Label className="text-xs font-medium">Trạng thái</Label>
            <div className="space-y-2">
              {Object.entries(STATUS_MAP).map(([key, { label }]) => (
                <label key={key} className="flex items-center gap-2 text-xs cursor-pointer">
                  <Checkbox
                    checked={statusFilters.includes(key)}
                    onCheckedChange={() => toggleStatus(key)}
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ═══ MAIN AREA ═════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between gap-3 print:hidden">
          <div className="flex items-center gap-2">
            {!sidebarOpen && (
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSidebarOpen(true)}>
                <PanelLeft className="h-4 w-4" />
              </Button>
            )}
            <h1 className="text-xl font-bold">Hóa đơn bán hàng</h1>
            <Badge variant="secondary" className="text-xs">{filteredOrders.length}</Badge>
          </div>
          <div className="flex items-center gap-2">
            {selectedIds.size > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <CheckSquare className="mr-1.5 h-3.5 w-3.5" />
                    Thao tác ({selectedIds.size})
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => {
                    const selected = salesOrders.filter((o) => selectedIds.has(o.id));
                    handleExportCSV(selected);
                  }}>
                    <FileDown className="mr-2 h-3.5 w-3.5" /> Xuất file
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handlePrint()}>
                    <Printer className="mr-2 h-3.5 w-3.5" /> In
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => setBulkVoidOpen(true)}
                  >
                    <Ban className="mr-2 h-3.5 w-3.5" /> Hủy bỏ
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <FileDown className="mr-1.5 h-3.5 w-3.5" /> Xuất file
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => handleExportCSV(filteredOrders)}>
                  Xuất CSV (danh sách hiện tại)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExportCSV(salesOrders)}>
                  Xuất CSV (tất cả)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button onClick={() => navigate("/sales/new")}>
              <Plus className="mr-1.5 h-4 w-4" /> Tạo đơn hàng
            </Button>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-10">
                  <Checkbox
                    checked={filteredOrders.length > 0 && selectedIds.size === filteredOrders.length}
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
                <TableHead className="w-10"></TableHead>
                <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("created_at")}>
                  Thời gian <SortIcon field="created_at" />
                </TableHead>
                <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("code")}>
                  Mã hóa đơn <SortIcon field="code" />
                </TableHead>
                <TableHead>Mã KH</TableHead>
                <TableHead>Khách hàng</TableHead>
                <TableHead className="cursor-pointer select-none text-right" onClick={() => toggleSort("total_amount")}>
                  Tổng tiền hàng <SortIcon field="total_amount" />
                </TableHead>
                <TableHead className="text-right">Giảm giá</TableHead>
                <TableHead className="text-right">Tổng sau giảm giá</TableHead>
                <TableHead className="text-right">Khách đã trả</TableHead>
                <TableHead>Trạng thái</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: TABLE_COL_COUNT }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : filteredOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={TABLE_COL_COUNT} className="text-center py-12 text-muted-foreground">
                    {debouncedSearch ? "Không tìm thấy hóa đơn nào" : "Chưa có hóa đơn nào"}
                  </TableCell>
                </TableRow>
              ) : (
                filteredOrders.map((o) => {
                  const status = STATUS_MAP[o.status] || STATUS_MAP.completed;
                  const discount = 0;
                  const totalAfterDiscount = o.total_amount - discount;
                  const customerPaid = o.total_amount;
                  const isStarred = starredIds.has(o.id);
                  const isExpanded = expandedOrderId === o.id;
                  return (
                    <>{/* Fragment for row + expansion */}
                      <TableRow
                        key={o.id}
                        className={cn(
                          "cursor-pointer hover:bg-accent/50",
                          isExpanded && "bg-primary/5 border-b-0"
                        )}
                        onClick={() => toggleExpand(o.id)}
                      >
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedIds.has(o.id)}
                            onCheckedChange={() => toggleSelect(o.id)}
                          />
                        </TableCell>
                        <TableCell onClick={(e) => { e.stopPropagation(); setStarredIds(prev => { const next = new Set(prev); if (next.has(o.id)) next.delete(o.id); else next.add(o.id); return next; }); }}>
                          <Star className={cn("h-4 w-4 transition-colors", isStarred ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/40 hover:text-yellow-400")} />
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                          {format(new Date(o.created_at), "dd/MM/yyyy HH:mm")}
                        </TableCell>
                        <TableCell className="font-mono text-primary">{o.code}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{o.customers?.code || "—"}</TableCell>
                        <TableCell>{o.customers?.name || "Khách lẻ"}</TableCell>
                        <TableCell className="text-right font-medium">{fmt(o.total_amount)}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{fmt(discount)}</TableCell>
                        <TableCell className="text-right font-medium">{fmt(totalAfterDiscount)}</TableCell>
                        <TableCell className="text-right font-medium text-primary">{fmt(customerPaid)}</TableCell>
                        <TableCell>
                          <Badge variant={status.variant}>{status.label}</Badge>
                        </TableCell>
                      </TableRow>
                      {isExpanded && (
                        <SalesOrderDetailRow
                          key={`detail-${o.id}`}
                          order={o}
                          colSpan={TABLE_COL_COUNT}
                          onVoid={setVoidTarget}
                          onCopy={handleCopy}
                          onExport={handleExportDetail}
                          onPrint={handlePrint}
                        />
                      )}
                    </>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* ═══ SINGLE VOID CONFIRMATION ══════════════════════════ */}
      <AlertDialog open={!!voidTarget} onOpenChange={(open) => !open && setVoidTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hủy hóa đơn {voidTarget?.code}?</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc chắn muốn hủy hóa đơn này không? Tồn kho sẽ được hoàn tác (cộng lại số lượng đã bán). Thao tác này không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={voidMutation.isPending}>Không</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={voidMutation.isPending}
              onClick={() => voidTarget && voidMutation.mutate(voidTarget)}
            >
              {voidMutation.isPending ? "Đang xử lý..." : "Xác nhận hủy"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ═══ BULK VOID CONFIRMATION ════════════════════════════ */}
      <AlertDialog open={bulkVoidOpen} onOpenChange={setBulkVoidOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hủy {selectedIds.size} hóa đơn?</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc chắn muốn hủy {selectedIds.size} hóa đơn đã chọn? Tồn kho của tất cả sản phẩm liên quan sẽ được hoàn tác. Thao tác này không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkVoidMutation.isPending}>Không</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={bulkVoidMutation.isPending}
              onClick={() => bulkVoidMutation.mutate(Array.from(selectedIds))}
            >
              {bulkVoidMutation.isPending ? "Đang xử lý..." : "Xác nhận hủy tất cả"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Print styles */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print\\:m-0, .print\\:m-0 * { visibility: visible; }
        }
      `}</style>
    </div>
  );
};

export default SalesPage;
