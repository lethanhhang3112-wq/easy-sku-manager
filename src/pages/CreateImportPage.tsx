import { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
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
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { toast } from "sonner";
import { Search, Trash2, Plus, ChevronLeft, ChevronsUpDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";

type Supplier = { id: string; code: string; name: string; phone: string | null; address: string | null };
type Product = { id: string; code: string; name: string; cost_price: number; stock_quantity: number };
type CartItem = {
  product_id: string;
  product_code: string;
  product_name: string;
  quantity: number;
  unit_cost: number;
};

const formatVND = (n: number) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(n);

const formatNumber = (n: number) =>
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

const CreateImportPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Form state
  const [code, setCode] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [supplierOpen, setSupplierOpen] = useState(false);
  const [discount, setDiscount] = useState(0);
  const [amountPaid, setAmountPaid] = useState(0);
  const [notes, setNotes] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);

  // Product search
  const [searchTerm, setSearchTerm] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);

  // Quick-add supplier modal
  const [addSupplierOpen, setAddSupplierOpen] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState("");
  const [newSupplierPhone, setNewSupplierPhone] = useState("");
  const [newSupplierAddress, setNewSupplierAddress] = useState("");

  // Generate code on mount
  useState(() => {
    generateImportCode().then(setCode);
  });

  // Queries
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

  // Filtered products for search dropdown
  const filteredProducts = useMemo(() => {
    if (!searchTerm.trim()) return [];
    const term = searchTerm.toLowerCase();
    return products
      .filter(
        (p) =>
          !cart.some((c) => c.product_id === p.id) &&
          (p.name.toLowerCase().includes(term) || p.code.toLowerCase().includes(term))
      )
      .slice(0, 10);
  }, [searchTerm, products, cart]);

  // Calculations
  const totalAmount = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantity * item.unit_cost, 0),
    [cart]
  );
  const amountToPay = useMemo(() => Math.max(0, totalAmount - discount), [totalAmount, discount]);

  // Cart actions
  const addToCart = useCallback(
    (product: Product) => {
      if (cart.some((c) => c.product_id === product.id)) return;
      setCart((prev) => [
        ...prev,
        {
          product_id: product.id,
          product_code: product.code,
          product_name: product.name,
          quantity: 1,
          unit_cost: product.cost_price,
        },
      ]);
      setSearchTerm("");
      setSearchFocused(false);
    },
    [cart]
  );

  const updateCartField = useCallback(
    (productId: string, field: "quantity" | "unit_cost", value: number) => {
      setCart((prev) =>
        prev.map((c) =>
          c.product_id === productId ? { ...c, [field]: Math.max(field === "quantity" ? 1 : 0, value) } : c
        )
      );
    },
    []
  );

  const removeFromCart = useCallback((productId: string) => {
    setCart((prev) => prev.filter((c) => c.product_id !== productId));
  }, []);

  // Quick add supplier
  const addSupplierMutation = useMutation({
    mutationFn: async () => {
      if (!newSupplierName.trim()) throw new Error("Tên NCC không được để trống");
      // Generate supplier code
      const { data: existing } = await supabase
        .from("suppliers")
        .select("code")
        .order("code", { ascending: false })
        .limit(1);
      let nextCode = "NCC0001";
      if (existing && existing.length > 0) {
        const num = parseInt(existing[0].code.replace("NCC", ""), 10);
        nextCode = `NCC${String(num + 1).padStart(4, "0")}`;
      }
      const { data, error } = await supabase
        .from("suppliers")
        .insert({
          code: nextCode,
          name: newSupplierName.trim(),
          phone: newSupplierPhone.trim() || null,
          address: newSupplierAddress.trim() || null,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      refetchSuppliers();
      setSupplierId(data.id);
      setAddSupplierOpen(false);
      setNewSupplierName("");
      setNewSupplierPhone("");
      setNewSupplierAddress("");
      toast.success("Đã thêm nhà cung cấp");
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Submit order
  const submitMutation = useMutation({
    mutationFn: async () => {
      if (cart.length === 0) throw new Error("Chưa có sản phẩm nào trong phiếu nhập");

      // 1. Create import order
      const { data: order, error: orderError } = await supabase
        .from("import_orders")
        .insert({
          code,
          supplier_id: supplierId || null,
          total_amount: totalAmount,
          discount,
          amount_paid: amountPaid,
          notes: notes.trim(),
        })
        .select()
        .single();
      if (orderError) throw orderError;

      // 2. Create import order items
      const items = cart.map((c) => ({
        import_order_id: order.id,
        product_id: c.product_id,
        quantity: c.quantity,
        unit_cost: c.unit_cost,
      }));
      const { error: itemsError } = await supabase.from("import_order_items").insert(items);
      if (itemsError) throw itemsError;

      // 3. Update stock quantities
      for (const item of cart) {
        const product = products.find((p) => p.id === item.product_id);
        if (product) {
          const { error: updateError } = await supabase
            .from("products")
            .update({
              stock_quantity: product.stock_quantity + item.quantity,
              cost_price: item.unit_cost,
            })
            .eq("id", item.product_id);
          if (updateError) throw updateError;
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

  const today = new Date().toLocaleDateString("vi-VN", {
    weekday: "long",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return (
    <div className="h-full flex flex-col -m-6">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b bg-card">
        <Button variant="ghost" size="icon" onClick={() => navigate("/imports")}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-lg font-bold">Nhập hàng</h1>
          <p className="text-xs text-muted-foreground">{today}</p>
        </div>
        <div className="ml-auto font-mono text-sm text-muted-foreground">
          Mã phiếu: <span className="font-bold text-foreground">{code}</span>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT: Product Selection Area */}
        <div className="flex-1 flex flex-col border-r min-w-0">
          {/* Search Bar */}
          <div className="p-4 border-b bg-card">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                placeholder="Tìm sản phẩm theo tên hoặc mã hàng (F3)..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
                className="pl-11 h-12 text-base"
              />
            </div>

            {/* Search Results Dropdown */}
            {searchFocused && filteredProducts.length > 0 && (
              <div className="absolute z-50 mt-1 w-[calc(70%-3rem)] bg-popover border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {filteredProducts.map((p) => (
                  <button
                    key={p.id}
                    className="w-full px-4 py-3 text-left hover:bg-accent flex items-center gap-3 border-b last:border-b-0 transition-colors"
                    onMouseDown={() => addToCart(p)}
                  >
                    <span className="font-mono text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">{p.code}</span>
                    <span className="flex-1 font-medium">{p.name}</span>
                    <span className="text-sm text-muted-foreground">Tồn: {p.stock_quantity}</span>
                    <span className="text-sm font-semibold">{formatVND(p.cost_price)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Products Table */}
          <div className="flex-1 overflow-auto">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <Search className="h-12 w-12 mb-3 opacity-30" />
                <p className="text-lg">Tìm và thêm sản phẩm vào phiếu nhập</p>
                <p className="text-sm">Sử dụng thanh tìm kiếm ở trên</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-[50px] text-center">STT</TableHead>
                    <TableHead className="w-[120px]">Mã hàng</TableHead>
                    <TableHead>Tên hàng</TableHead>
                    <TableHead className="w-[110px] text-center">Số lượng</TableHead>
                    <TableHead className="w-[150px] text-right">Đơn giá</TableHead>
                    <TableHead className="w-[140px] text-right">Thành tiền</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cart.map((item, index) => (
                    <TableRow key={item.product_id} className="group">
                      <TableCell className="text-center text-muted-foreground">{index + 1}</TableCell>
                      <TableCell className="font-mono text-sm">{item.product_code}</TableCell>
                      <TableCell className="font-medium">{item.product_name}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={(e) =>
                            updateCartField(item.product_id, "quantity", parseInt(e.target.value) || 1)
                          }
                          className="h-9 text-center"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={0}
                          value={item.unit_cost}
                          onChange={(e) =>
                            updateCartField(item.product_id, "unit_cost", parseFloat(e.target.value) || 0)
                          }
                          className="h-9 text-right"
                        />
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatVND(item.quantity * item.unit_cost)}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => removeFromCart(item.product_id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          {/* Bottom Summary Bar */}
          {cart.length > 0 && (
            <div className="px-4 py-3 border-t bg-muted/30 flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Tổng: <span className="font-bold text-foreground">{cart.length}</span> sản phẩm ·{" "}
                <span className="font-bold text-foreground">
                  {cart.reduce((s, c) => s + c.quantity, 0)}
                </span>{" "}
                đơn vị
              </span>
              <span className="text-lg font-bold">{formatVND(totalAmount)}</span>
            </div>
          )}
        </div>

        {/* RIGHT: Sidebar */}
        <div className="w-[340px] flex flex-col bg-card shrink-0">
          <div className="flex-1 overflow-y-auto p-4 space-y-5">
            {/* Supplier */}
            <div>
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 block">
                Nhà cung cấp
              </Label>
              <div className="flex gap-2">
                <Popover open={supplierOpen} onOpenChange={setSupplierOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={supplierOpen}
                      className="flex-1 justify-between h-10 font-normal"
                    >
                      {selectedSupplier
                        ? `${selectedSupplier.code} - ${selectedSupplier.name}`
                        : "Chọn nhà cung cấp..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[280px] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Tìm NCC..." />
                      <CommandList>
                        <CommandEmpty>Không tìm thấy</CommandEmpty>
                        <CommandGroup>
                          {suppliers.map((s) => (
                            <CommandItem
                              key={s.id}
                              value={`${s.code} ${s.name}`}
                              onSelect={() => {
                                setSupplierId(s.id === supplierId ? "" : s.id);
                                setSupplierOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  supplierId === s.id ? "opacity-100" : "opacity-0"
                                )}
                              />
                              <span className="font-mono text-xs mr-2">{s.code}</span>
                              {s.name}
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
                  className="shrink-0"
                  onClick={() => setAddSupplierOpen(true)}
                  title="Thêm NCC mới"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Order Info */}
            <div>
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 block">
                Thông tin phiếu
              </Label>
              <div className="space-y-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Mã phiếu nhập</Label>
                  <Input value={code} disabled className="font-mono bg-muted h-9" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Ngày nhập</Label>
                  <Input
                    value={new Date().toLocaleDateString("vi-VN")}
                    disabled
                    className="bg-muted h-9"
                  />
                </div>
              </div>
            </div>

            {/* Financial Summary */}
            <div>
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 block">
                Thanh toán
              </Label>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Tổng tiền hàng</span>
                  <span className="font-semibold">{formatVND(totalAmount)}</span>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm">Giảm giá</span>
                  <Input
                    type="number"
                    min={0}
                    value={discount}
                    onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                    className="w-[140px] h-9 text-right"
                  />
                </div>

                <div className="flex items-center justify-between pt-2 border-t">
                  <span className="text-sm font-semibold">Cần trả NCC</span>
                  <span className="text-lg font-bold text-primary">{formatVND(amountToPay)}</span>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm">Tiền trả NCC</span>
                  <Input
                    type="number"
                    min={0}
                    value={amountPaid}
                    onChange={(e) => setAmountPaid(parseFloat(e.target.value) || 0)}
                    className="w-[140px] h-9 text-right"
                  />
                </div>

                {amountPaid < amountToPay && amountPaid > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Còn nợ</span>
                    <span className="text-destructive font-semibold">
                      {formatVND(amountToPay - amountPaid)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Notes */}
            <div>
              <Label className="text-xs text-muted-foreground">Ghi chú</Label>
              <Textarea
                placeholder="Ghi chú cho phiếu nhập..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="resize-none"
                rows={3}
              />
            </div>
          </div>

          {/* Submit Button */}
          <div className="p-4 border-t">
            <Button
              className="w-full h-12 text-base font-bold"
              onClick={() => submitMutation.mutate()}
              disabled={cart.length === 0 || submitMutation.isPending}
            >
              {submitMutation.isPending ? "Đang xử lý..." : "Hoàn thành"}
            </Button>
          </div>
        </div>
      </div>

      {/* Quick Add Supplier Dialog */}
      <Dialog open={addSupplierOpen} onOpenChange={setAddSupplierOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Thêm nhà cung cấp mới</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Tên nhà cung cấp *</Label>
              <Input
                value={newSupplierName}
                onChange={(e) => setNewSupplierName(e.target.value)}
                placeholder="Nhập tên NCC"
              />
            </div>
            <div>
              <Label>Số điện thoại</Label>
              <Input
                value={newSupplierPhone}
                onChange={(e) => setNewSupplierPhone(e.target.value)}
                placeholder="Số điện thoại"
              />
            </div>
            <div>
              <Label>Địa chỉ</Label>
              <Input
                value={newSupplierAddress}
                onChange={(e) => setNewSupplierAddress(e.target.value)}
                placeholder="Địa chỉ"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddSupplierOpen(false)}>
              Hủy
            </Button>
            <Button
              onClick={() => addSupplierMutation.mutate()}
              disabled={addSupplierMutation.isPending}
            >
              {addSupplierMutation.isPending ? "Đang lưu..." : "Thêm NCC"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CreateImportPage;
