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
  MoreHorizontal, Pencil, ChevronUp, ChevronDown, ToggleLeft, ToggleRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useDebounce } from "@/hooks/use-debounce";
import { formatCurrency } from "@/components/CurrencyInput";
import * as XLSX from "xlsx";
import { EntityLink } from "@/components/shared/EntityLink";

// ─── Types ───────────────────────────────────────────────────
type Supplier = {
  id: string;
  code: string;
  name: string;
  phone: string | null;
  address: string | null;
  email: string | null;
  company: string | null;
  tax_code: string | null;
  notes: string | null;
  status: string;
  created_at: string;
};

type ImportOrder = {
  id: string;
  code: string;
  total_amount: number;
  amount_paid: number;
  status: string;
  created_at: string;
};

type PaymentSlip = {
  id: string;
  code: string;
  amount: number;
  payment_method: string;
  notes: string | null;
  created_at: string;
};

type SortField = "code" | "name" | "debt" | "spend";
type SortDir = "asc" | "desc";
type DebtFilter = "all" | "has_debt";

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" }> = {
  completed: { label: "Đã nhập hàng", variant: "default" },
  draft: { label: "Phiếu tạm", variant: "secondary" },
  cancelled: { label: "Đã hủy", variant: "destructive" },
};

async function generateSupplierCode(): Promise<string> {
  const { data } = await supabase
    .from("suppliers")
    .select("code")
    .like("code", "NCC%")
    .order("code", { ascending: false })
    .limit(1);
  if (data && data.length > 0) {
    const lastNum = parseInt(data[0].code.replace("NCC", ""), 10);
    return `NCC${String(lastNum + 1).padStart(4, "0")}`;
  }
  return "NCC0001";
}

