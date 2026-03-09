import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { useDebounce } from "@/hooks/use-debounce";

type Category = {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
};

type ProductCount = { category_id: string; count: number };

const CategoriesPage = () => {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const debouncedSearch = useDebounce(search, 300);

  // Fetch categories
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

  // Fetch product counts per category
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

  const countMap = useMemo(() => {
    const map: Record<string, number> = {};
    productCounts.forEach((pc) => { map[pc.category_id] = pc.count; });
    return map;
  }, [productCounts]);

  // Filter
  const filtered = useMemo(() => {
    if (!debouncedSearch.trim()) return categories;
    const q = debouncedSearch.toLowerCase();
    return categories.filter((c) => c.name.toLowerCase().includes(q));
  }, [categories, debouncedSearch]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editing) {
        const { error } = await supabase
          .from("categories")
          .update({ name, description: description || null })
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("categories")
          .insert({ name, description: description || null });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast.success(editing ? "Đã cập nhật nhóm hàng" : "Đã thêm nhóm hàng");
      closeDialog();
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Delete mutation with product check
  const deleteMutation = useMutation({
    mutationFn: async (cat: Category) => {
      // Check if category has products
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

  const openAdd = () => {
    setEditing(null);
    setName("");
    setDescription("");
    setOpen(true);
  };

  const openEdit = (cat: Category) => {
    setEditing(cat);
    setName(cat.name);
    setDescription(cat.description || "");
    setOpen(true);
  };

  const closeDialog = () => {
    setOpen(false);
    setEditing(null);
  };

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
                <TableRow key={cat.id}>
                  <TableCell className="font-medium">{cat.name}</TableCell>
                  <TableCell className="text-muted-foreground max-w-[300px] truncate">{cat.description || "—"}</TableCell>
                  <TableCell className="text-right font-medium">{countMap[cat.id] || 0}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
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

      {/* Add/Edit Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Sửa nhóm hàng" : "Thêm nhóm hàng"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Tên nhóm *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nhập tên nhóm" />
            </div>
            <div>
              <Label>Ghi chú</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Nhập ghi chú" />
            </div>
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
