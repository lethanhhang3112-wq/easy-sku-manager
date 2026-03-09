import { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Plus, Search, Filter, ChevronUp, ChevronDown, CalendarIcon, X,
  Eye, Printer, Copy, FileDown, Ban, Save, Barcode, PanelLeftClose, PanelLeft, Pencil,
  Star, CheckSquare, MoreHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useDebounce } from "@/hooks/use-debounce";
import { formatCurrency } from "@/components/CurrencyInput";

// ─── Types ───────────────────────────────────────────────────────
type ImportOrder = {
  id: string;
  code: string;
  supplier_id: string | null;
  total_amount: number;
  created_at: string;
  status: string;
  discount: number;
  amount_paid: number;
  notes: string | null;
  suppliers: { name: string; code: string } | null;
  import_order_items: { id: string; quantity: number }[];
};

type DetailItem = {
  id: string;
  product_id: string;
  quantity: number;
  unit_cost: number;
  products: { code: string; name: string } | null;
};

type PaymentSlip = {
  id: string;
  code: string;
  amount: number;
  payment_method: string;
  notes: string | null;
  created_at: string;
};

type SortField = "created_at" | "code" | "total_amount";
type SortDir = "asc" | "desc";

const fmt = (n: number) => formatCurrency(n);

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" }> = {
  completed: { label: "Đã nhập hàng", variant: "default" },
  draft: { label: "Phiếu tạm", variant: "secondary" },
  cancelled: { label: "Đã hủy", variant: "destructive" },
};

const TIME_FILTERS = [
  { value: "all", label: "Tất cả" },
  { value: "today", label: "Hôm nay" },
  { value: "this_week", label: "Tuần này" },
  { value: "this_month", label: "Tháng này" },
  { value: "this_year", label: "Năm nay" },
  { value: "custom", label: "Tùy chỉnh" },
];

function getTimeDates(value: string): { start?: Date; end?: Date } {
  const now = new Date();
  switch (value) {
    case "today": return { start: startOfDay(now), end: endOfDay(now) };
    case "this_week": return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
    case "this_month": return { start: startOfMonth(now), end: endOfMonth(now) };
    case "this_year": return { start: startOfYear(now), end: endOfYear(now) };
    default: return {};
  }
}

