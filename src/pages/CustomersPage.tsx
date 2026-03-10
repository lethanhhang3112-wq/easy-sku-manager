import { useState, useMemo, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Plus, Search, Filter, Trash2, FileDown, PanelLeftClose, PanelLeft,
  MoreHorizontal, Pencil, ChevronUp, ChevronDown, Users, ToggleLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useDebounce } from "@/hooks/use-debounce";
import { formatCurrency } from "@/components/CurrencyInput";
import * as XLSX from "xlsx";

// ─── Types ───────────────────────────────────────────────────
type Customer = {
  id: string;
  code: string;
  name: string;
  phone: string | null;
  address: string | null;
  status: string;
  customer_group_id: string | null;
  created_at: string;
  customer_groups: { name: string } | null;
};

type CustomerGroup = { id: string; name: string };

type SalesOrder = {
  id: string;
  code: string;
  total_amount: number;
  status: string;
  payment_method: string;
  created_at: string;
};

type SortField = "name" | "debt" | "spend";
type SortDir = "asc" | "desc";
type DebtFilter = "all" | "has_debt";

// ─── Helpers ─────────────────────────────────────────────────
async function generateCustomerCode(): Promise<string> {
  const { data } = await supabase
    .from("customers")
    .select("code")
    .like("code", "KH%")
    .order("code", { ascending: false })
    .limit(1);
  if (data && data.length > 0) {
    const lastNum = parseInt(data[0].code.replace("KH", ""), 10);
    return `KH${String(lastNum + 1).padStart(4, "0")}`;
  }
  return "KH0001";
}

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" }> = {
  completed: { label: "Hoàn thành", variant: "default" },
  cancelled: { label: "Đã hủy", variant: "destructive" },
};

