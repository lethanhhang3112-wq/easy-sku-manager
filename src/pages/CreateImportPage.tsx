import { useState, useMemo, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
import { toast } from "sonner";
import { Search, Plus, X, ChevronsUpDown, Check, PenLine, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { CurrencyInput, formatCurrency } from "@/components/CurrencyInput";
import { AddProductModal } from "@/components/AddProductModal";
import { ProductSearchDropdown } from "@/components/ProductSearchDropdown";

// ─── Types ───────────────────────────────────────────────────────
type Supplier = { id: string; code: string; name: string; phone: string | null; address: string | null };
type Product = { id: string; code: string; name: string; cost_price: number; stock_quantity: number };
type CartItem = {
  product_id: string;
  product_code: string;
  product_name: string;
  quantity: number;
  unit_cost: number;
  item_discount: number;
};

const fmt = (n: number) => formatCurrency(n);

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

const DUMMY_ITEMS: CartItem[] = [];

// ═════════════════════════════════════════════════════════════════
const CreateImportPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [code, setCode] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [supplierOpen, setSupplierOpen] = useState(false);
  const [globalDiscount, setGlobalDiscount] = useState(0);
  const [alreadyPaid, setAlreadyPaid] = useState(0);
  const [payingAmount, setPayingAmount] = useState(0);
  const [notes, setNotes] = useState("");
  const [importDate, setImportDate] = useState(() => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
  });
  const [cart, setCart] = useState<CartItem[]>(DUMMY_ITEMS);
  

  const [addSupplierOpen, setAddSupplierOpen] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState("");
  const [newSupplierPhone, setNewSupplierPhone] = useState("");
  const [newSupplierAddress, setNewSupplierAddress] = useState("");

  const [addProductOpen, setAddProductOpen] = useState(false);

  useEffect(() => { generateImportCode().then(setCode); }, []);

  const { data: suppliers = [], refetch: refetchSuppliers } = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("suppliers").select("*").order("name");
      if (error) throw error;
      return data as Supplier[];
    },
  });

  const { data: products = [], refetch: refetchProducts } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("id, code, name, cost_price, stock_quantity").order("name");
      if (error) throw error;
      return data as Product[];
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

  const selectedSupplier = suppliers.find((s) => s.id === supplierId);


  const totalQuantity = useMemo(() => cart.reduce((s, c) => s + c.quantity, 0), [cart]);
  const totalAmount = useMemo(() => cart.reduce((s, c) => s + (c.quantity * c.unit_cost - c.item_discount), 0), [cart]);
  const amountToPay = useMemo(() => Math.max(0, totalAmount - globalDiscount - alreadyPaid), [totalAmount, globalDiscount, alreadyPaid]);
  const debt = useMemo(() => Math.max(0, amountToPay - payingAmount), [amountToPay, payingAmount]);

  const now = new Date();
  const dateTimeStr = `${String(now.getDate()).padStart(2, "0")}/${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  const addToCart = useCallback((product: { id: string; code: string; name: string; cost_price: number }) => {
    if (cart.some((c) => c.product_id === product.id)) return;
    setCart((prev) => [...prev, {
      product_id: product.id, product_code: product.code, product_name: product.name,
      quantity: 1, unit_cost: product.cost_price, item_discount: 0,
    }]);
  }, [cart]);

  const updateField = useCallback((pid: string, field: keyof CartItem, value: number) => {
    setCart((prev) => prev.map((c) => c.product_id === pid ? { ...c, [field]: Math.max(0, value) } : c));
  }, []);

  const updateSubtotal = useCallback((pid: string, newSubtotal: number) => {
    setCart((prev) => prev.map((c) => {
      if (c.product_id !== pid) return c;
      const unitCost = c.quantity > 0 ? (newSubtotal + c.item_discount) / c.quantity : 0;
      return { ...c, unit_cost: Math.max(0, Math.round(unitCost * 100) / 100) };
    }));
  }, []);

  const removeFromCart = useCallback((pid: string) => {
    setCart((prev) => prev.filter((c) => c.product_id !== pid));
  }, []);

  const addSupplierMutation = useMutation({
    mutationFn: async () => {
      if (!newSupplierName.trim()) throw new Error("Tên NCC không được để trống");
      const { data: existing } = await supabase.from("suppliers").select("code").order("code", { ascending: false }).limit(1);
      let nextCode = "NCC0001";
      if (existing && existing.length > 0) {
        const num = parseInt(existing[0].code.replace("NCC", ""), 10);
        nextCode = `NCC${String(num + 1).padStart(4, "0")}`;
      }
      const { data, error } = await supabase.from("suppliers").insert({ code: nextCode, name: newSupplierName.trim(), phone: newSupplierPhone.trim() || null, address: newSupplierAddress.trim() || null }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      refetchSuppliers(); setSupplierId(data.id); setAddSupplierOpen(false);
      setNewSupplierName(""); setNewSupplierPhone(""); setNewSupplierAddress("");
      toast.success("Đã thêm nhà cung cấp");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleNewProduct = (product: any) => {
    refetchProducts();
    setCart((prev) => [...prev, {
      product_id: product.id, product_code: product.code, product_name: product.name,
      quantity: 1, unit_cost: product.cost_price, item_discount: 0,
    }]);
  };

  const submitMutation = useMutation({
    mutationFn: async () => {
      const realCart = cart.filter((c) => !c.product_id.startsWith("dummy-"));
      if (realCart.length === 0) throw new Error("Chưa có sản phẩm thực (bỏ sản phẩm demo)");

      const { data: order, error: orderError } = await supabase
        .from("import_orders")
        .insert({ code, supplier_id: supplierId || null, total_amount: totalAmount, discount: globalDiscount, amount_paid: payingAmount, notes: notes.trim(), created_at: new Date(importDate).toISOString() })
        .select().single();
      if (orderError) throw orderError;

      const items = realCart.map((c) => ({ import_order_id: order.id, product_id: c.product_id, quantity: c.quantity, unit_cost: c.unit_cost }));
      const { error: itemsError } = await supabase.from("import_order_items").insert(items);
      if (itemsError) throw itemsError;

      // Fetch latest stock for accurate update
      const { data: latestProducts, error: fetchErr } = await supabase
        .from("products")
        .select("id, stock_quantity")
        .in("id", realCart.map((c) => c.product_id));
      if (fetchErr) throw fetchErr;

      const stockMap = new Map((latestProducts || []).map((p) => [p.id, p.stock_quantity]));

      await Promise.all(realCart.map(async (item) => {
        const currentStock = stockMap.get(item.product_id) ?? 0;
        const { error } = await supabase.from("products").update({ stock_quantity: currentStock + item.quantity, cost_price: item.unit_cost }).eq("id", item.product_id);
        if (error) throw error;
      }));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["import_orders"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Đã tạo phiếu nhập hàng thành công!");
      navigate("/imports");
    },
    onError: (e: any) => toast.error(e.message),
  });

  

  // ═══════════════════════════════════════════════════════════════
  // KiotViet-style inline input: no border, just a subtle bottom line
  const inlineInputClass = "h-7 text-sm border-0 border-b border-border/60 rounded-none bg-transparent shadow-none focus-visible:ring-0 focus-visible:border-primary px-0";

  return (
    <div className="h-[calc(100vh-2rem)] flex flex-col -m-6">
      {/* ═══ MAIN 2-COLUMN LAYOUT ═══════════════════════════════ */}
      <div className="flex-1 flex overflow-hidden">

        {/* ════════════════════════════════════════════════════════
            LEFT COLUMN — Product search + table
            ════════════════════════════════════════════════════════ */}
        <div className="flex-[7] flex flex-col min-w-0 bg-card">

          {/* Title + Search */}
          <div className="px-5 pt-5 pb-3 space-y-3 border-b bg-card">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="h-8 w-8 -ml-1" onClick={() => navigate("/imports")}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <h1 className="text-xl font-bold text-foreground">Nhập hàng</h1>
            </div>
            <div className="flex gap-2">
              <ProductSearchDropdown
                onSelect={(p) => addToCart(p)}
                excludeIds={cart.map((c) => c.product_id)}
                displayPrice="cost_price"
                placeholder="Tìm hàng hóa theo tên, mã hàng (F3)..."
                className="flex-1"
              />
              <Button size="icon" variant="outline" className="h-9 w-9 shrink-0" onClick={() => setAddProductOpen(true)}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Data Table */}
          <div className="flex-1 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40 border-b">
                  <TableHead className="w-[36px]" />
                  <TableHead className="text-xs font-semibold text-foreground w-[120px]">Mã hàng hóa</TableHead>
                  <TableHead className="text-xs font-semibold text-foreground">Tên hàng</TableHead>
                  <TableHead className="text-xs font-semibold text-foreground text-center w-[90px]">Số lượng</TableHead>
                  <TableHead className="text-xs font-semibold text-foreground text-right w-[120px]">Đơn giá</TableHead>
                  <TableHead className="text-xs font-semibold text-foreground text-right w-[100px]">Giảm giá</TableHead>
                  <TableHead className="text-xs font-semibold text-foreground text-right w-[120px]">Thành tiền</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cart.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-20 text-muted-foreground">
                      <Search className="h-10 w-10 mx-auto mb-2 opacity-20" />
                      <p className="text-sm">Tìm và thêm sản phẩm vào phiếu nhập</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  cart.map((item) => {
                    const subtotal = item.quantity * item.unit_cost - item.item_discount;
                    return (
                      <TableRow key={item.product_id} className="border-b border-border/40">
                        <TableCell className="text-center px-2">
                          <button onClick={() => removeFromCart(item.product_id)} className="text-destructive hover:text-destructive/80">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-primary">{item.product_code}</TableCell>
                        <TableCell className="text-sm text-foreground">{item.product_name}</TableCell>
                        <TableCell className="px-2">
                          <input
                            type="number"
                            min={1}
                            value={item.quantity}
                            onChange={(e) => updateField(item.product_id, "quantity", parseInt(e.target.value) || 1)}
                            className={cn(inlineInputClass, "text-center w-full")}
                          />
                        </TableCell>
                        <TableCell className="px-2">
                          <CurrencyInput
                            value={item.unit_cost}
                            onChange={(v) => updateField(item.product_id, "unit_cost", v)}
                            className={cn(inlineInputClass, "text-right w-full")}
                          />
                        </TableCell>
                        <TableCell className="px-2">
                          <CurrencyInput
                            value={item.item_discount}
                            onChange={(v) => updateField(item.product_id, "item_discount", v)}
                            className={cn(inlineInputClass, "text-right w-full")}
                          />
                        </TableCell>
                        <TableCell className="px-2">
                          <CurrencyInput
                            value={subtotal}
                            onChange={(v) => updateSubtotal(item.product_id, v)}
                            className={cn(inlineInputClass, "text-right w-full font-medium")}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════
            RIGHT SIDEBAR — Summary & checkout
            ════════════════════════════════════════════════════════ */}
        <div className="w-[320px] shrink-0 border-l flex flex-col bg-background">
          <div className="flex-1 overflow-y-auto">

            {/* User + datetime */}
            <div className="px-4 py-2.5 border-b flex items-center justify-between text-xs text-muted-foreground">
              <span className="font-medium text-foreground">admin</span>
              <span>{dateTimeStr}</span>
            </div>

            {/* Supplier search */}
            <div className="px-4 py-3 border-b">
              <div className="flex gap-1.5">
                <Popover open={supplierOpen} onOpenChange={setSupplierOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" className="flex-1 justify-between h-8 text-xs font-normal px-2.5">
                      {selectedSupplier ? selectedSupplier.name : "Tìm nhà cung cấp (F4)"}
                      <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[260px] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Tìm NCC..." className="text-xs" />
                      <CommandList>
                        <CommandEmpty className="text-xs py-3">Không tìm thấy</CommandEmpty>
                        <CommandGroup>
                          {suppliers.map((s) => (
                            <CommandItem key={s.id} value={`${s.code} ${s.name}`} onSelect={() => { setSupplierId(s.id === supplierId ? "" : s.id); setSupplierOpen(false); }} className="text-xs">
                              <Check className={cn("mr-1.5 h-3 w-3", supplierId === s.id ? "opacity-100" : "opacity-0")} />
                              <span className="font-mono text-[10px] mr-1.5 text-muted-foreground">{s.code}</span>
                              {s.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 shrink-0 text-primary hover:text-primary hover:bg-primary/10"
                  onClick={() => setAddSupplierOpen(true)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Form rows */}
            <div className="px-4 py-3 space-y-2.5 text-xs">
              {/* Mã phiếu */}
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Mã phiếu nhập</span>
                <span className="font-mono text-foreground">{code || "Mã phiếu tự động"}</span>
              </div>

              {/* Ngày nhập */}
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Ngày nhập</span>
                <input
                  type="datetime-local"
                  value={importDate}
                  onChange={(e) => setImportDate(e.target.value)}
                  className="h-7 text-xs border-0 border-b border-border/60 rounded-none bg-transparent shadow-none focus:outline-none focus:border-primary px-0 text-foreground"
                />
              </div>

              {/* Trạng thái */}
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Trạng thái</span>
                <Badge variant="outline" className="text-[10px] h-5 font-normal border-primary/40 text-primary">Phiếu tạm</Badge>
              </div>

              <div className="border-t border-border/50 my-1" />

              {/* Tổng tiền hàng */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground">Tổng tiền hàng</span>
                  <Badge variant="secondary" className="text-[10px] h-4 px-1.5 font-normal min-w-[20px] justify-center">{totalQuantity}</Badge>
                </div>
                <span className="font-semibold text-foreground text-sm">{formatCurrency(totalAmount)}</span>
              </div>

              {/* Giảm giá */}
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Giảm giá</span>
                <CurrencyInput
                  value={globalDiscount}
                  onChange={setGlobalDiscount}
                  className={cn(inlineInputClass, "w-[100px] text-right")}
                />
              </div>

              {/* Đã trả NCC */}
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Đã trả nhà cung cấp</span>
                <CurrencyInput
                  value={alreadyPaid}
                  onChange={setAlreadyPaid}
                  className={cn(inlineInputClass, "w-[100px] text-right")}
                />
              </div>

              <div className="border-t border-border/50 my-1" />

              {/* Cần trả NCC — prominent blue */}
              <div className="flex items-center justify-between py-1">
                <span className="text-muted-foreground font-medium">Cần trả nhà cung cấp</span>
                <span className="text-base font-bold text-primary">{formatCurrency(amountToPay)}</span>
              </div>

              {/* Tiền trả NCC */}
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Tiền trả nhà cung cấp</span>
                <CurrencyInput
                  value={payingAmount}
                  onChange={setPayingAmount}
                  className={cn(inlineInputClass, "w-[100px] text-right")}
                />
              </div>

              {/* Tính vào công nợ */}
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Tính vào công nợ</span>
                <span className={cn("font-semibold text-sm", debt > 0 ? "text-destructive" : "text-foreground")}>{formatCurrency(debt)}</span>
              </div>

              <div className="border-t border-border/50 my-1" />

              {/* Ghi chú */}
              <div>
                <div className="flex items-center gap-1 text-muted-foreground mb-1">
                  <PenLine className="h-3 w-3" />
                  <span>Ghi chú</span>
                </div>
                <Textarea
                  placeholder="Ghi chú cho phiếu nhập..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="resize-none text-xs min-h-[48px] bg-muted/30"
                  rows={2}
                />
              </div>
            </div>
          </div>

          {/* Action Buttons — bottom-pinned */}
          <div className="px-4 py-3 border-t bg-card">
            <Button
              className="w-full h-10 text-sm font-bold bg-[hsl(142,72%,40%)] hover:bg-[hsl(142,72%,35%)] text-[hsl(0,0%,100%)]"
              onClick={() => submitMutation.mutate()}
              disabled={cart.length === 0 || submitMutation.isPending}
            >
              {submitMutation.isPending ? "Đang lưu..." : "Hoàn thành"}
            </Button>
          </div>
        </div>
      </div>

      {/* ── Quick Add Supplier Dialog ─────────────────────────── */}
      <Dialog open={addSupplierOpen} onOpenChange={setAddSupplierOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Thêm nhà cung cấp mới</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Tên nhà cung cấp *</Label><Input value={newSupplierName} onChange={(e) => setNewSupplierName(e.target.value)} placeholder="Nhập tên NCC" /></div>
            <div><Label>Số điện thoại</Label><Input value={newSupplierPhone} onChange={(e) => setNewSupplierPhone(e.target.value)} placeholder="Số điện thoại" /></div>
            <div><Label>Địa chỉ</Label><Input value={newSupplierAddress} onChange={(e) => setNewSupplierAddress(e.target.value)} placeholder="Địa chỉ" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddSupplierOpen(false)}>Hủy</Button>
            <Button onClick={() => addSupplierMutation.mutate()} disabled={addSupplierMutation.isPending}>
              {addSupplierMutation.isPending ? "Đang lưu..." : "Thêm NCC"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Quick Add Product Modal ─────────────────────────── */}
      <AddProductModal
        open={addProductOpen}
        onOpenChange={setAddProductOpen}
        onSuccess={handleNewProduct}
      />
    </div>
  );
};

export default CreateImportPage;
