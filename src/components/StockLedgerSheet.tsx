import { useState, useEffect } from "react";
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
import { CurrencyInput, formatCurrency, parseCurrency } from "@/components/CurrencyInput";
import { toast } from "sonner";
import { format } from "date-fns";
import { ChevronsUpDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";

type LedgerEntry = {
  id: string;
  date: string;
  code: string;
  type: "import" | "sale";
  partnerName: string;
  quantity: number;
  price: number;
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
  const [importsRes, salesRes] = await Promise.all([
    supabase
      .from("import_order_items")
      .select("id, quantity, unit_cost, import_orders(code, created_at, suppliers(name))")
      .eq("product_id", productId),
    supabase
      .from("sales_order_items")
      .select("id, quantity, unit_price, sales_orders(code, created_at, customers(name))")
      .eq("product_id", productId),
  ]);

  if (importsRes.error) throw importsRes.error;
  if (salesRes.error) throw salesRes.error;

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

  return [...importEntries, ...saleEntries].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
}

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
  // Sort oldest first for running balance
  const sorted = [...entries].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  let balanceQty = 0;
  let balanceTotal = 0;

  return sorted.map((e) => {
    const isImport = e.type === "import";
    const qty = Math.abs(e.quantity);
    let inQty = 0, inPrice = 0, inAmount = 0;
    let outQty = 0, outPrice = 0, outAmount = 0;
    let overstock = false;

    if (isImport) {
      inQty = qty;
      inPrice = e.price;
      inAmount = qty * e.price;
      balanceQty += qty;
      balanceTotal += inAmount;
    } else {
      outQty = qty;
      if (outQty > balanceQty) {
        overstock = true;
      }
      const avgPriceBefore = balanceQty > 0 ? balanceTotal / balanceQty : 0;
      outPrice = Math.round(avgPriceBefore * 100) / 100;
      outAmount = Math.round(outQty * outPrice);
      balanceQty -= outQty;
      balanceTotal -= outAmount;
      if (balanceQty <= 0) {
        balanceQty = 0;
        balanceTotal = 0;
      }
    }

    const balanceAvgPrice = balanceQty > 0 ? Math.round((balanceTotal / balanceQty) * 100) / 100 : 0;

    return {
      ...e,
      description: isImport ? `Nhập từ ${e.partnerName}` : `Bán cho ${e.partnerName}`,
      inQty, inPrice, inAmount,
      outQty, outPrice, outAmount,
      balanceQty,
      balanceAvgPrice,
      balanceTotal: Math.round(balanceTotal),
      overstock,
    };
  });
}

function StockLedgerTab({ productId }: { productId: string }) {
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchStockLedger(productId)
      .then(setEntries)
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, [productId]);

  const rows = useMemo(() => computeWeightedAverage(entries), [entries]);

  return (
    <div className="pt-4">
      <div className="relative w-full overflow-auto max-h-[60vh] border rounded-md">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-muted/95 backdrop-blur-sm">
            <TableRow>
              <TableHead rowSpan={2} className="border-r align-middle min-w-[90px]">Ngày tháng</TableHead>
              <TableHead rowSpan={2} className="border-r align-middle min-w-[90px]">Mã chứng từ</TableHead>
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
                  {Array.from({ length: 12 }).map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={12} className="text-center text-muted-foreground py-8">
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
                  <TableCell className="text-xs border-r truncate max-w-[140px]" title={r.description}>{r.description}</TableCell>
                  {/* Nhập */}
                  <TableCell className="text-right text-xs text-emerald-600 font-medium">
                    {r.inQty > 0 ? r.inQty : ""}
                  </TableCell>
                  <TableCell className="text-right text-xs">
                    {r.inQty > 0 ? formatVND(r.inPrice) : ""}
                  </TableCell>
                  <TableCell className="text-right text-xs border-r font-medium">
                    {r.inQty > 0 ? formatVND(r.inAmount) : ""}
                  </TableCell>
                  {/* Xuất */}
                  <TableCell className="text-right text-xs text-blue-600 font-medium">
                    {r.outQty > 0 ? r.outQty : ""}
                  </TableCell>
                  <TableCell className="text-right text-xs">
                    {r.outQty > 0 ? formatVND(r.outPrice) : ""}
                  </TableCell>
                  <TableCell className="text-right text-xs border-r font-medium">
                    {r.outQty > 0 ? formatVND(r.outAmount) : ""}
                  </TableCell>
                  {/* Tồn kho */}
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
    </div>
  );
}

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
              <StockLedgerTab productId={product.id} />
            </TabsContent>
          </Tabs>
        )}
      </SheetContent>
    </Sheet>
  );
}