// ═════════════════════════════════════════════════════════════
const CustomersPage = () => {
  const queryClient = useQueryClient();

  // UI state
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [detailCustomer, setDetailCustomer] = useState<Customer | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkGroupOpen, setBulkGroupOpen] = useState(false);
  const [bulkGroupId, setBulkGroupId] = useState("");

  // Form state
  const [formName, setFormName] = useState("");
  const [formCode, setFormCode] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [formGroupId, setFormGroupId] = useState("");

  // Filter state
  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState("all");
  const [debtFilter, setDebtFilter] = useState<DebtFilter>("all");
  const debouncedSearch = useDebounce(search, 300);

  // Sort state
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  // Bulk select
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // ─── Queries ─────────────────────────────────────────────
  const { data: customers = [], isLoading } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("*, customer_groups(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Customer[];
    },
  });

  const { data: customerGroups = [] } = useQuery({
    queryKey: ["customer_groups"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customer_groups")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data as CustomerGroup[];
    },
  });

  // Calculate total_spend per customer from sales_orders
  const { data: salesAggregates = {} } = useQuery({
    queryKey: ["customer-sales-aggregates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales_orders")
        .select("customer_id, total_amount, status");
      if (error) throw error;
      const agg: Record<string, { spend: number; debt: number }> = {};
      (data || []).forEach((o) => {
        if (!o.customer_id || o.status === "cancelled") return;
        if (!agg[o.customer_id]) agg[o.customer_id] = { spend: 0, debt: 0 };
        agg[o.customer_id].spend += Number(o.total_amount);
      });
      return agg;
    },
  });

  // Detail: Sales history for selected customer
  const { data: salesHistory = [], isLoading: salesLoading } = useQuery({
    queryKey: ["customer-sales-history", detailCustomer?.id],
    queryFn: async () => {
      if (!detailCustomer) return [];
      const { data, error } = await supabase
        .from("sales_orders")
        .select("*")
        .eq("customer_id", detailCustomer.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as SalesOrder[];
    },
    enabled: !!detailCustomer,
  });

  // ─── Filter & Sort ──────────────────────────────────────
  const filtered = useMemo(() => {
    let result = customers;

    // Search
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.code.toLowerCase().includes(q) ||
          (c.phone || "").includes(q)
      );
    }

    // Group filter
    if (groupFilter !== "all") {
      if (groupFilter === "none") {
        result = result.filter((c) => !c.customer_group_id);
      } else {
        result = result.filter((c) => c.customer_group_id === groupFilter);
      }
    }

    // Debt filter
    if (debtFilter === "has_debt") {
      result = result.filter((c) => (salesAggregates[c.id]?.debt || 0) > 0);
    }

    // Sort
    result = [...result].sort((a, b) => {
      let cmp = 0;
      if (sortField === "name") cmp = a.name.localeCompare(b.name, "vi");
      else if (sortField === "spend") cmp = (salesAggregates[a.id]?.spend || 0) - (salesAggregates[b.id]?.spend || 0);
      else if (sortField === "debt") cmp = (salesAggregates[a.id]?.debt || 0) - (salesAggregates[b.id]?.debt || 0);
      return sortDir === "desc" ? -cmp : cmp;
    });

    return result;
  }, [customers, debouncedSearch, groupFilter, debtFilter, sortField, sortDir, salesAggregates]);

  // ─── Mutations ─────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editingCustomer) {
        const { error } = await supabase
          .from("customers")
          .update({
            name: formName.trim(),
            phone: formPhone || null,
            address: formAddress || null,
            customer_group_id: formGroupId || null,
          })
          .eq("id", editingCustomer.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("customers")
          .insert({
            code: formCode,
            name: formName.trim(),
            phone: formPhone || null,
            address: formAddress || null,
            customer_group_id: formGroupId || null,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      toast.success(editingCustomer ? "Đã cập nhật khách hàng" : "Đã thêm khách hàng");
      closeFormDialog();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("customers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      toast.success("Đã xóa khách hàng");
      setDeleteTarget(null);
      if (detailCustomer) setDetailCustomer(null);
    },
    onError: (e: any) => {
      setDeleteTarget(null);
      if (e.message?.includes("foreign key")) {
        toast.error("Không thể xóa khách hàng đã có đơn hàng");
      } else {
        toast.error(e.message);
      }
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from("customers").delete().in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      setSelectedIds(new Set());
      setBulkDeleteOpen(false);
      toast.success("Đã xóa khách hàng");
    },
    onError: (e: any) => {
      setBulkDeleteOpen(false);
      if (e.message?.includes("foreign key")) {
        toast.error("Không thể xóa khách hàng đã có đơn hàng");
      } else {
        toast.error(e.message);
      }
    },
  });

  const bulkUpdateGroupMutation = useMutation({
    mutationFn: async ({ ids, groupId }: { ids: string[]; groupId: string | null }) => {
      const { error } = await supabase
        .from("customers")
        .update({ customer_group_id: groupId })
        .in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      setSelectedIds(new Set());
      setBulkGroupOpen(false);
      toast.success("Đã cập nhật nhóm khách hàng");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, newStatus }: { id: string; newStatus: string }) => {
      const { error } = await supabase
        .from("customers")
        .update({ status: newStatus })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      toast.success("Đã cập nhật trạng thái");
    },
    onError: (e: any) => toast.error(e.message),
  });

  // ─── Handlers ──────────────────────────────────────────
  const openAdd = async () => {
    setEditingCustomer(null);
    setFormCode(await generateCustomerCode());
    setFormName("");
    setFormPhone("");
    setFormAddress("");
    setFormGroupId("");
    setAddDialogOpen(true);
  };

  const openEdit = (c: Customer) => {
    setEditingCustomer(c);
    setFormCode(c.code);
    setFormName(c.name);
    setFormPhone(c.phone || "");
    setFormAddress(c.address || "");
    setFormGroupId(c.customer_group_id || "");
    setAddDialogOpen(true);
  };

  const closeFormDialog = () => {
    setAddDialogOpen(false);
    setEditingCustomer(null);
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(field); setSortDir("asc"); }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDir === "asc" ? <ChevronUp className="h-3 w-3 ml-1 inline" /> : <ChevronDown className="h-3 w-3 ml-1 inline" />;
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filtered.map((c) => c.id)));
  };

  // Export
  const handleExportExcel = useCallback(() => {
    const exportData = filtered.map((c) => ({
      "Mã khách hàng": c.code,
      "Tên khách hàng": c.name,
      "Điện thoại": c.phone || "",
      "Nợ hiện tại": salesAggregates[c.id]?.debt || 0,
      "Tổng bán": salesAggregates[c.id]?.spend || 0,
      "Tổng bán trừ trả hàng": salesAggregates[c.id]?.spend || 0,
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Khách hàng");
    XLSX.writeFile(wb, `Danh_sach_khach_hang_${format(new Date(), "yyyyMMdd")}.xlsx`);
    toast.success("Đã xuất file Excel");
  }, [filtered, salesAggregates]);

  // Detail computed
  const detailSpend = detailCustomer ? (salesAggregates[detailCustomer.id]?.spend || 0) : 0;
  const detailDebt = detailCustomer ? (salesAggregates[detailCustomer.id]?.debt || 0) : 0;

  // ═══ RENDER ════════════════════════════════════════════
  return (
    <div className="flex h-[calc(100vh-2rem)] -m-6">
      {/* ═══ SIDEBAR ═══ */}
      {sidebarOpen && (
        <div className="w-[240px] shrink-0 border-r bg-muted/30 flex flex-col overflow-y-auto">
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
                placeholder="Tên, SĐT, mã KH..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-8 text-xs"
              />
            </div>
          </div>

          {/* Customer Group */}
          <div className="p-4 border-b space-y-2">
            <Label className="text-xs font-medium">Nhóm khách hàng</Label>
            <Select value={groupFilter} onValueChange={setGroupFilter}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Tất cả" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả</SelectItem>
                <SelectItem value="none">Chưa phân nhóm</SelectItem>
                {customerGroups.map((g) => (
                  <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Debt Filter */}
          <div className="p-4 space-y-2">
            <Label className="text-xs font-medium">Công nợ</Label>
            <div className="space-y-1">
              {([
                { value: "all", label: "Tất cả" },
                { value: "has_debt", label: "Khách nợ (> 0)" },
              ] as { value: DebtFilter; label: string }[]).map((d) => (
                <button
                  key={d.value}
                  onClick={() => setDebtFilter(d.value)}
                  className={cn(
                    "w-full text-left text-xs px-2.5 py-1.5 rounded-md transition-colors",
                    debtFilter === d.value
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-accent text-foreground"
                  )}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ═══ MAIN ═══ */}
      <div className="flex-1 flex flex-col overflow-hidden p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            {!sidebarOpen && (
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSidebarOpen(true)}>
                <PanelLeft className="h-4 w-4" />
              </Button>
            )}
            <h1 className="text-2xl font-bold">Khách hàng</h1>
            <Badge variant="secondary" className="ml-2">{filtered.length}</Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExportExcel}>
              <FileDown className="mr-2 h-4 w-4" /> Xuất file
            </Button>
            <Button size="sm" onClick={openAdd}>
              <Plus className="mr-2 h-4 w-4" /> Thêm KH
            </Button>
          </div>
        </div>

        {/* Bulk actions */}
        {selectedIds.size > 0 && (
          <div className="mb-3 flex items-center gap-2 bg-muted/50 border rounded-lg px-4 py-2">
            <span className="text-sm font-medium">Đã chọn {selectedIds.size} khách hàng</span>
            <div className="ml-auto flex gap-2">
              <Button variant="outline" size="sm" onClick={() => { setBulkGroupId(""); setBulkGroupOpen(true); }}>
                <Users className="mr-1.5 h-3.5 w-3.5" /> Cập nhật nhóm
              </Button>
              <Button variant="destructive" size="sm" onClick={() => setBulkDeleteOpen(true)}>
                <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Xóa
              </Button>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="flex-1 overflow-auto bg-card rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-[40px]">
                  <Checkbox
                    checked={filtered.length > 0 && selectedIds.size === filtered.length}
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
                <TableHead>Mã khách hàng</TableHead>
                <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("name")}>
                  Tên khách hàng <SortIcon field="name" />
                </TableHead>
                <TableHead>Điện thoại</TableHead>
                <TableHead className="text-right cursor-pointer select-none" onClick={() => toggleSort("debt")}>
                  Nợ hiện tại <SortIcon field="debt" />
                </TableHead>
                <TableHead className="text-right cursor-pointer select-none" onClick={() => toggleSort("spend")}>
                  Tổng bán <SortIcon field="spend" />
                </TableHead>
                <TableHead className="text-right">Tổng bán trừ trả hàng</TableHead>
                <TableHead className="w-[60px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">Đang tải...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">Không tìm thấy khách hàng nào</TableCell></TableRow>
              ) : (
                filtered.map((c) => {
                  const spend = salesAggregates[c.id]?.spend || 0;
                  const debt = salesAggregates[c.id]?.debt || 0;
                  const netSales = spend; // placeholder until returns tracking is implemented
                  return (
                    <TableRow
                      key={c.id}
                      className="cursor-pointer"
                      onClick={() => setDetailCustomer(c)}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedIds.has(c.id)}
                          onCheckedChange={() => toggleSelect(c.id)}
                        />
                      </TableCell>
                      <TableCell className="font-mono text-xs">{c.code}</TableCell>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell className="text-sm">{c.phone || "—"}</TableCell>
                      <TableCell className={cn("text-right", debt > 0 && "text-destructive font-medium")}>
                        {debt > 0 ? formatCurrency(debt) : "0"}
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(spend)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(netSales)}</TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEdit(c)}>
                              <Pencil className="mr-2 h-4 w-4" /> Sửa
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                toggleStatusMutation.mutate({
                                  id: c.id,
                                  newStatus: c.status === "active" ? "inactive" : "active",
                                })
                              }
                            >
                              <ToggleLeft className="mr-2 h-4 w-4" />
                              {c.status === "active" ? "Ngừng hoạt động" : "Kích hoạt"}
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive" onClick={() => setDeleteTarget(c)}>
                              <Trash2 className="mr-2 h-4 w-4" /> Xóa
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* ═══ DETAIL SHEET ═══ */}
      <Sheet open={!!detailCustomer} onOpenChange={(o) => { if (!o) setDetailCustomer(null); }}>
        <SheetContent className="sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              {detailCustomer?.name}
              <Badge variant="secondary" className="font-mono text-xs">{detailCustomer?.code}</Badge>
            </SheetTitle>
          </SheetHeader>

          {detailCustomer && (
            <Tabs defaultValue="info" className="mt-4">
              <TabsList className="w-full">
                <TabsTrigger value="info" className="flex-1">Thông tin</TabsTrigger>
                <TabsTrigger value="sales" className="flex-1">Lịch sử bán hàng</TabsTrigger>
                <TabsTrigger value="debt" className="flex-1">Công nợ</TabsTrigger>
              </TabsList>

              {/* Tab 1: Info */}
              <TabsContent value="info" className="mt-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-muted/50 rounded-lg p-4">
                    <p className="text-xs text-muted-foreground">Tổng bán</p>
                    <p className="text-xl font-bold text-primary">{formatCurrency(detailSpend)}</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-4">
                    <p className="text-xs text-muted-foreground">Công nợ</p>
                    <p className={cn("text-xl font-bold", detailDebt > 0 ? "text-destructive" : "text-foreground")}>
                      {formatCurrency(detailDebt)}
                    </p>
                  </div>
                </div>

                <div className="space-y-3 text-sm">
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">Mã KH</span>
                    <span className="font-mono">{detailCustomer.code}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">Điện thoại</span>
                    <span>{detailCustomer.phone || "—"}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">Địa chỉ</span>
                    <span>{detailCustomer.address || "—"}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">Nhóm KH</span>
                    <span>{detailCustomer.customer_groups?.name || "—"}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">Trạng thái</span>
                    <Badge variant={detailCustomer.status === "active" ? "default" : "secondary"}>
                      {detailCustomer.status === "active" ? "Hoạt động" : "Ngừng HĐ"}
                    </Badge>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-muted-foreground">Ngày tạo</span>
                    <span>{format(new Date(detailCustomer.created_at), "dd/MM/yyyy HH:mm")}</span>
                  </div>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button variant="outline" size="sm" onClick={() => openEdit(detailCustomer)}>
                    <Pencil className="mr-1.5 h-3.5 w-3.5" /> Cập nhật
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      toggleStatusMutation.mutate({
                        id: detailCustomer.id,
                        newStatus: detailCustomer.status === "active" ? "inactive" : "active",
                      })
                    }
                  >
                    <ToggleLeft className="mr-1.5 h-3.5 w-3.5" />
                    {detailCustomer.status === "active" ? "Ngừng HĐ" : "Kích hoạt"}
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setDeleteTarget(detailCustomer)}
                  >
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Xóa
                  </Button>
                </div>
              </TabsContent>

              {/* Tab 2: Sales History */}
              <TabsContent value="sales" className="mt-4">
                {salesLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
                  </div>
                ) : salesHistory.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">Chưa có đơn hàng nào</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead>Mã HĐ</TableHead>
                        <TableHead>Thời gian</TableHead>
                        <TableHead className="text-right">Tổng tiền</TableHead>
                        <TableHead>Thanh toán</TableHead>
                        <TableHead>Trạng thái</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {salesHistory.map((o) => {
                        const st = STATUS_MAP[o.status] || { label: o.status, variant: "secondary" as const };
                        return (
                          <TableRow key={o.id}>
                            <TableCell className="font-mono text-xs">{o.code}</TableCell>
                            <TableCell className="text-xs">{format(new Date(o.created_at), "dd/MM/yyyy HH:mm")}</TableCell>
                            <TableCell className="text-right font-medium">{formatCurrency(o.total_amount)}</TableCell>
                            <TableCell className="text-xs capitalize">{o.payment_method}</TableCell>
                            <TableCell>
                              <Badge variant={st.variant} className="text-xs">{st.label}</Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </TabsContent>

              {/* Tab 3: Debt Ledger */}
              <TabsContent value="debt" className="mt-4">
                {salesLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
                  </div>
                ) : (
                  <>
                    <div className="bg-muted/50 rounded-lg p-4 mb-4">
                      <p className="text-xs text-muted-foreground mb-1">Công nợ hiện tại</p>
                      <p className={cn("text-2xl font-bold", detailDebt > 0 ? "text-destructive" : "text-foreground")}>
                        {formatCurrency(detailDebt)}
                      </p>
                    </div>
                    {salesHistory.filter((o) => o.status !== "cancelled").length === 0 ? (
                      <p className="text-center text-muted-foreground py-4">Không có giao dịch</p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/50">
                            <TableHead>Chứng từ</TableHead>
                            <TableHead>Thời gian</TableHead>
                            <TableHead className="text-right">Phát sinh</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {salesHistory
                            .filter((o) => o.status !== "cancelled")
                            .map((o) => (
                              <TableRow key={o.id}>
                                <TableCell className="font-mono text-xs">{o.code}</TableCell>
                                <TableCell className="text-xs">{format(new Date(o.created_at), "dd/MM/yyyy HH:mm")}</TableCell>
                                <TableCell className="text-right font-medium">{formatCurrency(o.total_amount)}</TableCell>
                              </TableRow>
                            ))}
                        </TableBody>
                      </Table>
                    )}
                  </>
                )}
              </TabsContent>
            </Tabs>
          )}
        </SheetContent>
      </Sheet>

      {/* ═══ ADD/EDIT DIALOG ═══ */}
      <Dialog open={addDialogOpen} onOpenChange={(o) => { if (!o) closeFormDialog(); else setAddDialogOpen(true); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCustomer ? "Sửa khách hàng" : "Thêm khách hàng"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Mã khách hàng</Label>
              <Input value={formCode} disabled className="font-mono bg-muted" />
            </div>
            <div>
              <Label>Tên khách hàng *</Label>
              <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Nhập tên" />
            </div>
            <div>
              <Label>Điện thoại</Label>
              <Input value={formPhone} onChange={(e) => setFormPhone(e.target.value)} placeholder="Nhập SĐT" />
            </div>
            <div>
              <Label>Địa chỉ</Label>
              <Input value={formAddress} onChange={(e) => setFormAddress(e.target.value)} placeholder="Nhập địa chỉ" />
            </div>
            <div>
              <Label>Nhóm khách hàng</Label>
              <Select value={formGroupId || "none"} onValueChange={(v) => setFormGroupId(v === "none" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Chọn nhóm" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Không có nhóm</SelectItem>
                  {customerGroups.map((g) => (
                    <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeFormDialog}>Hủy</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={!formName.trim() || saveMutation.isPending}>
              {saveMutation.isPending ? "Đang lưu..." : "Lưu"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận xóa</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc muốn xóa khách hàng "{deleteTarget?.name}" ({deleteTarget?.code})?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Xóa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete */}
      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận xóa</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc muốn xóa {selectedIds.size} khách hàng đã chọn?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => bulkDeleteMutation.mutate(Array.from(selectedIds))}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Xóa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Update Group */}
      <Dialog open={bulkGroupOpen} onOpenChange={setBulkGroupOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cập nhật nhóm khách hàng</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Chọn nhóm cho {selectedIds.size} khách hàng đã chọn</p>
            <Select value={bulkGroupId || "none"} onValueChange={(v) => setBulkGroupId(v === "none" ? "" : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Chọn nhóm" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Bỏ nhóm</SelectItem>
                {customerGroups.map((g) => (
                  <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkGroupOpen(false)}>Hủy</Button>
            <Button
              onClick={() =>
                bulkUpdateGroupMutation.mutate({
                  ids: Array.from(selectedIds),
                  groupId: bulkGroupId || null,
                })
              }
              disabled={bulkUpdateGroupMutation.isPending}
            >
              {bulkUpdateGroupMutation.isPending ? "Đang lưu..." : "Cập nhật"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CustomersPage;