// ═════════════════════════════════════════════════════════════
const SuppliersPage = () => {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  // UI state
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [detailSupplier, setDetailSupplier] = useState<Supplier | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Supplier | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  // Form state
  const [formCode, setFormCode] = useState("");
  const [formName, setFormName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formTaxCode, setFormTaxCode] = useState("");

  // Filter state
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string[]>(["active", "inactive"]);
  const [debtFilter, setDebtFilter] = useState<DebtFilter>("all");
  const debouncedSearch = useDebounce(search, 300);

  // Sort
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  // Bulk
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // ─── Queries ─────────────────────────────────────────────
  const { data: suppliers = [], isLoading } = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suppliers")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Supplier[];
    },
  });

  // Aggregates: total_spend and debt per supplier from import_orders + payment_slips
  const { data: importAggregates = {} } = useQuery({
    queryKey: ["supplier-import-aggregates"],
    queryFn: async () => {
      const { data: orders, error: ordersErr } = await supabase
        .from("import_orders")
        .select("supplier_id, total_amount, amount_paid, status");
      if (ordersErr) throw ordersErr;

      const agg: Record<string, { spend: number; debt: number }> = {};
      (orders || []).forEach((o) => {
        if (!o.supplier_id || o.status === "cancelled") return;
        if (!agg[o.supplier_id]) agg[o.supplier_id] = { spend: 0, debt: 0 };
        agg[o.supplier_id].spend += Number(o.total_amount);
        agg[o.supplier_id].debt += Number(o.total_amount) - Number(o.amount_paid);
      });
      return agg;
    },
  });

  // Detail: Import history
  const { data: importHistory = [], isLoading: importsLoading } = useQuery({
    queryKey: ["supplier-import-history", detailSupplier?.id],
    queryFn: async () => {
      if (!detailSupplier) return [];
      const { data, error } = await supabase
        .from("import_orders")
        .select("id, code, total_amount, amount_paid, status, created_at")
        .eq("supplier_id", detailSupplier.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as ImportOrder[];
    },
    enabled: !!detailSupplier,
  });

  // Detail: Payment slips for this supplier's import orders
  const { data: paymentSlips = [], isLoading: slipsLoading } = useQuery({
    queryKey: ["supplier-payment-slips", detailSupplier?.id],
    queryFn: async () => {
      if (!detailSupplier) return [];
      // Get import order IDs for this supplier
      const { data: orders } = await supabase
        .from("import_orders")
        .select("id")
        .eq("supplier_id", detailSupplier.id);
      if (!orders || orders.length === 0) return [];
      const orderIds = orders.map((o) => o.id);
      const { data, error } = await supabase
        .from("payment_slips")
        .select("*")
        .in("import_order_id", orderIds)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as PaymentSlip[];
    },
    enabled: !!detailSupplier,
  });

  // Auto-open from URL param
  useEffect(() => {
    const supplierId = searchParams.get("supplierId");
    if (supplierId && suppliers.length > 0) {
      const found = suppliers.find((s) => s.id === supplierId);
      if (found && detailSupplier?.id !== supplierId) {
        setDetailSupplier(found);
      }
    }
  }, [searchParams, suppliers, detailSupplier?.id]);

  // ─── Filter & Sort ──────────────────────────────────────
  const filtered = useMemo(() => {
    let result = suppliers;

    // Search
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase();
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.code.toLowerCase().includes(q) ||
          (s.phone || "").includes(q)
      );
    }

    // Status
    if (statusFilter.length < 2) {
      result = result.filter((s) => statusFilter.includes(s.status || "active"));
    }

    // Debt
    if (debtFilter === "has_debt") {
      result = result.filter((s) => (importAggregates[s.id]?.debt || 0) > 0);
    }

    // Sort
    result = [...result].sort((a, b) => {
      let cmp = 0;
      if (sortField === "name") cmp = a.name.localeCompare(b.name, "vi");
      else if (sortField === "code") cmp = a.code.localeCompare(b.code);
      else if (sortField === "spend") cmp = (importAggregates[a.id]?.spend || 0) - (importAggregates[b.id]?.spend || 0);
      else if (sortField === "debt") cmp = (importAggregates[a.id]?.debt || 0) - (importAggregates[b.id]?.debt || 0);
      return sortDir === "desc" ? -cmp : cmp;
    });

    return result;
  }, [suppliers, debouncedSearch, statusFilter, debtFilter, sortField, sortDir, importAggregates]);

  // ─── Mutations ─────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        name: formName.trim(),
        phone: formPhone || null,
        address: formAddress || null,
        email: formEmail || null,
        tax_code: formTaxCode || null,
      };
      if (editingSupplier) {
        const { error } = await supabase.from("suppliers").update(payload).eq("id", editingSupplier.id);
        if (error) throw error;
      } else {
        payload.code = formCode;
        const { error } = await supabase.from("suppliers").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      toast.success(editingSupplier ? "Đã cập nhật NCC" : "Đã thêm NCC");
      closeFormDialog();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("suppliers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      toast.success("Đã xóa NCC");
      setDeleteTarget(null);
      if (detailSupplier) setDetailSupplier(null);
    },
    onError: (e: any) => {
      setDeleteTarget(null);
      if (e.message?.includes("foreign key")) {
        toast.error("Không thể xóa NCC đã có phiếu nhập hàng");
      } else {
        toast.error(e.message);
      }
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from("suppliers").delete().in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      setSelectedIds(new Set());
      setBulkDeleteOpen(false);
      toast.success("Đã xóa NCC");
    },
    onError: (e: any) => {
      setBulkDeleteOpen(false);
      if (e.message?.includes("foreign key")) {
        toast.error("Không thể xóa NCC đã có phiếu nhập hàng");
      } else {
        toast.error(e.message);
      }
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ ids, newStatus }: { ids: string[]; newStatus: string }) => {
      const { error } = await supabase.from("suppliers").update({ status: newStatus }).in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      setSelectedIds(new Set());
      toast.success("Đã cập nhật trạng thái");
    },
    onError: (e: any) => toast.error(e.message),
  });

  // ─── Handlers ──────────────────────────────────────────
  const openAdd = async () => {
    setEditingSupplier(null);
    setFormCode(await generateSupplierCode());
    setFormName("");
    setFormPhone("");
    setFormAddress("");
    setFormEmail("");
    setFormTaxCode("");
    setAddDialogOpen(true);
  };

  const openEdit = (s: Supplier) => {
    setEditingSupplier(s);
    setFormCode(s.code);
    setFormName(s.name);
    setFormPhone(s.phone || "");
    setFormAddress(s.address || "");
    setFormEmail(s.email || "");
    setFormTaxCode(s.tax_code || "");
    setAddDialogOpen(true);
  };

  const closeFormDialog = () => {
    setAddDialogOpen(false);
    setEditingSupplier(null);
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
    else setSelectedIds(new Set(filtered.map((s) => s.id)));
  };

  const toggleStatusFilterItem = (s: string) => {
    setStatusFilter((prev) =>
      prev.includes(s) ? prev.filter((v) => v !== s) : [...prev, s]
    );
  };

  // Export
  const handleExportExcel = useCallback(() => {
    const exportData = filtered.map((s) => ({
      "Mã NCC": s.code,
      "Tên nhà cung cấp": s.name,
      "Điện thoại": s.phone || "",
      "Email": s.email || "",
      "Địa chỉ": s.address || "",
      "Mã số thuế": s.tax_code || "",
      "Nợ hiện tại": importAggregates[s.id]?.debt || 0,
      "Tổng mua": importAggregates[s.id]?.spend || 0,
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Nhà cung cấp");
    XLSX.writeFile(wb, `Danh_sach_NCC_${format(new Date(), "yyyyMMdd")}.xlsx`);
    toast.success("Đã xuất file Excel");
  }, [filtered, importAggregates]);

  // Detail computed
  const detailSpend = detailSupplier ? (importAggregates[detailSupplier.id]?.spend || 0) : 0;
  const detailDebt = detailSupplier ? (importAggregates[detailSupplier.id]?.debt || 0) : 0;

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
                placeholder="Tên, SĐT, mã NCC..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-8 text-xs"
              />
            </div>
          </div>

          {/* Status */}
          <div className="p-4 border-b space-y-2">
            <Label className="text-xs font-medium">Trạng thái</Label>
            <div className="space-y-1.5">
              {[
                { value: "active", label: "Đang hoạt động" },
                { value: "inactive", label: "Ngừng hoạt động" },
              ].map((s) => (
                <label key={s.value} className="flex items-center gap-2 text-xs cursor-pointer">
                  <Checkbox
                    checked={statusFilter.includes(s.value)}
                    onCheckedChange={() => toggleStatusFilterItem(s.value)}
                  />
                  {s.label}
                </label>
              ))}
            </div>
          </div>

          {/* Debt */}
          <div className="p-4 space-y-2">
            <Label className="text-xs font-medium">Công nợ</Label>
            <div className="space-y-1">
              {([
                { value: "all", label: "Tất cả" },
                { value: "has_debt", label: "Đang nợ (> 0)" },
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
            <h1 className="text-2xl font-bold">Nhà cung cấp</h1>
            <Badge variant="secondary" className="ml-2">{filtered.length}</Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExportExcel}>
              <FileDown className="mr-2 h-4 w-4" /> Xuất file
            </Button>
            <Button size="sm" onClick={openAdd}>
              <Plus className="mr-2 h-4 w-4" /> Thêm NCC
            </Button>
          </div>
        </div>

        {/* Bulk actions */}
        {selectedIds.size > 0 && (
          <div className="mb-3 flex items-center gap-2 bg-muted/50 border rounded-lg px-4 py-2">
            <span className="text-sm font-medium">Đã chọn {selectedIds.size} NCC</span>
            <div className="ml-auto flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => toggleStatusMutation.mutate({ ids: Array.from(selectedIds), newStatus: "inactive" })}
              >
                <ToggleLeft className="mr-1.5 h-3.5 w-3.5" /> Ngừng HĐ
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => toggleStatusMutation.mutate({ ids: Array.from(selectedIds), newStatus: "active" })}
              >
                <ToggleRight className="mr-1.5 h-3.5 w-3.5" /> Kích hoạt
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
                <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("code")}>
                  Mã NCC <SortIcon field="code" />
                </TableHead>
                <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("name")}>
                  Tên nhà cung cấp <SortIcon field="name" />
                </TableHead>
                <TableHead>Điện thoại</TableHead>
                <TableHead className="text-right cursor-pointer select-none" onClick={() => toggleSort("debt")}>
                  Nợ hiện tại <SortIcon field="debt" />
                </TableHead>
                <TableHead className="text-right cursor-pointer select-none" onClick={() => toggleSort("spend")}>
                  Tổng mua <SortIcon field="spend" />
                </TableHead>
                <TableHead className="w-[60px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Đang tải...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Không tìm thấy NCC nào</TableCell></TableRow>
              ) : (
                filtered.map((s) => {
                  const spend = importAggregates[s.id]?.spend || 0;
                  const debt = importAggregates[s.id]?.debt || 0;
                  const isInactive = s.status === "inactive";
                  return (
                    <TableRow
                      key={s.id}
                      className={cn("cursor-pointer", isInactive && "opacity-50")}
                      onClick={() => setDetailSupplier(s)}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedIds.has(s.id)}
                          onCheckedChange={() => toggleSelect(s.id)}
                        />
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        <EntityLink type="supplier" id={s.id} code={s.code} />
                      </TableCell>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell className="text-sm">{s.phone || "—"}</TableCell>
                      <TableCell className={cn("text-right", debt > 0 && "text-destructive font-medium")}>
                        {debt > 0 ? formatCurrency(debt) : "0"}
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(spend)}</TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEdit(s)}>
                              <Pencil className="mr-2 h-4 w-4" /> Sửa
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                toggleStatusMutation.mutate({
                                  ids: [s.id],
                                  newStatus: isInactive ? "active" : "inactive",
                                })
                              }
                            >
                              <ToggleLeft className="mr-2 h-4 w-4" />
                              {isInactive ? "Kích hoạt" : "Ngừng HĐ"}
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive" onClick={() => setDeleteTarget(s)}>
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
      <Sheet open={!!detailSupplier} onOpenChange={(o) => { if (!o) setDetailSupplier(null); }}>
        <SheetContent className="sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              {detailSupplier?.name}
              <Badge variant="secondary" className="font-mono text-xs">{detailSupplier?.code}</Badge>
            </SheetTitle>
          </SheetHeader>

          {detailSupplier && (
            <Tabs defaultValue="info" className="mt-4">
              <TabsList className="w-full">
                <TabsTrigger value="info" className="flex-1">Thông tin</TabsTrigger>
                <TabsTrigger value="imports" className="flex-1">Lịch sử nhập hàng</TabsTrigger>
                <TabsTrigger value="debt" className="flex-1">Nợ cần trả</TabsTrigger>
              </TabsList>

              {/* Tab 1: Info */}
              <TabsContent value="info" className="mt-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-muted/50 rounded-lg p-4">
                    <p className="text-xs text-muted-foreground">Tổng mua</p>
                    <p className="text-xl font-bold text-primary">{formatCurrency(detailSpend)}</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-4">
                    <p className="text-xs text-muted-foreground">Nợ hiện tại</p>
                    <p className={cn("text-xl font-bold", detailDebt > 0 ? "text-destructive" : "text-foreground")}>
                      {formatCurrency(detailDebt)}
                    </p>
                  </div>
                </div>

                <div className="space-y-3 text-sm">
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">Mã NCC</span>
                    <span className="font-mono">{detailSupplier.code}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">Điện thoại</span>
                    <span>{detailSupplier.phone || "—"}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">Email</span>
                    <span>{detailSupplier.email || "—"}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">Địa chỉ</span>
                    <span>{detailSupplier.address || "—"}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">Mã số thuế</span>
                    <span>{detailSupplier.tax_code || "—"}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">Trạng thái</span>
                    <Badge variant={detailSupplier.status === "active" ? "default" : "secondary"}>
                      {detailSupplier.status === "active" ? "Hoạt động" : "Ngừng HĐ"}
                    </Badge>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-muted-foreground">Ngày tạo</span>
                    <span>{format(new Date(detailSupplier.created_at), "dd/MM/yyyy HH:mm")}</span>
                  </div>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button variant="outline" size="sm" onClick={() => openEdit(detailSupplier)}>
                    <Pencil className="mr-1.5 h-3.5 w-3.5" /> Cập nhật
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      toggleStatusMutation.mutate({
                        ids: [detailSupplier.id],
                        newStatus: detailSupplier.status === "active" ? "inactive" : "active",
                      })
                    }
                  >
                    <ToggleLeft className="mr-1.5 h-3.5 w-3.5" />
                    {detailSupplier.status === "active" ? "Ngừng HĐ" : "Kích hoạt"}
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => setDeleteTarget(detailSupplier)}>
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Xóa
                  </Button>
                </div>
              </TabsContent>

              {/* Tab 2: Import History */}
              <TabsContent value="imports" className="mt-4">
                {importsLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
                  </div>
                ) : importHistory.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">Chưa có phiếu nhập hàng nào</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead>Mã nhập hàng</TableHead>
                        <TableHead>Thời gian</TableHead>
                        <TableHead className="text-right">Tổng tiền</TableHead>
                        <TableHead className="text-right">Đã trả</TableHead>
                        <TableHead>Trạng thái</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {importHistory.map((o) => {
                        const st = STATUS_MAP[o.status] || { label: o.status, variant: "secondary" as const };
                        return (
                          <TableRow key={o.id}>
                            <TableCell className="font-mono text-xs">{o.code}</TableCell>
                            <TableCell className="text-xs">{format(new Date(o.created_at), "dd/MM/yyyy HH:mm")}</TableCell>
                            <TableCell className="text-right font-medium">{formatCurrency(o.total_amount)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(o.amount_paid)}</TableCell>
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
                <div className="bg-muted/50 rounded-lg p-4 mb-4">
                  <p className="text-xs text-muted-foreground mb-1">Nợ hiện tại</p>
                  <p className={cn("text-2xl font-bold", detailDebt > 0 ? "text-destructive" : "text-foreground")}>
                    {formatCurrency(detailDebt)}
                  </p>
                </div>

                {importsLoading || slipsLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
                  </div>
                ) : (
                  (() => {
                    // Build a combined ledger: imports increase debt, payments decrease
                    const ledger: { date: string; code: string; type: string; amount: number }[] = [];
                    importHistory
                      .filter((o) => o.status !== "cancelled")
                      .forEach((o) => {
                        ledger.push({
                          date: o.created_at,
                          code: o.code,
                          type: "Nhập hàng",
                          amount: Number(o.total_amount),
                        });
                      });
                    paymentSlips.forEach((p) => {
                      ledger.push({
                        date: p.created_at,
                        code: p.code,
                        type: "Thanh toán",
                        amount: -Number(p.amount),
                      });
                    });
                    ledger.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

                    if (ledger.length === 0) {
                      return <p className="text-center text-muted-foreground py-4">Không có giao dịch</p>;
                    }

                    return (
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/50">
                            <TableHead>Chứng từ</TableHead>
                            <TableHead>Loại</TableHead>
                            <TableHead>Thời gian</TableHead>
                            <TableHead className="text-right">Phát sinh</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {ledger.map((item, idx) => (
                            <TableRow key={idx}>
                              <TableCell className="font-mono text-xs">{item.code}</TableCell>
                              <TableCell>
                                <Badge variant={item.amount > 0 ? "destructive" : "default"} className="text-xs">
                                  {item.type}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-xs">{format(new Date(item.date), "dd/MM/yyyy HH:mm")}</TableCell>
                              <TableCell className={cn("text-right font-medium", item.amount > 0 ? "text-destructive" : "text-primary")}>
                                {item.amount > 0 ? "+" : ""}{formatCurrency(Math.abs(item.amount))}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    );
                  })()
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
            <DialogTitle>{editingSupplier ? "Sửa nhà cung cấp" : "Thêm nhà cung cấp"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Mã NCC</Label>
              <Input value={formCode} disabled className="font-mono bg-muted" />
            </div>
            <div>
              <Label>Tên nhà cung cấp *</Label>
              <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Nhập tên NCC" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Điện thoại</Label>
                <Input value={formPhone} onChange={(e) => setFormPhone(e.target.value)} placeholder="SĐT" />
              </div>
              <div>
                <Label>Email</Label>
                <Input value={formEmail} onChange={(e) => setFormEmail(e.target.value)} placeholder="Email" type="email" />
              </div>
            </div>
            <div>
              <Label>Địa chỉ</Label>
              <Input value={formAddress} onChange={(e) => setFormAddress(e.target.value)} placeholder="Nhập địa chỉ" />
            </div>
            <div>
              <Label>Mã số thuế</Label>
              <Input value={formTaxCode} onChange={(e) => setFormTaxCode(e.target.value)} placeholder="MST" />
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
              Bạn có chắc muốn xóa NCC "{deleteTarget?.name}" ({deleteTarget?.code})?
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
              Bạn có chắc muốn xóa {selectedIds.size} NCC đã chọn? NCC đã có phiếu nhập hàng sẽ không thể xóa.
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
    </div>
  );
};

export default SuppliersPage;
