import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
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
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Plus, Trash2, Eye } from "lucide-react";
import ImportFilterBar, { type FilterState } from "@/components/ImportFilterBar";
import { useDebounce } from "@/hooks/use-debounce";
import { startOfDay, endOfDay } from "date-fns";

type Supplier = { id: string; code: string; name: string };
type Product = { id: string; code: string; name: string; cost_price: number; stock_quantity: number };
type ImportOrder = {
  id: string;
  code: string;
  supplier_id: string | null;
  total_amount: number;
  created_at: string;
  suppliers: { name: string } | null;
};
type CartItem = {
  product_id: string;
  product_name: string;
  product_code: string;
  quantity: number;
  unit_cost: number;
};

const formatVND = (n: number) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(n);

async function generateImportCode(): Promise<string> {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const yy = String(now.getFullYear()).slice(-2);
  const prefix = `${dd}${mm}${yy}`;

  const { data } = await supabase
    .from("import_orders")
    .select("code")
    .like("code", `${prefix}%`)
    .order("code", { ascending: false })
    .limit(1);

  if (data && data.length > 0) {
    const lastSeq = parseInt(data[0].code.slice(6), 10);
    return `${prefix}${String(lastSeq + 1).padStart(3, "0")}`;
  }
  return `${prefix}001`;
}

const ImportsPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailOrder, setDetailOrder] = useState<ImportOrder | null>(null);
  const [detailItems, setDetailItems] = useState<any[]>([]);
  const [code, setCode] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<ImportOrder | null>(null);
  const [filters, setFilters] = useState<FilterState>({
    searchQuery: "", startDate: undefined, endDate: undefined, quickFilter: "",
  });
  const debouncedSearch = useDebounce(filters.searchQuery, 300);

  const { data: importOrders = [], isLoading } = useQuery({
    queryKey: ["import_orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("import_orders")
        .select("*, suppliers(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as ImportOrder[];
    },
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("suppliers").select("id, code, name").order("name");
      if (error) throw error;
      return data as Supplier[];
    },
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("id, code, name, cost_price, stock_quantity").order("name");
      if (error) throw error;
      return data as Product[];
    },
  });

  const filteredOrders = useMemo(() => {
    let result = importOrders;
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      result = result.filter((o) =>
        o.code.toLowerCase().includes(q) ||
        (o.suppliers?.name || "").toLowerCase().includes(q)
      );
    }
    if (filters.startDate) {
      const start = startOfDay(filters.startDate).toISOString();
      result = result.filter((o) => o.created_at >= start);
    }
    if (filters.endDate) {
      const end = endOfDay(filters.endDate).toISOString();
      result = result.filter((o) => o.created_at <= end);
    }
    return result;
  }, [importOrders, debouncedSearch, filters.startDate, filters.endDate]);

  const totalAmount = cart.reduce((sum, item) => sum + item.quantity * item.unit_cost, 0);

  const addToCart = (productId: string) => {
    if (!productId) return;
    const product = products.find((p) => p.id === productId);
    if (!product) return;
    const existing = cart.find((c) => c.product_id === productId);
    if (existing) {
      setCart(cart.map((c) => c.product_id === productId ? { ...c, quantity: c.quantity + 1 } : c));
    } else {
      setCart([...cart, {
        product_id: product.id,
        product_name: product.name,
        product_code: product.code,
        quantity: 1,
        unit_cost: product.cost_price,
      }]);
    }
    setSelectedProduct("");
  };

  const updateCartItem = (productId: string, field: "quantity" | "unit_cost", value: number) => {
    setCart(cart.map((c) => c.product_id === productId ? { ...c, [field]: value } : c));
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter((c) => c.product_id !== productId));
  };

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (cart.length === 0) throw new Error("Chưa có sản phẩm nào trong phiếu nhập");

      const { data: order, error: orderError } = await supabase
        .from("import_orders")
        .insert({ code, supplier_id: supplierId || null, total_amount: totalAmount })
        .select()
        .single();
      if (orderError) throw orderError;

      const items = cart.map((c) => ({
        import_order_id: order.id,
        product_id: c.product_id,
        quantity: c.quantity,
        unit_cost: c.unit_cost,
      }));
      const { error: itemsError } = await supabase.from("import_order_items").insert(items);
      if (itemsError) throw itemsError;

      for (const item of cart) {
        const product = products.find((p) => p.id === item.product_id);
        if (product) {
          const newQty = product.stock_quantity + item.quantity;
          const { error: updateError } = await supabase
            .from("products")
            .update({ stock_quantity: newQty, cost_price: item.unit_cost })
            .eq("id", item.product_id);
          if (updateError) throw updateError;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["import_orders"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Đã tạo phiếu nhập hàng thành công");
      closeDialog();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteImportMutation = useMutation({
    mutationFn: async (orderId: string) => {
      // Step A: Fetch items
      const { data: items, error: itemsErr } = await supabase
        .from("import_order_items")
        .select("product_id, quantity")
        .eq("import_order_id", orderId);
      if (itemsErr) throw itemsErr;

      // Step B: Deduct inventory
      if (items && items.length > 0) {
        for (const item of items) {
          const { data: product } = await supabase
            .from("products")
            .select("stock_quantity")
            .eq("id", item.product_id)
            .single();
          if (product) {
            const newQty = product.stock_quantity - item.quantity;
            const { error } = await supabase
              .from("products")
              .update({ stock_quantity: newQty })
              .eq("id", item.product_id);
            if (error) throw error;
          }
        }
      }

      // Step C: Delete items first, then order
      const { error: delItemsErr } = await supabase
        .from("import_order_items")
        .delete()
        .eq("import_order_id", orderId);
      if (delItemsErr) throw delItemsErr;

      const { error: delErr } = await supabase
        .from("import_orders")
        .delete()
        .eq("id", orderId);
      if (delErr) throw delErr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["import_orders"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Đã hủy phiếu nhập và trừ tồn kho thành công");
      setDeleteTarget(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openAdd = async () => {
    setCode(await generateImportCode());
    setSupplierId("");
    setCart([]);
    setSelectedProduct("");
    setOpen(true);
  };

  const closeDialog = () => {
    setOpen(false);
  };

  const viewDetail = async (order: ImportOrder) => {
    setDetailOrder(order);
    const { data } = await supabase
      .from("import_order_items")
      .select("*, products:product_id(code, name)")
      .eq("import_order_id", order.id);
    setDetailItems(data || []);
    setDetailOpen(true);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Nhập hàng</h1>
        <Button onClick={() => navigate("/imports/create")}>
          <Plus className="mr-2 h-4 w-4" /> Tạo phiếu nhập
        </Button>
      </div>

      <div className="bg-card rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Mã phiếu</TableHead>
              <TableHead>Nhà cung cấp</TableHead>
              <TableHead className="text-right">Tổng tiền</TableHead>
              <TableHead>Ngày tạo</TableHead>
              <TableHead className="w-[100px]">Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Đang tải...</TableCell></TableRow>
            ) : importOrders.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Chưa có phiếu nhập nào</TableCell></TableRow>
            ) : (
              importOrders.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="font-mono">{o.code}</TableCell>
                  <TableCell>{o.suppliers?.name || "—"}</TableCell>
                  <TableCell className="text-right">{formatVND(o.total_amount)}</TableCell>
                  <TableCell className="text-muted-foreground">{new Date(o.created_at).toLocaleDateString("vi-VN")}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => viewDetail(o)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => setDeleteTarget(o)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hủy phiếu nhập {deleteTarget?.code}?</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc chắn muốn hủy phiếu này? Thao tác này sẽ hoàn tác số lượng tồn kho và không thể khôi phục.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteImportMutation.isPending}>Không</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteImportMutation.isPending}
              onClick={() => deleteTarget && deleteImportMutation.mutate(deleteTarget.id)}
            >
              {deleteImportMutation.isPending ? "Đang xử lý..." : "Xác nhận hủy"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create Import Order Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Tạo phiếu nhập hàng</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Mã phiếu nhập</Label>
                <Input value={code} disabled className="font-mono bg-muted" />
              </div>
              <div>
                <Label>Nhà cung cấp</Label>
                <Select value={supplierId} onValueChange={setSupplierId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn NCC" />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.code} - {s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Thêm sản phẩm</Label>
              <Select value={selectedProduct} onValueChange={addToCart}>
                <SelectTrigger>
                  <SelectValue placeholder="Chọn sản phẩm để thêm" />
                </SelectTrigger>
                <SelectContent>
                  {products.filter((p) => !cart.some((c) => c.product_id === p.id)).map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.code} - {p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {cart.length > 0 && (
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Mã SP</TableHead>
                      <TableHead>Tên</TableHead>
                      <TableHead className="w-[100px]">SL</TableHead>
                      <TableHead className="w-[130px]">Đơn giá</TableHead>
                      <TableHead className="text-right">Thành tiền</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cart.map((item) => (
                      <TableRow key={item.product_id}>
                        <TableCell className="font-mono">{item.product_code}</TableCell>
                        <TableCell>{item.product_name}</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={1}
                            value={item.quantity}
                            onChange={(e) => updateCartItem(item.product_id, "quantity", parseInt(e.target.value) || 1)}
                            className="h-8"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={0}
                            value={item.unit_cost}
                            onChange={(e) => updateCartItem(item.product_id, "unit_cost", parseFloat(e.target.value) || 0)}
                            className="h-8"
                          />
                        </TableCell>
                        <TableCell className="text-right font-medium">{formatVND(item.quantity * item.unit_cost)}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => removeFromCart(item.product_id)} className="h-8 w-8">
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow>
                      <TableCell colSpan={4} className="text-right font-bold">Tổng cộng:</TableCell>
                      <TableCell className="text-right font-bold">{formatVND(totalAmount)}</TableCell>
                      <TableCell />
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Hủy</Button>
            <Button onClick={() => submitMutation.mutate()} disabled={cart.length === 0 || submitMutation.isPending}>
              {submitMutation.isPending ? "Đang lưu..." : "Lưu phiếu nhập"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Chi tiết phiếu nhập: {detailOrder?.code}</DialogTitle>
          </DialogHeader>
          {detailOrder && (
            <div className="space-y-3">
              <p><span className="text-muted-foreground">NCC:</span> {detailOrder.suppliers?.name || "—"}</p>
              <p><span className="text-muted-foreground">Ngày:</span> {new Date(detailOrder.created_at).toLocaleString("vi-VN")}</p>
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Mã SP</TableHead>
                      <TableHead>Tên SP</TableHead>
                      <TableHead className="text-right">SL</TableHead>
                      <TableHead className="text-right">Đơn giá</TableHead>
                      <TableHead className="text-right">Thành tiền</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detailItems.map((item: any) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-mono">{item.products?.code || "—"}</TableCell>
                        <TableCell>{item.products?.name || "—"}</TableCell>
                        <TableCell className="text-right">{item.quantity}</TableCell>
                        <TableCell className="text-right">{formatVND(item.unit_cost)}</TableCell>
                        <TableCell className="text-right font-medium">{formatVND(item.quantity * item.unit_cost)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <p className="text-right font-bold text-lg">Tổng: {formatVND(detailOrder.total_amount)}</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ImportsPage;
