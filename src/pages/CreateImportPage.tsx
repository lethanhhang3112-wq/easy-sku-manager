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
import { Search, Plus, X, ChevronsUpDown, Check, Pen, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

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

// ─── Helpers ─────────────────────────────────────────────────────
const fmt = (n: number) =>
  new Intl.NumberFormat("vi-VN").format(n);

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

// ─── Dummy seed (shown on first load, like the KiotViet screenshot) ──
const DUMMY_ITEMS: CartItem[] = [
  { product_id: "dummy-1", product_code: "SP000028", product_name: "Áo sơ mi nam sọc trắng", quantity: 1, unit_cost: 250000, item_discount: 0 },
  { product_id: "dummy-2", product_code: "SP000029", product_name: "Áo sơ mi nam màu đỏ caro", quantity: 1, unit_cost: 250000, item_discount: 0 },
];

// ═════════════════════════════════════════════════════════════════
const CreateImportPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // ── State ────────────────────────────────────────────────────
  const [code, setCode] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [supplierOpen, setSupplierOpen] = useState(false);
  const [globalDiscount, setGlobalDiscount] = useState(0);
  const [alreadyPaid, setAlreadyPaid] = useState(0);
  const [payingAmount, setPayingAmount] = useState(0);
  const [notes, setNotes] = useState("");
  const [cart, setCart] = useState<CartItem[]>(DUMMY_ITEMS);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);

  // Quick-add supplier modal
  const [addSupplierOpen, setAddSupplierOpen] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState("");
  const [newSupplierPhone, setNewSupplierPhone] = useState("");
  const [newSupplierAddress, setNewSupplierAddress] = useState("");

  useEffect(() => {
    generateImportCode().then(setCode);
  }, []);

  // ── Queries ──────────────────────────────────────────────────
  const { data: suppliers = [], refetch: refetchSuppliers } = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("suppliers").select("*").order("name");
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

  const selectedSupplier = suppliers.find((s) => s.id === supplierId);

  // ── Search ───────────────────────────────────────────────────
  const filteredProducts = useMemo(() => {
    if (!searchTerm.trim()) return [];
    const term = searchTerm.toLowerCase();
    return products
      .filter((p) => !cart.some((c) => c.product_id === p.id) && (p.name.toLowerCase().includes(term) || p.code.toLowerCase().includes(term)))
      .slice(0, 10);
  }, [searchTerm, products, cart]);

  // ── Calculations ─────────────────────────────────────────────
  const totalQuantity = useMemo(() => cart.reduce((s, c) => s + c.quantity, 0), [cart]);
  const totalAmount = useMemo(
    () => cart.reduce((s, c) => s + (c.quantity * c.unit_cost - c.item_discount), 0),
    [cart]
  );
  const amountToPay = useMemo(() => Math.max(0, totalAmount - globalDiscount - alreadyPaid), [totalAmount, globalDiscount, alreadyPaid]);
  const debt = useMemo(() => Math.max(0, amountToPay - payingAmount), [amountToPay, payingAmount]);

  const now = new Date();
  const dateTimeStr = `${String(now.getDate()).padStart(2, "0")}/${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  // ── Cart Actions ─────────────────────────────────────────────
  const addToCart = useCallback((product: Product) => {
    if (cart.some((c) => c.product_id === product.id)) return;
    setCart((prev) => [...prev, {
      product_id: product.id, product_code: product.code, product_name: product.name,
      quantity: 1, unit_cost: product.cost_price, item_discount: 0,
    }]);
    setSearchTerm("");
    setSearchFocused(false);
  }, [cart]);

  const updateField = useCallback((pid: string, field: keyof CartItem, value: number) => {
    setCart((prev) => prev.map((c) => c.product_id === pid ? { ...c, [field]: Math.max(0, value) } : c));
  }, []);

  const removeFromCart = useCallback((pid: string) => {
    setCart((prev) => prev.filter((c) => c.product_id !== pid));
  }, []);

  // ── Add Supplier ─────────────────────────────────────────────
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
      refetchSuppliers();
      setSupplierId(data.id);
      setAddSupplierOpen(false);
      setNewSupplierName(""); setNewSupplierPhone(""); setNewSupplierAddress("");
      toast.success("Đã thêm nhà cung cấp");
    },
    onError: (e: any) => toast.error(e.message),
  });

  // ── Submit ───────────────────────────────────────────────────
  const submitMutation = useMutation({
    mutationFn: async () => {
      const realCart = cart.filter((c) => !c.product_id.startsWith("dummy-"));
      if (realCart.length === 0) throw new Error("Chưa có sản phẩm thực (bỏ sản phẩm demo)");

      const { data: order, error: orderError } = await supabase
        .from("import_orders")
        .insert({ code, supplier_id: supplierId || null, total_amount: totalAmount, discount: globalDiscount, amount_paid: payingAmount, notes: notes.trim() })
        .select().single();
      if (orderError) throw orderError;

      const items = realCart.map((c) => ({ import_order_id: order.id, product_id: c.product_id, quantity: c.quantity, unit_cost: c.unit_cost }));
      const { error: itemsError } = await supabase.from("import_order_items").insert(items);
      if (itemsError) throw itemsError;

      for (const item of realCart) {
        const product = products.find((p) => p.id === item.product_id);
        if (product) {
          const { error } = await supabase.from("products").update({ stock_quantity: product.stock_quantity + item.quantity, cost_price: item.unit_cost }).eq("id", item.product_id);
          if (error) throw error;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["import_orders"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Đã tạo phiếu nhập hàng thành công!");
      navigate("/imports");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const saveDraft = () => {
    toast.info("Đã lưu tạm phiếu nhập");
  };

  // ═══════════════════════════════════════════════════════════════
  return (
    <div className="h-[calc(100vh-2rem)] flex flex-col -m-6 bg-background">
      {/* ── Top Header Bar ───────────────────────────────────── */}
      <div className="h-12 bg-primary flex items-center px-4 gap-3 shrink-0">
        <button onClick={() => navigate("/imports")} className="text-primary-foreground hover:opacity-80 transition-opacity">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-primary-foreground font-bold text-base">Nhập hàng</h1>
      </div>

      {/* ── Main 2-Column Layout ─────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">
        {/* ════ LEFT COLUMN ═══════════════════════════════════ */}
        <div className="flex-1 flex flex-col min-w-0 bg-background">
          {/* Search Bar */}
          <div className="px-4 pt-4 pb-3">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Tìm hàng hóa theo tên, mã hàng (F3)..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
                  className="pl-10 h-10 bg-card border-input"
                />
                {/* Search Dropdown */}
                {searchFocused && filteredProducts.length > 0 && (
                  <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-lg max-h-64 overflow-y-auto">
                    {filteredProducts.map((p) => (
                      <button
                        key={p.id}
                        className="w-full px-3 py-2.5 text-left hover:bg-accent flex items-center gap-3 border-b border-border/50 last:border-b-0 text-sm transition-colors"
                        onMouseDown={() => addToCart(p)}
                      >
                        <span className="font-mono text-xs text-muted-foreground">{p.code}</span>
                        <span className="flex-1">{p.name}</span>
                        <span className="text-xs text-muted-foreground">Tồn: {p.stock_quantity}</span>
                        <span className="font-medium">{fmt(p.cost_price)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <Button size="icon" variant="outline" className="h-10 w-10 shrink-0">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Products Table */}
          <div className="flex-1 overflow-auto px-4 pb-4">
            <div className="border rounded-md bg-card overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/60 hover:bg-muted/60">
                    <TableHead className="w-[40px] text-center"></TableHead>
                    <TableHead className="w-[130px] text-xs font-semibold text-foreground">Mã hàng hóa</TableHead>
                    <TableHead className="text-xs font-semibold text-foreground">Tên hàng</TableHead>
                    <TableHead className="w-[100px] text-xs font-semibold text-foreground text-center">Số lượng</TableHead>
                    <TableHead className="w-[140px] text-xs font-semibold text-foreground text-right">Đơn giá</TableHead>
                    <TableHead className="w-[120px] text-xs font-semibold text-foreground text-right">Giảm giá</TableHead>
                    <TableHead className="w-[140px] text-xs font-semibold text-foreground text-right">Thành tiền</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cart.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-16 text-muted-foreground">
                        <Search className="h-10 w-10 mx-auto mb-2 opacity-20" />
                        <p>Tìm và thêm sản phẩm vào phiếu nhập</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    cart.map((item) => {
                      const subtotal = item.quantity * item.unit_cost - item.item_discount;
                      return (
                        <TableRow key={item.product_id} className="group">
                          <TableCell className="text-center">
                            <button
                              onClick={() => removeFromCart(item.product_id)}
                              className="text-destructive/60 hover:text-destructive transition-colors"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </TableCell>
                          <TableCell className="font-mono text-xs text-primary">{item.product_code}</TableCell>
                          <TableCell className="text-sm">{item.product_name}</TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min={1}
                              value={item.quantity}
                              onChange={(e) => updateField(item.product_id, "quantity", parseInt(e.target.value) || 1)}
                              className="h-8 text-center border-0 border-b border-input rounded-none bg-transparent focus-visible:ring-0 focus-visible:border-primary px-1"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min={0}
                              value={item.unit_cost}
                              onChange={(e) => updateField(item.product_id, "unit_cost", parseFloat(e.target.value) || 0)}
                              className="h-8 text-right border-0 border-b border-input rounded-none bg-transparent focus-visible:ring-0 focus-visible:border-primary px-1"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min={0}
                              value={item.item_discount}
                              onChange={(e) => updateField(item.product_id, "item_discount", parseFloat(e.target.value) || 0)}
                              className="h-8 text-right border-0 border-b border-input rounded-none bg-transparent focus-visible:ring-0 focus-visible:border-primary px-1"
                            />
                          </TableCell>
                          <TableCell className="text-right font-semibold text-sm">{fmt(subtotal)}</TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>

        {/* ════ RIGHT SIDEBAR ═════════════════════════════════ */}
        <div className="w-[340px] shrink-0 border-l bg-card flex flex-col">
          <div className="flex-1 overflow-y-auto">
            {/* User & Date */}
            <div className="px-4 pt-4 pb-3 border-b text-xs text-muted-foreground flex items-center justify-between">
              <span>admin</span>
              <span>{dateTimeStr}</span>
            </div>

            {/* Supplier Search */}
            <div className="px-4 py-3 border-b">
              <div className="flex gap-2">
                <Popover open={supplierOpen} onOpenChange={setSupplierOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" className="flex-1 justify-between h-9 text-sm font-normal">
                      {selectedSupplier ? selectedSupplier.name : "Tìm nhà cung cấp (F4)"}
                      <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[270px] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Tìm NCC..." />
                      <CommandList>
                        <CommandEmpty>Không tìm thấy</CommandEmpty>
                        <CommandGroup>
                          {suppliers.map((s) => (
                            <CommandItem key={s.id} value={`${s.code} ${s.name}`} onSelect={() => { setSupplierId(s.id === supplierId ? "" : s.id); setSupplierOpen(false); }}>
                              <Check className={cn("mr-2 h-3.5 w-3.5", supplierId === s.id ? "opacity-100" : "opacity-0")} />
                              <span className="font-mono text-xs mr-2 text-muted-foreground">{s.code}</span>
                              {s.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                <Button size="icon" variant="outline" className="h-9 w-9 shrink-0 text-primary border-primary/30 hover:bg-primary/10" onClick={() => setAddSupplierOpen(true)}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Form Fields */}
            <div className="px-4 py-3 space-y-3 text-sm">
              {/* Mã phiếu */}
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Mã phiếu nhập</span>
                <Input value={code} disabled className="w-[160px] h-8 text-right font-mono text-xs bg-muted border-0" />
              </div>

              {/* Trạng thái */}
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Trạng thái</span>
                <Badge variant="secondary" className="text-xs font-normal">Phiếu tạm</Badge>
              </div>

              <div className="border-t my-2" />

              {/* Tổng tiền hàng */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Tổng tiền hàng</span>
                  <Badge variant="outline" className="text-[10px] h-5 px-1.5 font-normal">{totalQuantity}</Badge>
                </div>
                <span className="font-semibold">{fmt(totalAmount)}</span>
              </div>

              {/* Giảm giá */}
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Giảm giá</span>
                <Input
                  type="number"
                  min={0}
                  value={globalDiscount}
                  onChange={(e) => setGlobalDiscount(parseFloat(e.target.value) || 0)}
                  className="w-[120px] h-8 text-right border-0 border-b border-input rounded-none bg-transparent focus-visible:ring-0 focus-visible:border-primary"
                />
              </div>

              {/* Đã trả NCC */}
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Đã trả nhà cung cấp</span>
                <Input
                  type="number"
                  min={0}
                  value={alreadyPaid}
                  onChange={(e) => setAlreadyPaid(parseFloat(e.target.value) || 0)}
                  className="w-[120px] h-8 text-right border-0 border-b border-input rounded-none bg-transparent focus-visible:ring-0 focus-visible:border-primary"
                />
              </div>

              <div className="border-t my-2" />

              {/* Cần trả NCC */}
              <div className="flex items-center justify-between">
                <span className="font-medium">Cần trả nhà cung cấp</span>
                <span className="text-lg font-bold text-primary">{fmt(amountToPay)}</span>
              </div>

              {/* Tiền trả NCC */}
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Tiền trả nhà cung cấp</span>
                <Input
                  type="number"
                  min={0}
                  value={payingAmount}
                  onChange={(e) => setPayingAmount(parseFloat(e.target.value) || 0)}
                  className="w-[120px] h-8 text-right border-0 border-b border-input rounded-none bg-transparent focus-visible:ring-0 focus-visible:border-primary"
                />
              </div>

              {/* Tính vào công nợ */}
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Tính vào công nợ</span>
                <span className={cn("font-semibold", debt > 0 ? "text-destructive" : "text-foreground")}>{fmt(debt)}</span>
              </div>

              <div className="border-t my-2" />

              {/* Notes */}
              <div>
                <div className="flex items-center gap-1.5 text-muted-foreground mb-1.5">
                  <Pen className="h-3.5 w-3.5" />
                  <span className="text-xs">Ghi chú</span>
                </div>
                <Textarea
                  placeholder="Ghi chú cho phiếu nhập..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="resize-none text-sm min-h-[60px]"
                  rows={2}
                />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="p-4 border-t flex gap-2">
            <Button variant="outline" className="flex-1 h-10" onClick={() => navigate("/imports")}>
              Trở về
            </Button>
            <Button variant="secondary" className="flex-1 h-10 bg-primary/10 text-primary hover:bg-primary/20" onClick={saveDraft}>
              Lưu tạm
            </Button>
            <Button
              className="flex-1 h-10 bg-[hsl(142,72%,40%)] hover:bg-[hsl(142,72%,35%)] text-[hsl(var(--success-foreground,0_0%_100%))]"
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
    </div>
  );
};

export default CreateImportPage;
