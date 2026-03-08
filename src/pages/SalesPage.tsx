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
import { Plus, Trash2, Eye, ShoppingCart, Search } from "lucide-react";

type Customer = { id: string; code: string; name: string };
type Product = { id: string; code: string; name: string; sale_price: number; stock_quantity: number };
type SalesOrder = {
  id: string; code: string; customer_id: string | null; total_amount: number; created_at: string;
};
type CartItem = {
  product_id: string; product_name: string; product_code: string;
  quantity: number; unit_price: number; stock: number;
};

const formatVND = (n: number) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(n);

async function generateSalesCode(): Promise<string> {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const yy = String(now.getFullYear()).slice(-2);
  const prefix = `BH${dd}${mm}${yy}`;

  const { data } = await supabase
    .from("sales_orders")
    .select("code")
    .like("code", `${prefix}%`)
    .order("code", { ascending: false })
    .limit(1);

  if (data && data.length > 0) {
    const lastSeq = parseInt(data[0].code.slice(8), 10);
    return `${prefix}${String(lastSeq + 1).padStart(3, "0")}`;
  }
  return `${prefix}001`;
}

const SalesPage = () => {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailOrder, setDetailOrder] = useState<SalesOrder | null>(null);
  const [detailItems, setDetailItems] = useState<any[]>([]);
  const [code, setCode] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  const { data: salesOrders = [], isLoading } = useQuery({
    queryKey: ["sales_orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales_orders").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as SalesOrder[];
    },
  });

  const { data: customers = [] } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("customers").select("id, code, name").order("name");
      if (error) throw error;
      return data as Customer[];
    },
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("id, code, name, sale_price, stock_quantity").order("name");
      if (error) throw error;
      return data as Product[];
    },
  });

  const customerMap = Object.fromEntries(customers.map((c) => [c.id, c]));
  const totalAmount = cart.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);

  const filteredProducts = products.filter(
    (p) =>
      !cart.some((c) => c.product_id === p.id) &&
      (p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.code.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const addToCart = (productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return;
    if (product.stock_quantity <= 0) {
      toast.warning(`${product.name} đã hết hàng`);
      return;
    }
    setCart([...cart, {
      product_id: product.id,
      product_name: product.name,
      product_code: product.code,
      quantity: 1,
      unit_price: product.sale_price,
      stock: product.stock_quantity,
    }]);
    setSearchTerm("");
  };

  const updateCartQty = (productId: string, qty: number) => {
    setCart(cart.map((c) => c.product_id === productId ? { ...c, quantity: Math.min(Math.max(1, qty), c.stock) } : c));
  };

  const updateCartPrice = (productId: string, price: number) => {
    setCart(cart.map((c) => c.product_id === productId ? { ...c, unit_price: price } : c));
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter((c) => c.product_id !== productId));
  };

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (cart.length === 0) throw new Error("Chưa có sản phẩm nào");

      // Validate stock
      for (const item of cart) {
        if (item.quantity > item.stock) {
          throw new Error(`${item.product_name} chỉ còn ${item.stock} trong kho`);
        }
      }

      // 1. Create sales order
      const { data: order, error: orderError } = await supabase
        .from("sales_orders")
        .insert({ code, customer_id: customerId || null, total_amount: totalAmount })
        .select()
        .single();
      if (orderError) throw orderError;

      // 2. Create sales order items
      const items = cart.map((c) => ({
        sales_order_id: order.id,
        product_id: c.product_id,
        quantity: c.quantity,
        unit_price: c.unit_price,
      }));
      const { error: itemsError } = await supabase.from("sales_order_items").insert(items);
      if (itemsError) throw itemsError;

      // 3. Deduct stock
      for (const item of cart) {
        const product = products.find((p) => p.id === item.product_id);
        if (product) {
          const { error: updateError } = await supabase
            .from("products")
            .update({ stock_quantity: product.stock_quantity - item.quantity })
            .eq("id", item.product_id);
          if (updateError) throw updateError;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales_orders"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Đã tạo đơn bán hàng thành công");
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openAdd = async () => {
    setCode(await generateSalesCode());
    setCustomerId("");
    setCart([]);
    setSearchTerm("");
    setOpen(true);
  };

  const viewDetail = async (order: SalesOrder) => {
    setDetailOrder(order);
    const { data } = await supabase
      .from("sales_order_items")
      .select("*, products:product_id(code, name)")
      .eq("sales_order_id", order.id);
    setDetailItems(data || []);
    setDetailOpen(true);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Bán hàng</h1>
        <Button onClick={openAdd}>
          <ShoppingCart className="mr-2 h-4 w-4" /> Tạo đơn bán hàng
        </Button>
      </div>

      <div className="bg-card rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Mã đơn</TableHead>
              <TableHead>Khách hàng</TableHead>
              <TableHead className="text-right">Tổng tiền</TableHead>
              <TableHead>Ngày tạo</TableHead>
              <TableHead className="w-[80px]">Xem</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Đang tải...</TableCell></TableRow>
            ) : salesOrders.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Chưa có đơn bán hàng nào</TableCell></TableRow>
            ) : (
              salesOrders.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="font-mono">{o.code}</TableCell>
                  <TableCell>{o.customer_id ? customerMap[o.customer_id]?.name || "—" : "Khách lẻ"}</TableCell>
                  <TableCell className="text-right">{formatVND(o.total_amount)}</TableCell>
                  <TableCell className="text-muted-foreground">{new Date(o.created_at).toLocaleDateString("vi-VN")}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => viewDetail(o)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create Sales Order Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Tạo đơn bán hàng</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Mã đơn hàng</Label>
                <Input value={code} disabled className="font-mono bg-muted" />
              </div>
              <div>
                <Label>Khách hàng</Label>
                <Select value={customerId} onValueChange={setCustomerId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Khách lẻ" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.code} - {c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Product search */}
            <div>
              <Label>Thêm sản phẩm</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Tìm theo tên hoặc mã sản phẩm..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              {searchTerm && filteredProducts.length > 0 && (
                <div className="border rounded-md mt-1 max-h-40 overflow-y-auto bg-popover">
                  {filteredProducts.slice(0, 8).map((p) => (
                    <button
                      key={p.id}
                      className="w-full px-3 py-2 text-left hover:bg-accent flex justify-between items-center text-sm"
                      onClick={() => addToCart(p.id)}
                    >
                      <span className="font-mono text-muted-foreground mr-2">{p.code}</span>
                      <span className="flex-1">{p.name}</span>
                      <span className="text-muted-foreground ml-2">Tồn: {p.stock_quantity}</span>
                      <span className="ml-2 font-medium">{formatVND(p.sale_price)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Cart */}
            {cart.length > 0 && (
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Mã SP</TableHead>
                      <TableHead>Tên</TableHead>
                      <TableHead className="w-[90px]">Tồn</TableHead>
                      <TableHead className="w-[90px]">SL</TableHead>
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
                        <TableCell className="text-muted-foreground">{item.stock}</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={1}
                            max={item.stock}
                            value={item.quantity}
                            onChange={(e) => updateCartQty(item.product_id, parseInt(e.target.value) || 1)}
                            className="h-8"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={0}
                            value={item.unit_price}
                            onChange={(e) => updateCartPrice(item.product_id, parseFloat(e.target.value) || 0)}
                            className="h-8"
                          />
                        </TableCell>
                        <TableCell className="text-right font-medium">{formatVND(item.quantity * item.unit_price)}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => removeFromCart(item.product_id)} className="h-8 w-8">
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow>
                      <TableCell colSpan={5} className="text-right font-bold text-lg">Tổng cộng:</TableCell>
                      <TableCell className="text-right font-bold text-lg">{formatVND(totalAmount)}</TableCell>
                      <TableCell />
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Hủy</Button>
            <Button onClick={() => submitMutation.mutate()} disabled={cart.length === 0 || submitMutation.isPending}>
              {submitMutation.isPending ? "Đang xử lý..." : "Thanh toán"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Chi tiết đơn: {detailOrder?.code}</DialogTitle>
          </DialogHeader>
          {detailOrder && (
            <div className="space-y-3">
              <p><span className="text-muted-foreground">Khách hàng:</span> {detailOrder.customer_id ? customerMap[detailOrder.customer_id]?.name || "—" : "Khách lẻ"}</p>
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
                        <TableCell className="text-right">{formatVND(item.unit_price)}</TableCell>
                        <TableCell className="text-right font-medium">{formatVND(item.quantity * item.unit_price)}</TableCell>
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

export default SalesPage;
