import { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
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
  Printer, Copy, FileDown, Ban, PanelLeftClose, PanelLeft,
  CheckSquare, Star,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useDebounce } from "@/hooks/use-debounce";
import { formatCurrency } from "@/components/CurrencyInput";
import { SalesOrderDetailRow } from "@/components/sales/SalesOrderDetailRow";

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

type DetailItem = {
  id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  products: { code: string; name: string } | null;
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

  // Detail state — inline expansion
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const selectedOrder = salesOrders.find((o) => o.id === expandedOrderId) || null;
  const [bulkVoidOpen, setBulkVoidOpen] = useState(false);

  // Bulk update dialog
  const [bulkUpdateOpen, setBulkUpdateOpen] = useState(false);
  const [bulkNotes, setBulkNotes] = useState("");

  // Inline edit
  const [editNotes, setEditNotes] = useState("");
  
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

  // Detail items query
  const { data: detailItems = [], isLoading: itemsLoading } = useQuery({
    queryKey: ["sales_detail_items", selectedOrder?.id],
    queryFn: async () => {
      if (!selectedOrder) return [];
      const { data, error } = await supabase
        .from("sales_order_items")
        .select("*, products:product_id(code, name)")
        .eq("sales_order_id", selectedOrder.id);
      if (error) throw error;
      return data as DetailItem[];
    },
    enabled: !!selectedOrder,
  });

  // ─── Filter & Sort ──────────────────────────────────────────
  const filteredOrders = useMemo(() => {
    let result = salesOrders;

    // Status filter
    if (statusFilters.length < Object.keys(STATUS_MAP).length) {
      result = result.filter((o) => statusFilters.includes(o.status || "completed"));
    }

    // Search
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      result = result.filter((o) =>
        o.code.toLowerCase().includes(q) ||
        (o.customers?.name || "").toLowerCase().includes(q)
      );
    }

    // Time filter
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

    // Sort
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

      // Restore inventory
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
      setDetailOpen(false);
      setSelectedOrder(null);
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

  // ─── Bulk update mutation ──────────────────────────────────
  const bulkUpdateMutation = useMutation({
    mutationFn: async () => {
      const ids = Array.from(selectedIds);
      await Promise.all(ids.map((id) =>
        supabase.from("sales_orders").update({ status: "completed" }).eq("id", id)
      ));
      // We're updating notes conceptually — but sales_orders doesn't have notes column
      // For now this just serves as the bulk update UI placeholder
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales_orders"] });
      toast.success("Đã cập nhật thông tin");
      setBulkUpdateOpen(false);
      setSelectedIds(new Set());
    },
    onError: (e: any) => toast.error(e.message),
  });

  // ─── Save detail (inline edit — notes not available on sales_orders, but we keep UI) ──
  const saveMutation = useMutation({
    mutationFn: async () => {
      // sales_orders doesn't have a notes column — this is a no-op placeholder
      // In future, add notes column to sales_orders
      toast.info("Chức năng cập nhật ghi chú sẽ sớm được hỗ trợ");
    },
  });

  // ─── Handlers ──────────────────────────────────────────────
  const openDetail = (order: SalesOrder) => {
    setSelectedOrder(order);
    setEditNotes("");
    setDetailOpen(true);
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

  const handleCopy = () => {
    if (!selectedOrder || !detailItems.length) return;
    const cartItems = detailItems.map((item) => ({
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
        prefillCustomerId: selectedOrder.customer_id,
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

  const handleExportDetail = () => {
    if (!selectedOrder || !detailItems.length) return;
    const headers = ["Mã SP,Tên SP,Số lượng,Đơn giá,Thành tiền"];
    const rows = detailItems.map((item) =>
      `${item.products?.code || ""},${item.products?.name || ""},${item.quantity},${item.unit_price},${item.quantity * item.unit_price}`
    );
    const csv = [headers, ...rows].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `hoa-don-${selectedOrder.code}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Đã xuất file CSV");
  };

  const isCancelled = selectedOrder?.status === "cancelled";

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
            {/* Bulk Actions */}
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
                    {Array.from({ length: 11 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : filteredOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center py-12 text-muted-foreground">
                    {debouncedSearch ? "Không tìm thấy hóa đơn nào" : "Chưa có hóa đơn nào"}
                  </TableCell>
                </TableRow>
              ) : (
                filteredOrders.map((o) => {
                  const status = STATUS_MAP[o.status] || STATUS_MAP.completed;
                  const discount = 0; // sales_orders doesn't have discount column yet
                  const totalAfterDiscount = o.total_amount - discount;
                  const customerPaid = o.total_amount; // sales_orders doesn't have amount_paid column yet
                  const isStarred = starredIds.has(o.id);
                  return (
                    <TableRow
                      key={o.id}
                      className="cursor-pointer hover:bg-accent/50"
                      onClick={() => openDetail(o)}
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
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* ═══ DETAIL SHEET ══════════════════════════════════════ */}
      <Sheet open={detailOpen} onOpenChange={(open) => { setDetailOpen(open); if (!open) setSelectedOrder(null); }}>
        <SheetContent side="right" className="w-full sm:max-w-2xl flex flex-col p-0">
          <SheetHeader className="p-5 pb-0">
            <SheetTitle className="flex items-center gap-2">
              Hóa đơn: {selectedOrder?.code}
              {selectedOrder && (
                <Badge variant={STATUS_MAP[selectedOrder.status]?.variant || "default"}>
                  {STATUS_MAP[selectedOrder.status]?.label || selectedOrder.status}
                </Badge>
              )}
            </SheetTitle>
            <SheetDescription>Chi tiết hóa đơn bán hàng</SheetDescription>
          </SheetHeader>

          <Tabs defaultValue="info" className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="mx-5 w-fit">
              <TabsTrigger value="info">Thông tin</TabsTrigger>
              <TabsTrigger value="payments">Chi tiết thanh toán</TabsTrigger>
            </TabsList>

            {/* ─── Info Tab ─────────────────────────────────── */}
            <TabsContent value="info" className="flex-1 overflow-y-auto px-5 pb-2 mt-0">
              {selectedOrder && (
                <div className="space-y-4 py-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground text-xs">Thời gian</span>
                      <p className="font-medium">{format(new Date(selectedOrder.created_at), "dd/MM/yyyy HH:mm")}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs">Khách hàng</span>
                      <p className="font-medium">{selectedOrder.customers?.name || "Khách lẻ"}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs">Phương thức thanh toán</span>
                      <p className="font-medium">{selectedOrder.payment_method === "cash" ? "Tiền mặt" : "Chuyển khoản"}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs">Tổng tiền</span>
                      <p className="font-semibold text-primary text-lg">{fmt(selectedOrder.total_amount)}</p>
                    </div>
                  </div>

                  {/* Items table */}
                  <div>
                    <Label className="text-xs text-muted-foreground mb-2 block">Danh sách hàng hóa</Label>
                    <div className="border rounded-lg">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/40">
                            <TableHead className="text-xs">Mã SP</TableHead>
                            <TableHead className="text-xs">Tên SP</TableHead>
                            <TableHead className="text-xs text-right">SL</TableHead>
                            <TableHead className="text-xs text-right">Đơn giá</TableHead>
                            <TableHead className="text-xs text-right">Thành tiền</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {itemsLoading ? (
                            Array.from({ length: 2 }).map((_, i) => (
                              <TableRow key={i}>
                                {Array.from({ length: 5 }).map((_, j) => (
                                  <TableCell key={j}><Skeleton className="h-3 w-full" /></TableCell>
                                ))}
                              </TableRow>
                            ))
                          ) : detailItems.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={5} className="text-center text-muted-foreground text-xs py-4">
                                Không có sản phẩm
                              </TableCell>
                            </TableRow>
                          ) : (
                            detailItems.map((item) => (
                              <TableRow key={item.id}>
                                <TableCell className="font-mono text-xs">{item.products?.code || "—"}</TableCell>
                                <TableCell className="text-sm">{item.products?.name || "—"}</TableCell>
                                <TableCell className="text-right">{item.quantity}</TableCell>
                                <TableCell className="text-right">{fmt(item.unit_price)}</TableCell>
                                <TableCell className="text-right font-medium">{fmt(item.quantity * item.unit_price)}</TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* ─── Payment Details Tab ─────────────────────── */}
            <TabsContent value="payments" className="flex-1 overflow-y-auto px-5 pb-2 mt-0">
              {selectedOrder && (
                <div className="py-4 space-y-3">
                  <div className="border rounded-lg p-4 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Phương thức</span>
                      <span className="font-medium">{selectedOrder.payment_method === "cash" ? "Tiền mặt" : "Chuyển khoản"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Tổng thanh toán</span>
                      <span className="font-semibold">{fmt(selectedOrder.total_amount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Thời gian</span>
                      <span>{format(new Date(selectedOrder.created_at), "dd/MM/yyyy HH:mm:ss")}</span>
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>

          {/* ─── Bottom Action Bar ─────────────────────────── */}
          {selectedOrder && (
            <div className="border-t p-3 flex items-center gap-2 flex-wrap bg-background print:hidden">
              <Button variant="outline" size="sm" onClick={handlePrint}>
                <Printer className="mr-1.5 h-3.5 w-3.5" /> In
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportDetail}>
                <FileDown className="mr-1.5 h-3.5 w-3.5" /> Xuất file
              </Button>
              <Button variant="outline" size="sm" onClick={handleCopy}>
                <Copy className="mr-1.5 h-3.5 w-3.5" /> Sao chép
              </Button>
              {!isCancelled && (
                <Button
                  variant="destructive"
                  size="sm"
                  className="ml-auto"
                  onClick={() => setVoidTarget(selectedOrder)}
                >
                  <Ban className="mr-1.5 h-3.5 w-3.5" /> Hủy bỏ
                </Button>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

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
