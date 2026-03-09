import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
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
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { useDebounce } from "@/hooks/use-debounce";
import { formatCurrency } from "@/components/CurrencyInput";

type Category = {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
};

type ProductCount = { category_id: string; count: number };

type ProductBasic = {
  id: string;
  code: string;
  name: string;
  sale_price: number;
  stock_quantity: number;
  category_id: string | null;
};

const CategoriesPage = () => {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const debouncedSearch = useDebounce(search, 300);

  // Product assignment state (for Add dialog)
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
  const [productSearch, setProductSearch] = useState("");
  const debouncedProductSearch = useDebounce(productSearch, 300);

  // ─── Queries ─────────────────────────────────────────────
  const { data: categories = [], isLoading } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Category[];
    },
  });

  const { data: productCounts = [] } = useQuery({
    queryKey: ["category-product-counts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("category_id");
      if (error) throw error;
      const counts: Record<string, number> = {};
      (data || []).forEach((p) => {
        if (p.category_id) {
          counts[p.category_id] = (counts[p.category_id] || 0) + 1;
        }
      });
      return Object.entries(counts).map(([category_id, count]) => ({ category_id, count })) as ProductCount[];
    },
  });

  // Products in selected category (for Sheet)
  const { data: categoryProducts = [], isLoading: productsLoading } = useQuery({
    queryKey: ["category-products", selectedCategory?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, code, name, sale_price, stock_quantity, category_id")
        .eq("category_id", selectedCategory!.id)
        .order("name");
      if (error) throw error;
      return data as ProductBasic[];
    },
    enabled: !!selectedCategory,
  });

  // All products (for assignment in Add dialog)
  const { data: allProducts = [] } = useQuery({
    queryKey: ["all-products-for-assign"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, code, name, sale_price, stock_quantity, category_id")
        .order("name");
      if (error) throw error;
      return data as ProductBasic[];
    },
    enabled: open && !editing, // only fetch when Add dialog is open
  });

  const countMap = useMemo(() => {
    const map: Record<string, number> = {};
    productCounts.forEach((pc) => { map[pc.category_id] = pc.count; });
    return map;
  }, [productCounts]);

  const filtered = useMemo(() => {
    if (!debouncedSearch.trim()) return categories;
    const q = debouncedSearch.toLowerCase();
    return categories.filter((c) => c.name.toLowerCase().includes(q));
  }, [categories, debouncedSearch]);

  // Filter products in the assignment list
  const filteredAssignProducts = useMemo(() => {
    if (!debouncedProductSearch.trim()) return allProducts;
    const q = debouncedProductSearch.toLowerCase();
    return allProducts.filter(
      (p) => p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q)
    );
  }, [allProducts, debouncedProductSearch]);

  // ─── Mutations ─────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editing) {
        const { error } = await supabase
          .from("categories")
          .update({ name, description: description || null })
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        // Step A: Insert category
        const { data: newCategory, error } = await supabase
          .from("categories")
          .insert({ name, description: description || null })
          .select()
          .single();
        if (error) throw error;

        // Step B: Assign selected products
        if (newCategory && selectedProductIds.size > 0) {
          const { error: updateErr } = await supabase
            .from("products")
            .update({ category_id: newCategory.id })
            .in("id", Array.from(selectedProductIds));
          if (updateErr) throw updateErr;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      queryClient.invalidateQueries({ queryKey: ["category-product-counts"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success(editing ? "Đã cập nhật nhóm hàng" : "Đã thêm nhóm hàng");
      closeDialog();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (cat: Category) => {
      const { count, error: countErr } = await supabase
        .from("products")
        .select("id", { count: "exact", head: true })
        .eq("category_id", cat.id);
      if (countErr) throw countErr;
      if (count && count > 0) {
        throw new Error(`Nhóm hàng "${cat.name}" đang có ${count} sản phẩm. Vui lòng chuyển sản phẩm sang nhóm khác trước khi xóa.`);
      }
      const { error } = await supabase.from("categories").delete().eq("id", cat.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      queryClient.invalidateQueries({ queryKey: ["category-product-counts"] });
      toast.success("Đã xóa nhóm hàng");
      setDeleteTarget(null);
    },
    onError: (e: any) => {
      toast.error(e.message);
      setDeleteTarget(null);
    },
  });

  // ─── Handlers ──────────────────────────────────────────
  const openAdd = () => {
    setEditing(null);
    setName("");
    setDescription("");
    setSelectedProductIds(new Set());
    setProductSearch("");
    setOpen(true);
  };

  const openEdit = (cat: Category) => {
    setEditing(cat);
    setName(cat.name);
    setDescription(cat.description || "");
    setSelectedProductIds(new Set());
    setProductSearch("");
    setOpen(true);
  };

  const closeDialog = () => {
    setOpen(false);
    setEditing(null);
    setSelectedProductIds(new Set());
    setProductSearch("");
  };

  const toggleProductSelect = (id: string) => {
    setSelectedProductIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // ═══ RENDER ════════════════════════════════════════════
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Nhóm hàng hóa</h1>
        <Button onClick={openAdd}>
          <Plus className="mr-2 h-4 w-4" /> Thêm nhóm
        </Button>
      </div>

      {/* Search */}
      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Tìm theo tên nhóm hàng..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="bg-card rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Tên nhóm</TableHead>
              <TableHead>Ghi chú</TableHead>
              <TableHead className="text-right">Số lượng mặt hàng</TableHead>
              <TableHead className="w-[100px]">Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Đang tải...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">{search ? "Không tìm thấy nhóm hàng" : "Chưa có nhóm hàng nào"}</TableCell></TableRow>
            ) : (
              filtered.map((cat) => (
                <TableRow
                  key={cat.id}
                  className="cursor-pointer"
                  onClick={() => setSelectedCategory(cat)}
                >
                  <TableCell className="font-medium">{cat.name}</TableCell>
                  <TableCell className="text-muted-foreground max-w-[300px] truncate">{cat.description || "—"}</TableCell>
                  <TableCell className="text-right font-medium">{countMap[cat.id] || 0}</TableCell>
                  <TableCell>
                    <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(cat)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(cat)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* ═══ CATEGORY PRODUCTS SHEET ═══ */}
      <Sheet open={!!selectedCategory} onOpenChange={(o) => { if (!o) setSelectedCategory(null); }}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Sản phẩm trong nhóm: {selectedCategory?.name}</SheetTitle>
          </SheetHeader>
          <div className="mt-4">
            {productsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : categoryProducts.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Chưa có sản phẩm nào trong nhóm này.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Mã hàng</TableHead>
                    <TableHead>Tên hàng</TableHead>
                    <TableHead className="text-right">Giá bán</TableHead>
                    <TableHead className="text-right">Tồn kho</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categoryProducts.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-mono text-xs">{p.code}</TableCell>
                      <TableCell>{p.name}</TableCell>
                      <TableCell className="text-right">{formatCurrency(p.sale_price)}</TableCell>
                      <TableCell className="text-right">{p.stock_quantity}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* ═══ ADD/EDIT DIALOG ═══ */}
      <Dialog open={open} onOpenChange={(o) => { if (!o) closeDialog(); else setOpen(true); }}>
        <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{editing ? "Sửa nhóm hàng" : "Thêm nhóm hàng"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 flex-1 overflow-y-auto pr-1">
            <div>
              <Label>Tên nhóm *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nhập tên nhóm" />
            </div>
            <div>
              <Label>Ghi chú</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Nhập ghi chú" />
            </div>

            {/* Product assignment - only for new categories */}
            {!editing && (
              <div>
                <Label className="mb-2 block">Thêm sản phẩm vào nhóm</Label>
                <div className="relative mb-2">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Tìm sản phẩm theo tên, mã..."
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    className="pl-8 h-8 text-xs"
                  />
                </div>
                {selectedProductIds.size > 0 && (
                  <p className="text-xs text-primary font-medium mb-2">
                    Đã chọn {selectedProductIds.size} sản phẩm
                  </p>
                )}
                <div className="border rounded-md max-h-[200px] overflow-y-auto">
                  {filteredAssignProducts.length === 0 ? (
                    <p className="text-center text-muted-foreground text-xs py-4">
                      {allProducts.length === 0 ? "Chưa có sản phẩm nào" : "Không tìm thấy"}
                    </p>
                  ) : (
                    filteredAssignProducts.map((p) => (
                      <label
                        key={p.id}
                        className="flex items-center gap-3 px-3 py-2 text-sm border-b last:border-b-0 hover:bg-accent cursor-pointer"
                      >
                        <Checkbox
                          checked={selectedProductIds.has(p.id)}
                          onCheckedChange={() => toggleProductSelect(p.id)}
                        />
                        <span className="font-mono text-xs text-muted-foreground w-16 shrink-0">{p.code}</span>
                        <span className="flex-1 truncate">{p.name}</span>
                        {p.category_id && (
                          <span className="text-xs text-muted-foreground">Đã có nhóm</span>
                        )}
                      </label>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Hủy</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={!name.trim() || saveMutation.isPending}>
              {saveMutation.isPending ? "Đang lưu..." : "Lưu"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận xóa</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc muốn xóa nhóm hàng "{deleteTarget?.name}"? Hành động này không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? "Đang xóa..." : "Xóa"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default CategoriesPage;
