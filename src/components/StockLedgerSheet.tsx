import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { CurrencyInput } from "@/components/CurrencyInput";
import { StockLedgerTab } from "@/components/StockLedgerTab";
import { toast } from "sonner";
import { ChevronsUpDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";

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