// ═════════════════════════════════════════════════════════════════
const ImportsPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Filter state
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [timeFilter, setTimeFilter] = useState("all");
  const [customStart, setCustomStart] = useState<Date | undefined>();
  const [customEnd, setCustomEnd] = useState<Date | undefined>();
  const [statusFilters, setStatusFilters] = useState<string[]>(["completed", "draft", "cancelled"]);
  const debouncedSearch = useDebounce(searchQuery, 300);

  // Sort state
  const [sortField, setSortField] = useState<SortField>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // Detail state
  const [selectedOrder, setSelectedOrder] = useState<ImportOrder | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // Void confirm
  const [voidTarget, setVoidTarget] = useState<ImportOrder | null>(null);

  // Inline edit state
  const [isEditing, setIsEditing] = useState(false);
  const [editNotes, setEditNotes] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editSupplierId, setEditSupplierId] = useState<string | null>(null);

  // Bulk select & star
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [starredIds, setStarredIds] = useState<Set<string>>(new Set());

  // ─── Queries ─────────────────────────────────────────────────
  const { data: importOrders = [], isLoading } = useQuery({
    queryKey: ["import_orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("import_orders")
        .select("*, suppliers(code, name), import_order_items(id, quantity)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as ImportOrder[];
    },
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers_list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("suppliers").select("id, code, name").order("name");
      if (error) throw error;
      return data as { id: string; code: string; name: string }[];
    },
  });

  // Detail items query
  const { data: detailItems = [], isLoading: itemsLoading } = useQuery({
    queryKey: ["import_detail_items", selectedOrder?.id],
    queryFn: async () => {
      if (!selectedOrder) return [];
      const { data, error } = await supabase
        .from("import_order_items")
        .select("*, products:product_id(code, name)")
        .eq("import_order_id", selectedOrder.id);
      if (error) throw error;
      return data as DetailItem[];
    },
    enabled: !!selectedOrder,
  });

  // Payment slips query
  const { data: paymentSlips = [], isLoading: slipsLoading } = useQuery({
    queryKey: ["payment_slips", selectedOrder?.id],
    queryFn: async () => {
      if (!selectedOrder) return [];
      const { data, error } = await supabase
        .from("payment_slips")
        .select("*")
        .eq("import_order_id", selectedOrder.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as PaymentSlip[];
    },
    enabled: !!selectedOrder,
  });

  // ─── Filter & Sort ──────────────────────────────────────────
  const filteredOrders = useMemo(() => {
    let result = importOrders;

    // Status filter
    if (statusFilters.length < 3) {
      result = result.filter((o) => statusFilters.includes(o.status || "completed"));
    }

    // Search
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      result = result.filter((o) =>
        o.code.toLowerCase().includes(q) ||
        (o.suppliers?.name || "").toLowerCase().includes(q)
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
  }, [importOrders, statusFilters, debouncedSearch, timeFilter, customStart, customEnd, sortField, sortDir]);

  // ─── Mutations ─────────────────────────────────────────────
  const voidMutation = useMutation({
    mutationFn: async (order: ImportOrder) => {
      // Fetch items
      const { data: items, error: itemsErr } = await supabase
        .from("import_order_items")
        .select("product_id, quantity")
        .eq("import_order_id", order.id);
      if (itemsErr) throw itemsErr;

      // Revert stock
      if (items && items.length > 0) {
        await Promise.all(items.map(async (item) => {
          const { data: product } = await supabase
            .from("products")
            .select("stock_quantity")
            .eq("id", item.product_id)
            .single();
          if (product) {
            const newQty = Math.max(0, product.stock_quantity - item.quantity);
            const { error } = await supabase
              .from("products")
              .update({ stock_quantity: newQty })
              .eq("id", item.product_id);
            if (error) throw error;
          }
        }));
      }

      // Update status to cancelled
      const { error: updateErr } = await supabase
        .from("import_orders")
        .update({ status: "cancelled" })
        .eq("id", order.id);
      if (updateErr) throw updateErr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["import_orders"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Đã hủy phiếu nhập và hoàn tác tồn kho");
      setVoidTarget(null);
      setDetailOpen(false);
      setSelectedOrder(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedOrder) return;
      const updates: any = {
        notes: editNotes,
        created_at: new Date(editDate).toISOString(),
      };
      if (editSupplierId && !selectedOrder.supplier_id) {
        updates.supplier_id = editSupplierId;
      }
      const { error } = await supabase
        .from("import_orders")
        .update(updates)
        .eq("id", selectedOrder.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["import_orders"] });
      setIsEditing(false);
      toast.success("Cập nhật phiếu nhập thành công!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  // ─── Handlers ──────────────────────────────────────────────
  const openDetail = (order: ImportOrder) => {
    setSelectedOrder(order);
    setIsEditing(false);
    setEditNotes(order.notes || "");
    const dt = new Date(order.created_at);
    dt.setMinutes(dt.getMinutes() - dt.getTimezoneOffset());
    setEditDate(dt.toISOString().slice(0, 16));
    setEditSupplierId(order.supplier_id);
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

  const handleCopy = () => {
    if (!selectedOrder || !detailItems.length) return;
    const cartItems = detailItems.map((item) => ({
      product_id: item.product_id,
      product_code: item.products?.code || "",
      product_name: item.products?.name || "",
      quantity: item.quantity,
      unit_cost: item.unit_cost,
      item_discount: 0,
    }));
    navigate("/imports/create", {
      state: {
        prefillCart: cartItems,
        prefillSupplierId: selectedOrder.supplier_id,
      },
    });
  };

  const handlePrint = () => window.print();

  const handleExportCSV = (data: ImportOrder[]) => {
    const headers = ["Mã phiếu,Nhà cung cấp,Tổng tiền,Trạng thái,Ngày tạo"];
    const rows = data.map((o) =>
      `${o.code},${o.suppliers?.name || ""},${o.total_amount},${STATUS_MAP[o.status]?.label || o.status},${format(new Date(o.created_at), "dd/MM/yyyy HH:mm")}`
    );
    const csv = [headers, ...rows].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nhap-hang-${format(new Date(), "ddMMyyyy")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Đã xuất file CSV");
  };

  const handleExportDetail = () => {
    if (!selectedOrder || !detailItems.length) return;
    const headers = ["Mã SP,Tên SP,Số lượng,Đơn giá,Thành tiền"];
    const rows = detailItems.map((item) =>
      `${item.products?.code || ""},${item.products?.name || ""},${item.quantity},${item.unit_cost},${item.quantity * item.unit_cost}`
    );
    const csv = [headers, ...rows].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `phieu-nhap-${selectedOrder.code}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Đã xuất file CSV");
  };

  const cancelEdit = () => {
    if (!selectedOrder) return;
    setIsEditing(false);
    setEditNotes(selectedOrder.notes || "");
    const dt = new Date(selectedOrder.created_at);
    dt.setMinutes(dt.getMinutes() - dt.getTimezoneOffset());
    setEditDate(dt.toISOString().slice(0, 16));
    setEditSupplierId(selectedOrder.supplier_id);
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
                placeholder="Mã phiếu, SP, NCC..."
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
            <h1 className="text-xl font-bold">Nhập hàng</h1>
            <Badge variant="secondary" className="text-xs">{filteredOrders.length}</Badge>
          </div>
          <div className="flex items-center gap-2">
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
                <DropdownMenuItem onClick={() => handleExportCSV(importOrders)}>
                  Xuất CSV (tất cả)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button onClick={() => navigate("/imports/create")}>
              <Plus className="mr-1.5 h-4 w-4" /> Tạo phiếu nhập
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
                    onCheckedChange={() => {
                      if (selectedIds.size === filteredOrders.length) setSelectedIds(new Set());
                      else setSelectedIds(new Set(filteredOrders.map((o) => o.id)));
                    }}
                  />
                </TableHead>
                <TableHead className="w-10"></TableHead>
                <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("code")}>
                  Mã nhập hàng <SortIcon field="code" />
                </TableHead>
                <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("created_at")}>
                  Thời gian <SortIcon field="created_at" />
                </TableHead>
                <TableHead>Mã NCC</TableHead>
                <TableHead>Nhà cung cấp</TableHead>
                <TableHead className="text-right">Tổng số lượng</TableHead>
                <TableHead className="text-right">SL mặt hàng</TableHead>
                <TableHead className="cursor-pointer select-none text-right" onClick={() => toggleSort("total_amount")}>
                  Tổng tiền hàng <SortIcon field="total_amount" />
                </TableHead>
                <TableHead>Ghi chú</TableHead>
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
                    Không tìm thấy phiếu nhập nào
                  </TableCell>
                </TableRow>
              ) : (
                filteredOrders.map((o) => {
                  const status = STATUS_MAP[o.status] || STATUS_MAP.completed;
                  const items = o.import_order_items || [];
                  const totalQty = items.reduce((sum, i) => sum + i.quantity, 0);
                  const totalItems = items.length;
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
                          onCheckedChange={() => {
                            setSelectedIds(prev => {
                              const next = new Set(prev);
                              if (next.has(o.id)) next.delete(o.id); else next.add(o.id);
                              return next;
                            });
                          }}
                        />
                      </TableCell>
                      <TableCell onClick={(e) => { e.stopPropagation(); setStarredIds(prev => { const next = new Set(prev); if (next.has(o.id)) next.delete(o.id); else next.add(o.id); return next; }); }}>
                        <Star className={cn("h-4 w-4 transition-colors", isStarred ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/40 hover:text-yellow-400")} />
                      </TableCell>
                      <TableCell className="font-mono text-primary">{o.code}</TableCell>
                      <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                        {format(new Date(o.created_at), "dd/MM/yyyy HH:mm")}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">{o.suppliers?.code || "—"}</TableCell>
                      <TableCell>{o.suppliers?.name || "—"}</TableCell>
                      <TableCell className="text-right font-medium">{totalQty}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{totalItems}</TableCell>
                      <TableCell className="text-right font-medium">{fmt(o.total_amount)}</TableCell>
                      <TableCell className="text-muted-foreground text-sm max-w-[150px] truncate">{o.notes || "—"}</TableCell>
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
              Phiếu nhập: {selectedOrder?.code}
              {selectedOrder && (
                <Badge variant={STATUS_MAP[selectedOrder.status]?.variant || "default"}>
                  {STATUS_MAP[selectedOrder.status]?.label || selectedOrder.status}
                </Badge>
              )}
            </SheetTitle>
            <SheetDescription>
              Chi tiết phiếu nhập hàng
            </SheetDescription>
          </SheetHeader>

          {/* Tabs */}
          <Tabs defaultValue="info" className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="mx-5 w-fit">
              <TabsTrigger value="info">Thông tin</TabsTrigger>
              <TabsTrigger value="payments">Lịch sử thanh toán</TabsTrigger>
            </TabsList>

            {/* ─── Info Tab ─────────────────────────────────── */}
            <TabsContent value="info" className="flex-1 overflow-y-auto px-5 pb-2 mt-0">
              {selectedOrder && (
                <div className="space-y-4 py-4">
                  {/* Editable fields */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-muted-foreground">Thời gian</Label>
                      {isEditing && !isCancelled ? (
                        <Input
                          type="datetime-local"
                          value={editDate}
                          onChange={(e) => setEditDate(e.target.value)}
                          className="h-8 text-sm"
                        />
                      ) : (
                        <p className="text-sm">{format(new Date(selectedOrder.created_at), "dd/MM/yyyy HH:mm")}</p>
                      )}
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Nhà cung cấp</Label>
                      {isEditing && !isCancelled && !selectedOrder.supplier_id ? (
                        <Select value={editSupplierId || ""} onValueChange={setEditSupplierId}>
                          <SelectTrigger className="h-8 text-sm">
                            <SelectValue placeholder="Chọn NCC" />
                          </SelectTrigger>
                          <SelectContent>
                            {suppliers.map((s) => (
                              <SelectItem key={s.id} value={s.id}>{s.code} - {s.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : isEditing && !isCancelled && selectedOrder.supplier_id ? (
                        <Select value={editSupplierId || ""} onValueChange={setEditSupplierId}>
                          <SelectTrigger className="h-8 text-sm">
                            <SelectValue placeholder="Chọn NCC" />
                          </SelectTrigger>
                          <SelectContent>
                            {suppliers.map((s) => (
                              <SelectItem key={s.id} value={s.id}>{s.code} - {s.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <p className="text-sm">{selectedOrder.suppliers?.name || "—"}</p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground text-xs">Tổng tiền hàng</span>
                      <p className="font-medium">{fmt(selectedOrder.total_amount)}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs">Giảm giá</span>
                      <p className="font-medium">{fmt(selectedOrder.discount)}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs">Đã thanh toán</span>
                      <p className="font-medium">{fmt(selectedOrder.amount_paid)}</p>
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs text-muted-foreground">Ghi chú</Label>
                    {isEditing && !isCancelled ? (
                      <Textarea
                        value={editNotes}
                        onChange={(e) => setEditNotes(e.target.value)}
                        rows={2}
                        className="text-sm"
                        placeholder="Ghi chú cho phiếu nhập..."
                      />
                    ) : (
                      <p className="text-sm">{selectedOrder.notes || "—"}</p>
                    )}
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
                                <TableCell className="text-right">{fmt(item.unit_cost)}</TableCell>
                                <TableCell className="text-right font-medium">{fmt(item.quantity * item.unit_cost)}</TableCell>
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

            {/* ─── Payment History Tab ─────────────────────── */}
            <TabsContent value="payments" className="flex-1 overflow-y-auto px-5 pb-2 mt-0">
              <div className="py-4">
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40">
                        <TableHead className="text-xs">Mã phiếu</TableHead>
                        <TableHead className="text-xs">Thời gian</TableHead>
                        <TableHead className="text-xs">Phương thức</TableHead>
                        <TableHead className="text-xs text-right">Số tiền</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {slipsLoading ? (
                        <TableRow>
                          <TableCell colSpan={4}><Skeleton className="h-4 w-full" /></TableCell>
                        </TableRow>
                      ) : paymentSlips.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-muted-foreground text-xs py-8">
                            Chưa có phiếu thanh toán nào
                          </TableCell>
                        </TableRow>
                      ) : (
                        paymentSlips.map((slip) => (
                          <TableRow key={slip.id}>
                            <TableCell className="font-mono text-xs">{slip.code}</TableCell>
                            <TableCell className="text-sm">{format(new Date(slip.created_at), "dd/MM/yyyy HH:mm")}</TableCell>
                            <TableCell className="text-sm">{slip.payment_method === "cash" ? "Tiền mặt" : slip.payment_method}</TableCell>
                            <TableCell className="text-right font-medium">{fmt(slip.amount)}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          {/* ─── Bottom Action Bar ─────────────────────────── */}
          {selectedOrder && (
            <div className="border-t p-3 flex items-center gap-2 flex-wrap bg-background print:hidden">
              {isEditing && !isCancelled ? (
                <>
                  <Button size="sm" onClick={() => { saveMutation.mutate(); }} disabled={saveMutation.isPending}>
                    <Save className="mr-1.5 h-3.5 w-3.5" />
                    {saveMutation.isPending ? "Đang lưu..." : "Lưu cập nhật"}
                  </Button>
                  <Button variant="outline" size="sm" onClick={cancelEdit}>
                    <X className="mr-1.5 h-3.5 w-3.5" /> Hủy sửa
                  </Button>
                </>
              ) : (
                <>
                  {!isCancelled && (
                    <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                      <Pencil className="mr-1.5 h-3.5 w-3.5" /> Sửa
                    </Button>
                  )}
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
                </>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* ═══ VOID CONFIRMATION ═════════════════════════════════ */}
      <AlertDialog open={!!voidTarget} onOpenChange={(open) => !open && setVoidTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hủy phiếu nhập {voidTarget?.code}?</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc chắn muốn hủy phiếu nhập hàng này không? Tồn kho sẽ được hoàn tác và các phiếu thanh toán liên quan cũng sẽ bị hủy. Thao tác này không thể hoàn tác.
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

      {/* Print styles */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          [data-radix-dialog-content] * { visibility: visible; }
          [data-radix-dialog-content] { position: absolute; left: 0; top: 0; width: 100%; }
        }
      `}</style>
    </div>
  );
};

export default ImportsPage;
