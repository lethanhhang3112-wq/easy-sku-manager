import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";

type Product = {
  id: string;
  code: string;
  name: string;
  category_id: string | null;
  cost_price: number;
  sale_price: number;
  stock_quantity: number;
  created_at: string;
};

type Category = { id: string; name: string };

async function generateProductCode(): Promise<string> {
  const { data } = await supabase
    .from("products")
    .select("code")
    .order("code", { ascending: false })
    .limit(100);

  if (data && data.length > 0) {
    // Find highest numeric code
    let maxNum = 0;
    for (const p of data) {
      const num = parseInt(p.code, 10);
      if (!isNaN(num) && num > maxNum) maxNum = num;
    }
    return String(maxNum + 1).padStart(6, "0");
  }
  return "000001";
}

const formatVND = (n: number) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(n);

const ProductsPage = () => {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [costPrice, setCostPrice] = useState("");
  const [salePrice, setSalePrice] = useState("");

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Product[];
    },
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("id, name").order("name");
      if (error) throw error;
      return data as Category[];
    },
  });

  const categoryMap = Object.fromEntries(categories.map((c) => [c.id, c.name]));

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        code: code.trim(),
        name,
        category_id: categoryId || null,
        cost_price: parseFloat(costPrice) || 0,
        sale_price: parseFloat(salePrice) || 0,
      };
      if (editing) {
        const { error } = await supabase.from("products").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        // Auto-generate code if blank
        if (!payload.code) {
          payload.code = await generateProductCode();
        }
        const { error } = await supabase.from("products").insert({ ...payload, stock_quantity: 0 });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success(editing ? "Đã cập nhật sản phẩm" : "Đã thêm sản phẩm");
      closeDialog();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Đã xóa sản phẩm");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openAdd = () => {
    setEditing(null);
    setCode("");
    setName("");
    setCategoryId("");
    setCostPrice("");
    setSalePrice("");
    setOpen(true);
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    setCode(p.code);
    setName(p.name);
    setCategoryId(p.category_id || "");
    setCostPrice(String(p.cost_price));
    setSalePrice(String(p.sale_price));
    setOpen(true);
  };

  const closeDialog = () => {
    setOpen(false);
    setEditing(null);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Hàng hóa</h1>
        <Button onClick={openAdd}>
          <Plus className="mr-2 h-4 w-4" /> Thêm sản phẩm
        </Button>
      </div>

      <div className="bg-card rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Mã SP</TableHead>
              <TableHead>Tên sản phẩm</TableHead>
              <TableHead>Nhóm</TableHead>
              <TableHead className="text-right">Giá vốn</TableHead>
              <TableHead className="text-right">Giá bán</TableHead>
              <TableHead className="text-right">Tồn kho</TableHead>
              <TableHead className="w-[100px]">Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Đang tải...</TableCell></TableRow>
            ) : products.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Chưa có sản phẩm nào</TableCell></TableRow>
            ) : (
              products.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-mono">{p.code}</TableCell>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell className="text-muted-foreground">{p.category_id ? categoryMap[p.category_id] || "—" : "—"}</TableCell>
                  <TableCell className="text-right">{formatVND(p.cost_price)}</TableCell>
                  <TableCell className="text-right">{formatVND(p.sale_price)}</TableCell>
                  <TableCell className="text-right font-medium">{p.stock_quantity}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(p)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(p.id)}>
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Sửa sản phẩm" : "Thêm sản phẩm"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Mã sản phẩm {!editing && <span className="text-muted-foreground text-xs">(để trống sẽ tự sinh)</span>}</Label>
              <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="VD: 000001" className="font-mono" disabled={!!editing} />
            </div>
            <div>
              <Label>Tên sản phẩm *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nhập tên sản phẩm" />
            </div>
            <div>
              <Label>Nhóm sản phẩm</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger>
                  <SelectValue placeholder="Chọn nhóm" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Giá vốn</Label>
                <Input type="number" value={costPrice} onChange={(e) => setCostPrice(e.target.value)} placeholder="0" />
              </div>
              <div>
                <Label>Giá bán</Label>
                <Input type="number" value={salePrice} onChange={(e) => setSalePrice(e.target.value)} placeholder="0" />
              </div>
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
    </div>
  );
};

export default ProductsPage;
