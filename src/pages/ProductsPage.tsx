import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
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
import { toast } from "sonner";
import {
  Plus, Search, Filter, Trash2, FileDown, PanelLeftClose, PanelLeft,
  MoreHorizontal, History, ToggleLeft, ToggleRight, Barcode,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useDebounce } from "@/hooks/use-debounce";
import { formatCurrency, CurrencyInput } from "@/components/CurrencyInput";
import { AddProductModal } from "@/components/AddProductModal";
import { StockLedgerSheet } from "@/components/StockLedgerSheet";
import * as XLSX from "xlsx";
import { BarcodePrintDialog } from "@/components/BarcodePrintDialog";

type Product = {
  id: string;
  code: string;
  name: string;
  category_id: string | null;
  cost_price: number;
  sale_price: number;
  stock_quantity: number;
  status: string;
  created_at: string;
  categories: { name: string } | null;
};

type StockFilter = "all" | "low" | "in_stock" | "out_of_stock";

const ProductsPage = () => {
  const queryClient = useQueryClient();

  // UI state
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [ledgerProduct, setLedgerProduct] = useState<Product | null>(null);
  const [barcodeOpen, setBarcodeOpen] = useState(false);
  const [barcodeProducts, setBarcodeProducts] = useState<Product[]>([]);

  // Edit sheet
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [editName, setEditName] = useState("");
  const [editCode, setEditCode] = useState("");
  const [editCategoryId, setEditCategoryId] = useState("");
  const [editCostPrice, setEditCostPrice] = useState(0);
  const [editSalePrice, setEditSalePrice] = useState(0);
  const [editStatus, setEditStatus] = useState("active");

  // Filters
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<string[]>(["active", "inactive"]);
  const [stockFilter, setStockFilter] = useState<StockFilter>("all");
  const debouncedSearch = useDebounce(search, 300);

  // Bulk
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  // Queries
  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*, categories(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Product[];
    },
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("id, name").order("name");
      if (error) throw error;
      return data as { id: string; name: string }[];
    },
  });

  // Filter logic
  const filtered = useMemo(() => {
    let result = products;

    // Search
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase();
      result = result.filter(
        (p) => p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q)
      );
    }

    // Category
    if (categoryFilter !== "all") {
      if (categoryFilter === "none") {
        result = result.filter((p) => !p.category_id);
      } else {
        result = result.filter((p) => p.category_id === categoryFilter);
      }
    }

    // Status
    if (statusFilter.length < 2) {
      result = result.filter((p) => statusFilter.includes(p.status || "active"));
    }

    // Stock
    if (stockFilter === "low") result = result.filter((p) => p.stock_quantity > 0 && p.stock_quantity <= 5);
    else if (stockFilter === "in_stock") result = result.filter((p) => p.stock_quantity > 0);
    else if (stockFilter === "out_of_stock") result = result.filter((p) => p.stock_quantity === 0);

    return result;
  }, [products, debouncedSearch, categoryFilter, statusFilter, stockFilter]);

  // Mutations
  const toggleStatusMutation = useMutation({
    mutationFn: async ({ ids, newStatus }: { ids: string[]; newStatus: string }) => {
      const { error } = await supabase
        .from("products")
        .update({ status: newStatus })
        .in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setSelectedIds(new Set());
      toast.success("Đã cập nhật trạng thái");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from("products").delete().in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setSelectedIds(new Set());
      setBulkDeleteOpen(false);
      toast.success("Đã xóa sản phẩm");
    },
    onError: (e: any) => {
      setBulkDeleteOpen(false);
      if (e.message?.includes("foreign key")) {
        toast.error("Không thể xóa sản phẩm đã có trong đơn nhập/bán hàng");
      } else {
        toast.error(e.message);
      }
    },
  });

  const updateProductMutation = useMutation({
    mutationFn: async () => {
      if (!editProduct) return;
      const { error } = await supabase
        .from("products")
        .update({
          name: editName.trim(),
          code: editCode.trim(),
          category_id: editCategoryId || null,
          cost_price: editCostPrice,
          sale_price: editSalePrice,
          status: editStatus,
        })
        .eq("id", editProduct.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setEditProduct(null);
      toast.success("Đã cập nhật sản phẩm");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteSingleMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Đã xóa sản phẩm");
    },
    onError: (e: any) => {
      if (e.message?.includes("foreign key")) {
        toast.error("Không thể xóa sản phẩm đã có trong đơn nhập/bán hàng");
      } else {
        toast.error(e.message);
      }
    },
  });

  // Handlers
  const openEditSheet = (p: Product) => {
    setEditProduct(p);
    setEditName(p.name);
    setEditCode(p.code);
    setEditCategoryId(p.category_id || "");
    setEditCostPrice(p.cost_price);
    setEditSalePrice(p.sale_price);
    setEditStatus(p.status || "active");
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((p) => p.id)));
    }
  };

  const toggleStatusFilterItem = (s: string) => {
    setStatusFilter((prev) =>
      prev.includes(s) ? prev.filter((v) => v !== s) : [...prev, s]
    );
  };

  // Export
  const handleExportExcel = useCallback(() => {
    const exportData = filtered.map((p) => ({
      "Mã hàng": p.code,
      "Tên hàng": p.name,
      "Nhóm hàng": p.categories?.name || "",
      "Giá vốn": p.cost_price,
      "Giá bán": p.sale_price,
      "Tồn kho": p.stock_quantity,
      "Trạng thái": p.status === "active" ? "Đang kinh doanh" : "Ngừng kinh doanh",
      "Ngày tạo": format(new Date(p.created_at), "dd/MM/yyyy HH:mm"),
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Hàng hóa");
    XLSX.writeFile(wb, `Danh_sach_hang_hoa_${format(new Date(), "yyyyMMdd")}.xlsx`);
    toast.success("Đã xuất file Excel");
  }, [filtered]);

  const inputClass =
    "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

  return (
    <div className="flex h-[calc(100vh-2rem)] -m-6">
      {/* ═══ SIDEBAR FILTERS ═══ */}
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
                placeholder="Tên hoặc mã hàng..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-8 text-xs"
              />
            </div>
          </div>

          {/* Category Filter */}
          <div className="p-4 border-b space-y-2">
            <Label className="text-xs font-medium">Nhóm hàng</Label>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Tất cả" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả</SelectItem>
                <SelectItem value="none">Chưa phân nhóm</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Status Filter */}
          <div className="p-4 border-b space-y-2">
            <Label className="text-xs font-medium">Trạng thái</Label>
            <div className="space-y-1.5">
              {[
                { value: "active", label: "Đang kinh doanh" },
                { value: "inactive", label: "Ngừng kinh doanh" },
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

          {/* Stock Filter */}
          <div className="p-4 space-y-2">
            <Label className="text-xs font-medium">Tồn kho</Label>
            <div className="space-y-1">
              {([
                { value: "all", label: "Tất cả" },
                { value: "in_stock", label: "Còn hàng (> 0)" },
                { value: "low", label: "Dưới định mức (≤ 5)" },
                { value: "out_of_stock", label: "Hết hàng (= 0)" },
              ] as { value: StockFilter; label: string }[]).map((s) => (
                <button
                  key={s.value}
                  onClick={() => setStockFilter(s.value)}
                  className={cn(
                    "w-full text-left text-xs px-2.5 py-1.5 rounded-md transition-colors",
                    stockFilter === s.value
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-accent text-foreground"
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ═══ MAIN CONTENT ═══ */}
      <div className="flex-1 flex flex-col overflow-hidden p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            {!sidebarOpen && (
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSidebarOpen(true)}>
                <PanelLeft className="h-4 w-4" />
              </Button>
            )}
            <h1 className="text-2xl font-bold">Hàng hóa</h1>
            <Badge variant="secondary" className="ml-2">{filtered.length}</Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExportExcel}>
              <FileDown className="mr-2 h-4 w-4" /> Xuất file
            </Button>
            <Button size="sm" onClick={() => setAddModalOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> Thêm mới
            </Button>
          </div>
        </div>

        {/* Bulk actions bar */}
        {selectedIds.size > 0 && (
          <div className="mb-3 flex items-center gap-2 bg-muted/50 border rounded-lg px-4 py-2">
            <span className="text-sm font-medium">Đã chọn {selectedIds.size} sản phẩm</span>
            <div className="ml-auto flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => toggleStatusMutation.mutate({ ids: Array.from(selectedIds), newStatus: "active" })}
              >
                <ToggleRight className="mr-1.5 h-3.5 w-3.5" /> Cho phép KD
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => toggleStatusMutation.mutate({ ids: Array.from(selectedIds), newStatus: "inactive" })}
              >
                <ToggleLeft className="mr-1.5 h-3.5 w-3.5" /> Ngừng KD
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setBarcodeProducts(products.filter((p) => selectedIds.has(p.id)));
                  setBarcodeOpen(true);
                }}
              >
                <Barcode className="mr-1.5 h-3.5 w-3.5" /> In tem mã
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setBulkDeleteOpen(true)}
              >
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
                <TableHead>Mã hàng</TableHead>
                <TableHead>Tên hàng</TableHead>
                <TableHead>Nhóm hàng</TableHead>
                <TableHead className="text-right">Giá vốn</TableHead>
                <TableHead className="text-right">Giá bán</TableHead>
                <TableHead className="text-right">Tồn kho</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead>Ngày tạo</TableHead>
                <TableHead className="w-[80px]">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground">Đang tải...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground">Không tìm thấy sản phẩm nào</TableCell></TableRow>
              ) : (
                filtered.map((p) => {
                  const isInactive = p.status === "inactive";
                  return (
                    <TableRow
                      key={p.id}
                      className={cn(
                        "cursor-pointer",
                        isInactive && "opacity-50"
                      )}
                      onClick={() => openEditSheet(p)}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedIds.has(p.id)}
                          onCheckedChange={() => toggleSelect(p.id)}
                        />
                      </TableCell>
                      <TableCell className="font-mono text-xs">{p.code}</TableCell>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{p.categories?.name || "—"}</TableCell>
                      <TableCell className="text-right">{formatCurrency(p.cost_price)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(p.sale_price)}</TableCell>
                      <TableCell className="text-right font-medium">{p.stock_quantity}</TableCell>
                      <TableCell>
                        <Badge variant={isInactive ? "secondary" : "default"} className="text-xs">
                          {isInactive ? "Ngừng KD" : "Đang KD"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {format(new Date(p.created_at), "dd/MM/yyyy")}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setLedgerProduct(p)}>
                              <History className="mr-2 h-4 w-4" /> Lịch sử kho
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => {
                              setBarcodeProducts([p]);
                              setBarcodeOpen(true);
                            }}>
                              <Barcode className="mr-2 h-4 w-4" /> In tem mã vạch
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                toggleStatusMutation.mutate({
                                  ids: [p.id],
                                  newStatus: isInactive ? "active" : "inactive",
                                })
                              }
                            >
                              {isInactive ? (
                                <><ToggleRight className="mr-2 h-4 w-4" /> Cho phép KD</>
                              ) : (
                                <><ToggleLeft className="mr-2 h-4 w-4" /> Ngừng KD</>
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => deleteSingleMutation.mutate(p.id)}
                            >
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

      {/* ═══ EDIT PRODUCT SHEET ═══ */}
      <Sheet open={!!editProduct} onOpenChange={(o) => { if (!o) setEditProduct(null); }}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Chỉnh sửa sản phẩm</SheetTitle>
          </SheetHeader>
          {editProduct && (
            <div className="mt-6 space-y-4">
              <div>
                <Label>Mã hàng hóa</Label>
                <Input value={editCode} onChange={(e) => setEditCode(e.target.value)} className="font-mono" />
              </div>
              <div>
                <Label>Tên sản phẩm *</Label>
                <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
              </div>
              <div>
                <Label>Nhóm hàng</Label>
                <Select value={editCategoryId || "none"} onValueChange={(v) => setEditCategoryId(v === "none" ? "" : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn nhóm hàng" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Không có nhóm</SelectItem>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Giá vốn</Label>
                  <CurrencyInput value={editCostPrice} onChange={setEditCostPrice} className={inputClass} />
                </div>
                <div>
                  <Label>Giá bán</Label>
                  <CurrencyInput value={editSalePrice} onChange={setEditSalePrice} className={inputClass} />
                </div>
              </div>
              <div>
                <Label>Tồn kho</Label>
                <Input value={editProduct.stock_quantity} disabled className="bg-muted" />
              </div>
              <div>
                <Label>Trạng thái</Label>
                <Select value={editStatus} onValueChange={setEditStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Đang kinh doanh</SelectItem>
                    <SelectItem value="inactive">Ngừng kinh doanh</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2 pt-4">
                <Button variant="outline" className="flex-1" onClick={() => setEditProduct(null)}>
                  Hủy
                </Button>
                <Button
                  className="flex-1"
                  onClick={() => updateProductMutation.mutate()}
                  disabled={!editName.trim() || updateProductMutation.isPending}
                >
                  {updateProductMutation.isPending ? "Đang lưu..." : "Lưu thay đổi"}
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Add Product Modal */}
      <AddProductModal
        open={addModalOpen}
        onOpenChange={setAddModalOpen}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ["products"] })}
      />

      {/* Stock Ledger */}
      <StockLedgerSheet
        open={!!ledgerProduct}
        onOpenChange={(open) => { if (!open) setLedgerProduct(null); }}
        product={ledgerProduct}
      />

      {/* Bulk Delete Confirm */}
      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận xóa</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc muốn xóa {selectedIds.size} sản phẩm đã chọn? Sản phẩm đã có trong đơn hàng sẽ không thể xóa.
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

      <BarcodePrintDialog
        open={barcodeOpen}
        onOpenChange={setBarcodeOpen}
        products={products.filter((p) => selectedIds.has(p.id)).map((p) => ({
          id: p.id,
          code: p.code,
          name: p.name,
          sale_price: p.sale_price,
          stock_quantity: p.stock_quantity,
        }))}
      />
    </div>
  );
};

export default ProductsPage;
