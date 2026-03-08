import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { CurrencyInput, formatCurrency } from "@/components/CurrencyInput";
import { StockAdjustmentModal } from "@/components/StockAdjustmentModal";
import { toast } from "sonner";
import { format } from "date-fns";
import { ChevronsUpDown, Check, PackagePlus, PackageMinus } from "lucide-react";
import { cn } from "@/lib/utils";

type LedgerEntry = {
  id: string;
  date: string;
  code: string;
  type: "import" | "sale" | "adjust_in" | "adjust_out";
  partnerName: string;
  quantity: number;
  price: number;
  note?: string;
};

type Product = {
  id: string;
  code: string;
  name: string;
  category_id: string | null;
  cost_price: number;
  sale_price: number;
  stock_quantity: number;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product | null;
};

const formatVND = (n: number) => new Intl.NumberFormat("vi-VN").format(n);

async function fetchStockLedger(productId: string): Promise<LedgerEntry[]> {
  const [importsRes, salesRes, adjustRes] = await Promise.all([
    supabase
      .from("import_order_items")
      .select("id, quantity, unit_cost, import_orders(code, created_at, suppliers(name))")
      .eq("product_id", productId),
    supabase
      .from("sales_order_items")
      .select("id, quantity, unit_price, sales_orders(code, created_at, customers(name))")
      .eq("product_id", productId),
    supabase
      .from("stock_adjustments")
      .select("*")
      .eq("product_id", productId),
  ]);

  if (importsRes.error) throw importsRes.error;
  if (salesRes.error) throw salesRes.error;
  if (adjustRes.error) throw adjustRes.error;

  const importEntries: LedgerEntry[] = (importsRes.data ?? []).map((item: any) => ({
    id: item.id,
    date: item.import_orders?.created_at ?? "",
    code: item.import_orders?.code ?? "",
    type: "import",
    partnerName: item.import_orders?.suppliers?.name ?? "N/A",
    quantity: item.quantity,
    price: item.unit_cost,
  }));

  const saleEntries: LedgerEntry[] = (salesRes.data ?? []).map((item: any) => ({
    id: item.id,
    date: item.sales_orders?.created_at ?? "",
    code: item.sales_orders?.code ?? "",
    type: "sale",
    partnerName: item.sales_orders?.customers?.name ?? "Khách lẻ",
    quantity: -item.quantity,
    price: item.unit_price,
  }));

  const adjustEntries: LedgerEntry[] = (adjustRes.data ?? []).map((item: any) => ({
    id: item.id,
    date: item.created_at,
    code: item.type === "in" ? "ADJ-IN" : "ADJ-OUT",
    type: item.type === "in" ? "adjust_in" : "adjust_out",
    partnerName: "",
    quantity: item.type === "in" ? item.quantity : -item.quantity,
    price: item.unit_price,
    note: item.note,
  }));

  return [...importEntries, ...saleEntries, ...adjustEntries].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
}

