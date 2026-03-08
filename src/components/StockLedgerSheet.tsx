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
        <Input value={product.stock_quantity} disabled className="bg-muted" />
      </div>
      <Button onClick={() => updateMutation.mutate()} disabled={!name.trim() || updateMutation.isPending} className="w-full">
        {updateMutation.isPending ? "Đang lưu..." : "Lưu thay đổi"}
      </Button>
    </div>
  );
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

  return (
    <div className="pt-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Thời gian</TableHead>
            <TableHead>Mã chứng từ</TableHead>
            <TableHead>Loại</TableHead>
            <TableHead>Đối tác</TableHead>
            <TableHead className="text-right">SL</TableHead>
            <TableHead className="text-right">Giá</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <TableRow key={i}>
                {Array.from({ length: 6 }).map((_, j) => (
                  <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                ))}
              </TableRow>
            ))
          ) : entries.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground">
                Chưa có giao dịch nào
              </TableCell>
            </TableRow>
          ) : (
            entries.map((e) => (
              <TableRow key={e.id}>
                <TableCell className="whitespace-nowrap">
                  {e.date ? format(new Date(e.date), "dd/MM/yyyy HH:mm") : "—"}
                </TableCell>
                <TableCell className="font-mono">{e.code}</TableCell>
                <TableCell>
                  {e.type === "import" ? (
                    <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/20">Nhập hàng</Badge>
                  ) : (
                    <Badge className="bg-blue-500/15 text-blue-600 border-blue-500/30 hover:bg-blue-500/20">Bán hàng</Badge>
                  )}
                </TableCell>
                <TableCell>{e.partnerName}</TableCell>
                <TableCell className={`text-right font-medium ${e.quantity > 0 ? "text-emerald-600" : "text-blue-600"}`}>
                  {e.quantity > 0 ? `+${e.quantity}` : e.quantity}
                </TableCell>
                <TableCell className="text-right">{formatVND(e.price)}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
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
