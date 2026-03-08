import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { Search, Trash2, Plus, Minus, ChevronsUpDown, Check, ShoppingCart } from "lucide-react";
import { cn } from "@/lib/utils";
import { CurrencyInput, formatCurrency } from "@/components/CurrencyInput";
import { ProductSearchDropdown, type ProductSearchDropdownRef } from "@/components/ProductSearchDropdown";

// ─── Types ───────────────────────────────────────────────────────
type Customer = { id: string; code: string; name: string; phone: string | null };
type Product = { id: string; code: string; name: string; sale_price: number; stock_quantity: number };
type CartItem = {
  product_id: string;
  product_code: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  max_stock: number;
};

const fmt = (n: number) => formatCurrency(n);

const inputClass =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

// ─── Code generator ──────────────────────────────────────────────
async function generateSalesCode(): Promise<string> {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const yy = String(now.getFullYear()).slice(-2);
  const prefix = `HD${dd}${mm}${yy}`;

  const { data } = await supabase
    .from("sales_orders")
    .select("code")
    .like("code", `${prefix}%`)
    .order("code", { ascending: false })
    .limit(1);

  if (data && data.length > 0) {
    const lastSeq = parseInt(data[0].code.slice(prefix.length), 10);
    return `${prefix}${String(lastSeq + 1).padStart(3, "0")}`;
  }
  return `${prefix}001`;
}