// --- Product Info Tab ---
function ProductInfoTab({ product, onSaved }: { product: Product; onSaved: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(product.name);
  const [code, setCode] = useState(product.code);
  const [categoryId, setCategoryId] = useState(product.category_id || "");
  const [costPrice, setCostPrice] = useState(product.cost_price);
  const [salePrice, setSalePrice] = useState(product.sale_price);
  const [stockQuantity, setStockQuantity] = useState(product.stock_quantity);
  const [categoryOpen, setCategoryOpen] = useState(false);

  useEffect(() => {
    setName(product.name);
    setCode(product.code);
    setCategoryId(product.category_id || "");
    setCostPrice(product.cost_price);
    setSalePrice(product.sale_price);
    setStockQuantity(product.stock_quantity);
  }, [product]);

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("id, name").order("name");
      if (error) throw error;
      return data as { id: string; name: string }[];
    },
  });

  const selectedCategory = categories.find((c) => c.id === categoryId);

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Tên sản phẩm không được để trống");
      const { error } = await supabase
        .from("products")
        .update({
          name: name.trim(),
          code: code.trim(),
          category_id: categoryId || null,
          cost_price: costPrice,
          sale_price: salePrice,
          stock_quantity: stockQuantity,
        })
        .eq("id", product.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Đã lưu thay đổi");
      onSaved();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const inputClass =
    "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

  return (
    <div className="space-y-4 pt-4">
      <div>
        <Label>Mã hàng hóa</Label>
        <Input value={code} onChange={(e) => setCode(e.target.value)} className="font-mono" />
      </div>
      <div>
        <Label>Tên sản phẩm *</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div>
        <Label>Nhóm hàng</Label>
        <Popover open={categoryOpen} onOpenChange={setCategoryOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" role="combobox" className="w-full justify-between h-10 text-sm font-normal">
              {selectedCategory ? selectedCategory.name : "Chọn nhóm hàng"}
              <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[320px] p-0" align="start">
            <Command>
              <CommandInput placeholder="Tìm nhóm hàng..." className="text-sm" />
              <CommandList>
                <CommandEmpty className="text-sm py-3">Không tìm thấy</CommandEmpty>
                <CommandGroup>
                  {categories.map((c) => (
                    <CommandItem
                      key={c.id}
                      value={c.name}
                      onSelect={() => {
                        setCategoryId(c.id === categoryId ? "" : c.id);
                        setCategoryOpen(false);
                      }}
                      className="text-sm"
                    >
                      <Check className={cn("mr-2 h-3.5 w-3.5", categoryId === c.id ? "opacity-100" : "opacity-0")} />
                      {c.name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Giá vốn</Label>
          <CurrencyInput value={costPrice} onChange={setCostPrice} className={inputClass} />
        </div>
        <div>
          <Label>Giá bán</Label>
          <CurrencyInput value={salePrice} onChange={setSalePrice} className={inputClass} />
        </div>
      </div>
      <div>
        <Label>Tồn kho</Label>
        <Input
          type="number"
          min={0}
          value={stockQuantity}
          onChange={(e) => setStockQuantity(Math.max(0, parseInt(e.target.value) || 0))}
        />
      </div>
      <Button onClick={() => updateMutation.mutate()} disabled={!name.trim() || updateMutation.isPending} className="w-full">
        {updateMutation.isPending ? "Đang lưu..." : "Lưu thay đổi"}
      </Button>
    </div>
  );
}

// --- Computed Row type ---
type ComputedRow = LedgerEntry & {
  description: string;
  inQty: number;
  inPrice: number;
  inAmount: number;
  outQty: number;
  outPrice: number;
  outAmount: number;
  balanceQty: number;
  balanceAvgPrice: number;
  balanceTotal: number;
  overstock: boolean;
};

function computeWeightedAverage(entries: LedgerEntry[]): ComputedRow[] {
  const sorted = [...entries].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  let balanceQty = 0;
  let balanceTotal = 0;

  return sorted.map((e) => {
    const isInbound = e.type === "import" || e.type === "adjust_in";
    const qty = Math.abs(e.quantity);
    let inQty = 0, inPrice = 0, inAmount = 0;
    let outQty = 0, outPrice = 0, outAmount = 0;
    let overstock = false;

    if (isInbound) {
      inQty = qty;
      inPrice = e.price;
      inAmount = qty * e.price;
      balanceQty += qty;
      balanceTotal += inAmount;
    } else {
      outQty = qty;
      if (outQty > balanceQty) overstock = true;
      const avgPriceBefore = balanceQty > 0 ? balanceTotal / balanceQty : 0;
      outPrice = Math.round(avgPriceBefore * 100) / 100;
      outAmount = Math.round(outQty * outPrice);
      balanceQty -= outQty;
      balanceTotal -= outAmount;
      if (balanceQty <= 0) { balanceQty = 0; balanceTotal = 0; }
    }

    const balanceAvgPrice = balanceQty > 0 ? Math.round((balanceTotal / balanceQty) * 100) / 100 : 0;

    let description = "";
    switch (e.type) {
      case "import": description = `Nhập từ ${e.partnerName}`; break;
      case "sale": description = `Bán cho ${e.partnerName}`; break;
      case "adjust_in": description = e.note ? `Nhập điều chỉnh: ${e.note}` : "Nhập điều chỉnh"; break;
      case "adjust_out": description = e.note ? `Xuất điều chỉnh: ${e.note}` : "Xuất điều chỉnh"; break;
    }

    return {
      ...e,
      description,
      inQty, inPrice, inAmount,
      outQty, outPrice, outAmount,
      balanceQty,
      balanceAvgPrice,
      balanceTotal: Math.round(balanceTotal),
      overstock,
    };
  });
}

// --- Stock Ledger Tab ---
function StockLedgerTab({ product }: { product: Product }) {
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [adjType, setAdjType] = useState<"in" | "out">("in");
  const [adjOpen, setAdjOpen] = useState(false);

  const loadData = () => {
    setLoading(true);
    fetchStockLedger(product.id)
      .then(setEntries)
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, [product.id]);

  const rows = useMemo(() => computeWeightedAverage(entries), [entries]);

  const typeLabel = (type: string) => {
    switch (type) {
      case "import": return <Badge variant="outline" className="text-emerald-600 border-emerald-300">Nhập hàng</Badge>;
      case "sale": return <Badge variant="outline" className="text-blue-600 border-blue-300">Xuất bán</Badge>;
      case "adjust_in": return <Badge variant="outline" className="text-emerald-600 border-emerald-300">Nhập ĐC</Badge>;
      case "adjust_out": return <Badge variant="outline" className="text-destructive border-destructive/30">Xuất ĐC</Badge>;
      default: return type;
    }
  };

  return (
    <div className="pt-4 space-y-4">
      {/* Action buttons */}
      <div className="flex gap-2">
        <Button
          onClick={() => { setAdjType("in"); setAdjOpen(true); }}
          className="bg-emerald-600 hover:bg-emerald-700"
        >
          <PackagePlus className="mr-2 h-4 w-4" /> Nhập kho
        </Button>
        <Button
          variant="destructive"
          onClick={() => { setAdjType("out"); setAdjOpen(true); }}
        >
          <PackageMinus className="mr-2 h-4 w-4" /> Xuất kho
        </Button>
      </div>

      {/* Table */}
      <div className="relative w-full overflow-auto max-h-[55vh] border rounded-md">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-muted/95 backdrop-blur-sm">
            <TableRow>
              <TableHead rowSpan={2} className="border-r align-middle min-w-[90px]">Ngày tháng</TableHead>
              <TableHead rowSpan={2} className="border-r align-middle min-w-[90px]">Mã chứng từ</TableHead>
              <TableHead rowSpan={2} className="border-r align-middle min-w-[70px]">Loại</TableHead>
              <TableHead rowSpan={2} className="border-r align-middle min-w-[120px]">Diễn giải</TableHead>
              <TableHead colSpan={3} className="text-center border-r border-b text-emerald-600">Nhập</TableHead>
              <TableHead colSpan={3} className="text-center border-r border-b text-blue-600">Xuất</TableHead>
              <TableHead colSpan={3} className="text-center border-b text-foreground">Tồn kho</TableHead>
            </TableRow>
            <TableRow>
              <TableHead className="text-right text-xs min-w-[50px]">SL</TableHead>
              <TableHead className="text-right text-xs min-w-[70px]">Đơn giá</TableHead>
              <TableHead className="text-right text-xs border-r min-w-[80px]">Thành tiền</TableHead>
              <TableHead className="text-right text-xs min-w-[50px]">SL</TableHead>
              <TableHead className="text-right text-xs min-w-[70px]">Đơn giá</TableHead>
              <TableHead className="text-right text-xs border-r min-w-[80px]">Thành tiền</TableHead>
              <TableHead className="text-right text-xs min-w-[50px]">SL</TableHead>
              <TableHead className="text-right text-xs min-w-[70px]">ĐG BQ</TableHead>
              <TableHead className="text-right text-xs min-w-[90px]">Tổng GT</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 13 }).map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={13} className="text-center text-muted-foreground py-8">
                  Chưa có giao dịch nào
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.id} className={r.overstock ? "bg-destructive/10" : ""}>
                  <TableCell className="whitespace-nowrap text-xs border-r">
                    {r.date ? format(new Date(r.date), "dd/MM/yyyy") : "—"}
                  </TableCell>
                  <TableCell className="font-mono text-xs border-r">{r.code}</TableCell>
                  <TableCell className="text-xs border-r">{typeLabel(r.type)}</TableCell>
                  <TableCell className="text-xs border-r truncate max-w-[140px]" title={r.description}>{r.description}</TableCell>
                  <TableCell className="text-right text-xs text-emerald-600 font-medium">
                    {r.inQty > 0 ? r.inQty : ""}
                  </TableCell>
                  <TableCell className="text-right text-xs">
                    {r.inQty > 0 ? formatVND(r.inPrice) : ""}
                  </TableCell>
                  <TableCell className="text-right text-xs border-r font-medium">
                    {r.inQty > 0 ? formatVND(r.inAmount) : ""}
                  </TableCell>
                  <TableCell className="text-right text-xs text-blue-600 font-medium">
                    {r.outQty > 0 ? r.outQty : ""}
                  </TableCell>
                  <TableCell className="text-right text-xs">
                    {r.outQty > 0 ? formatVND(r.outPrice) : ""}
                  </TableCell>
                  <TableCell className="text-right text-xs border-r font-medium">
                    {r.outQty > 0 ? formatVND(r.outAmount) : ""}
                  </TableCell>
                  <TableCell className={`text-right text-xs font-bold ${r.overstock ? "text-destructive" : ""}`}>
                    {r.balanceQty}
                  </TableCell>
                  <TableCell className="text-right text-xs">
                    {formatVND(r.balanceAvgPrice)}
                  </TableCell>
                  <TableCell className="text-right text-xs font-medium">
                    {formatVND(r.balanceTotal)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <StockAdjustmentModal
        open={adjOpen}
        onOpenChange={(v) => { setAdjOpen(v); if (!v) loadData(); }}
        productId={product.id}
        productName={product.name}
        type={adjType}
        currentStock={product.stock_quantity}
      />
    </div>
  );
}

// --- Main Sheet ---
export function StockLedgerSheet({ open, onOpenChange, product }: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-2xl w-full overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Chi tiết hàng hóa & Thẻ kho</SheetTitle>
          {product && (
            <SheetDescription>
              {product.code} — {product.name} · Tồn kho: {product.stock_quantity}
            </SheetDescription>
          )}
        </SheetHeader>

        {product && (
          <Tabs defaultValue="info" className="mt-4">
            <TabsList className="w-full">
              <TabsTrigger value="info" className="flex-1">Thông tin</TabsTrigger>
              <TabsTrigger value="ledger" className="flex-1">Thẻ kho</TabsTrigger>
            </TabsList>
            <TabsContent value="info">
              <ProductInfoTab product={product} onSaved={() => {}} />
            </TabsContent>
            <TabsContent value="ledger">
              <StockLedgerTab product={product} />
            </TabsContent>
          </Tabs>
        )}
      </SheetContent>
    </Sheet>
  );
}