// ─── Add Customer Modal ──────────────────────────────────────────
const AddCustomerModal = ({
  open, onOpenChange, onSuccess,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSuccess: (c: Customer) => void;
}) => {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  const reset = () => { setName(""); setPhone(""); };

  const generateCode = async () => {
    const { data } = await supabase
      .from("customers")
      .select("code")
      .like("code", "KH%")
      .order("code", { ascending: false })
      .limit(1);
    if (data && data.length > 0) {
      const num = parseInt(data[0].code.slice(2), 10);
      return `KH${String(num + 1).padStart(4, "0")}`;
    }
    return "KH0001";
  };

  const mutation = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Tên khách hàng không được để trống");
      const code = await generateCode();
      const { data, error } = await supabase
        .from("customers")
        .insert({ code, name: name.trim(), phone: phone.trim() || null })
        .select()
        .single();
      if (error) throw error;
      return data as Customer;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      toast.success("Đã thêm khách hàng");
      onSuccess(data);
      onOpenChange(false);
      reset();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Thêm khách hàng mới</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Tên khách hàng *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nhập tên" />
          </div>
          <div>
            <Label>Số điện thoại</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Nhập SĐT" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { onOpenChange(false); reset(); }}>Hủy</Button>
          <Button onClick={() => mutation.mutate()} disabled={!name.trim() || mutation.isPending}>
            {mutation.isPending ? "Đang lưu..." : "Lưu"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ─── Main POS Page ───────────────────────────────────────────────
const SalesPage = () => {
  const queryClient = useQueryClient();
  const searchRef = useRef<ProductSearchDropdownRef>(null);

  // State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [customerOpen, setCustomerOpen] = useState(false);
  const [addCustomerOpen, setAddCustomerOpen] = useState(false);
  const [discount, setDiscount] = useState(0);
  const [amountPaid, setAmountPaid] = useState(0);
  const [amountPaidManual, setAmountPaidManual] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'transfer'>('cash');
  const [invoiceCode, setInvoiceCode] = useState("Đang tạo...");

  // Generate code on mount
  useEffect(() => {
    generateSalesCode().then(setInvoiceCode);
  }, []);

  // ─── Data fetching ─────────────────────────────────────────────
  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, code, name, sale_price, stock_quantity")
        .order("name");
      if (error) throw error;
      return data as Product[];
    },
  });

  const { data: customers = [] } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("id, code, name, phone")
        .order("name");
      if (error) throw error;
      return data as Customer[];
    },
  });

  // ─── Computed ──────────────────────────────────────────────────
  const totalAmount = useMemo(
    () => cart.reduce((sum, i) => sum + i.quantity * i.unit_price, 0),
    [cart]
  );
  const totalToPay = Math.max(0, totalAmount - discount);
  const change = Math.max(0, amountPaid - totalToPay);

  // Auto-sync amountPaid to totalToPay unless user manually edited
  const effectivePaid = amountPaidManual ? amountPaid : totalToPay;
  const effectiveChange = Math.max(0, effectivePaid - totalToPay);


  const selectedCustomer = customers.find((c) => c.id === customerId);

  // ─── Cart actions ──────────────────────────────────────────────
  const addToCart = useCallback(
    (productId: string) => {
      const product = products.find((p) => p.id === productId);
      if (!product) return;
      if (product.stock_quantity <= 0) {
        toast.error("Sản phẩm này đã hết hàng!", { description: product.name });
        return;
      }

      setCart((prev) => {
        const existing = prev.find((c) => c.product_id === productId);
        if (existing) {
          return prev.map((c) =>
            c.product_id === productId
              ? { ...c, quantity: Math.min(c.quantity + 1, c.max_stock) }
              : c
          );
        }
        return [
          ...prev,
          {
            product_id: product.id,
            product_code: product.code,
            product_name: product.name,
            quantity: 1,
            unit_price: product.sale_price,
            max_stock: product.stock_quantity,
          },
        ];
      });
      
    },
    [products]
  );

  const updateQty = useCallback((productId: string, qty: number) => {
    setCart((prev) =>
      prev.map((c) => {
        if (c.product_id !== productId) return c;
        const clamped = Math.min(Math.max(1, qty), c.max_stock);
        if (qty > c.max_stock) {
          toast.warning("Số lượng vượt quá tồn kho hiện tại!", {
            description: `${c.product_name}: tồn kho ${c.max_stock}`,
          });
        }
        return { ...c, quantity: clamped };
      })
    );
  }, []);

  const updatePrice = useCallback((productId: string, price: number) => {
    setCart((prev) =>
      prev.map((c) => (c.product_id === productId ? { ...c, unit_price: price } : c))
    );
  }, []);

  const removeItem = useCallback((productId: string) => {
    setCart((prev) => prev.filter((c) => c.product_id !== productId));
  }, []);

  // ─── Checkout ──────────────────────────────────────────────────
  const checkoutMutation = useMutation({
    mutationFn: async () => {
      if (cart.length === 0) throw new Error("Chưa có sản phẩm nào trong giỏ hàng");

      // Fetch latest stock for all cart items to prevent race conditions
      const { data: latestProducts, error: fetchErr } = await supabase
        .from("products")
        .select("id, stock_quantity")
        .in("id", cart.map((c) => c.product_id));
      if (fetchErr) throw fetchErr;

      const stockMap = new Map((latestProducts || []).map((p) => [p.id, p.stock_quantity]));

      // Validate stock against latest data
      for (const item of cart) {
        const currentStock = stockMap.get(item.product_id) ?? 0;
        if (item.quantity > currentStock) {
          throw new Error(`${item.product_name} chỉ còn ${currentStock} trong kho`);
        }
      }

      const code = await generateSalesCode();

      // Step A: Create sales order
      const { data: order, error: orderError } = await supabase
        .from("sales_orders")
        .insert({
          code,
          customer_id: customerId || null,
          total_amount: totalToPay,
          payment_method: paymentMethod,
        })
        .select()
        .single();
      if (orderError) throw orderError;

      // Step B: Create sales order items
      const items = cart.map((c) => ({
        sales_order_id: order.id,
        product_id: c.product_id,
        quantity: c.quantity,
        unit_price: c.unit_price,
      }));
      const { error: itemsError } = await supabase.from("sales_order_items").insert(items);
      if (itemsError) throw itemsError;

      // Step C: Deduct stock using latest fetched values
      await Promise.all(cart.map(async (item) => {
        const currentStock = stockMap.get(item.product_id) ?? 0;
        const { error } = await supabase
          .from("products")
          .update({ stock_quantity: currentStock - item.quantity })
          .eq("id", item.product_id);
        if (error) throw error;
      }));

      return code;
    },
    onSuccess: async (code) => {
      queryClient.invalidateQueries({ queryKey: ["sales_orders"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success(`Thanh toán thành công! Mã: ${code}. Đã sẵn sàng cho đơn hàng mới.`);
      // Reset all states
      setCart([]);
      setCustomerId("");
      setDiscount(0);
      setAmountPaid(0);
      setAmountPaidManual(false);
      setPaymentMethod('cash');
      setInvoiceCode(await generateSalesCode());
      // Focus search input for next order
      setTimeout(() => searchRef.current?.focus(), 100);
    },
    onError: (e: any) => toast.error(e.message),
  });

  // ─── Render ────────────────────────────────────────────────────
  return (
    <div className="flex gap-4 h-[calc(100vh-6rem)]">
      {/* ═══ LEFT COLUMN ═══ */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Search */}
        <div className="mb-3">
          <ProductSearchDropdown
            ref={searchRef}
            onSelect={(p) => addToCart(p.id)}
            excludeIds={[]}
            displayPrice="sale_price"
            onlyInStock
            autoFocus
            placeholder="Tìm sản phẩm theo tên hoặc mã hàng (F3)..."
          />
        </div>

        {/* Cart Table */}
        <div className="flex-1 border rounded-lg bg-card overflow-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-10"></TableHead>
                <TableHead className="w-24">Mã hàng</TableHead>
                <TableHead>Tên hàng</TableHead>
                <TableHead className="w-32 text-center">Số lượng</TableHead>
                <TableHead className="w-36 text-right">Đơn giá</TableHead>
                <TableHead className="w-36 text-right">Thành tiền</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cart.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-16">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <ShoppingCart className="h-10 w-10 opacity-30" />
                      <p>Tìm và chọn sản phẩm để thêm vào giỏ hàng</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                cart.map((item, idx) => (
                  <TableRow key={item.product_id}>
                    <TableCell className="text-center">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => removeItem(item.product_id)}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </TableCell>
                    <TableCell className="font-mono text-muted-foreground">{item.product_code}</TableCell>
                    <TableCell className="font-medium">{item.product_name}</TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => updateQty(item.product_id, item.quantity - 1)}
                          disabled={item.quantity <= 1}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <Input
                          type="number"
                          min={1}
                          max={item.max_stock}
                          value={item.quantity}
                          onChange={(e) => updateQty(item.product_id, parseInt(e.target.value) || 1)}
                          className="h-7 w-14 text-center px-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => updateQty(item.product_id, item.quantity + 1)}
                          disabled={item.quantity >= item.max_stock}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <CurrencyInput
                        value={item.unit_price}
                        onChange={(v) => updatePrice(item.product_id, v)}
                        className={cn(inputClass, "h-7 text-right w-full")}
                      />
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {fmt(item.quantity * item.unit_price)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* ═══ RIGHT COLUMN ═══ */}
      <div className="w-[340px] shrink-0 flex flex-col gap-3">
        {/* Invoice code */}
        <div className="bg-card border rounded-lg p-4">
          <Label className="text-muted-foreground text-xs">Mã hóa đơn</Label>
          <p className="font-mono font-semibold text-lg">{invoiceCode}</p>
        </div>

        {/* Customer selection */}
        <div className="bg-card border rounded-lg p-4">
          <Label className="text-muted-foreground text-xs mb-1.5 block">Khách hàng</Label>
          <div className="flex gap-1.5">
            <Popover open={customerOpen} onOpenChange={setCustomerOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className="flex-1 justify-between h-9 text-sm font-normal"
                >
                  {selectedCustomer
                    ? `${selectedCustomer.code} - ${selectedCustomer.name}`
                    : "Khách lẻ"}
                  <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[300px] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Tìm khách hàng..." className="text-sm" />
                  <CommandList>
                    <CommandEmpty className="text-sm py-3">Không tìm thấy</CommandEmpty>
                    <CommandGroup>
                      {customers.map((c) => (
                        <CommandItem
                          key={c.id}
                          value={`${c.code} ${c.name} ${c.phone || ""}`}
                          onSelect={() => {
                            setCustomerId(c.id === customerId ? "" : c.id);
                            setCustomerOpen(false);
                          }}
                          className="text-sm"
                        >
                          <Check
                            className={cn(
                              "mr-2 h-3.5 w-3.5",
                              customerId === c.id ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <span className="font-mono text-muted-foreground mr-2">{c.code}</span>
                          {c.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 shrink-0"
              onClick={() => setAddCustomerOpen(true)}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Order Summary */}
        <div className="bg-card border rounded-lg p-4 flex-1 flex flex-col gap-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Tổng tiền hàng</span>
            <span className="font-semibold">{fmt(totalAmount)}</span>
          </div>

          <div className="flex justify-between items-center gap-3">
            <span className="text-sm text-muted-foreground">Giảm giá</span>
            <CurrencyInput
              value={discount}
              onChange={setDiscount}
              className={cn(inputClass, "h-8 w-32 text-right")}
            />
          </div>

          <div className="border-t pt-3 flex justify-between items-center">
            <span className="font-semibold">Khách cần trả</span>
            <span className="text-xl font-bold text-primary">{fmt(totalToPay)}</span>
          </div>

          <div className="flex justify-between items-center gap-3">
            <span className="text-sm text-muted-foreground">Khách thanh toán</span>
            <CurrencyInput
              value={effectivePaid}
              onChange={(v) => {
                setAmountPaid(v);
                setAmountPaidManual(true);
              }}
              className={cn(inputClass, "h-8 w-32 text-right")}
            />
          </div>

          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Tiền thừa trả khách</span>
            <span className="font-semibold text-success">{fmt(effectiveChange)}</span>
          </div>

          <div className="border-t pt-3">
            <Label className="text-sm text-muted-foreground mb-2 block">Phương thức thanh toán</Label>
            <RadioGroup value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as 'cash' | 'transfer')}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="cash" id="cash" />
                <Label htmlFor="cash" className="font-normal cursor-pointer text-sm">Tiền mặt</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="transfer" id="transfer" />
                <Label htmlFor="transfer" className="font-normal cursor-pointer text-sm">Chuyển khoản</Label>
              </div>
            </RadioGroup>
          </div>

          <div className="flex-1" />

          {/* Checkout button */}
          <Button
            className="w-full h-14 text-lg font-bold bg-success hover:bg-success/90 text-success-foreground"
            onClick={() => checkoutMutation.mutate()}
            disabled={cart.length === 0 || checkoutMutation.isPending}
          >
            {checkoutMutation.isPending ? "Đang xử lý..." : "THANH TOÁN"}
          </Button>
        </div>
      </div>

      {/* Add Customer Modal */}
      <AddCustomerModal
        open={addCustomerOpen}
        onOpenChange={setAddCustomerOpen}
        onSuccess={(c) => setCustomerId(c.id)}
      />
    </div>
  );
};

export default SalesPage;
