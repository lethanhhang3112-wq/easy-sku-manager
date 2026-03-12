import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { ChevronsUpDown, Check, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { CurrencyInput } from "@/components/CurrencyInput";

type NewProduct = {
  id: string;
  code: string;
  name: string;
  category_id: string | null;
  cost_price: number;
  sale_price: number;
  stock_quantity: number;
};

interface AddProductModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (product: NewProduct) => void;
}

export const AddProductModal = ({ open, onOpenChange, onSuccess }: AddProductModalProps) => {
  const queryClient = useQueryClient();

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [costPrice, setCostPrice] = useState(0);
  const [salePrice, setSalePrice] = useState(0);

  const [categoryOpen, setCategoryOpen] = useState(false);
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("id, name").order("name");
      if (error) throw error;
      return data as { id: string; name: string }[];
    },
  });

  const selectedCategory = categories.find((c) => c.id === categoryId);

  const addCategoryMutation = useMutation({
    mutationFn: async () => {
      if (!newCategoryName.trim()) throw new Error("Tên nhóm hàng không được để trống");
      const { data, error } = await supabase
        .from("categories")
        .insert({ name: newCategoryName.trim() })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      setCategoryId(data.id);
      setNewCategoryName("");
      setAddingCategory(false);
      toast.success("Đã thêm nhóm hàng mới");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const resetForm = () => {
    setCode("");
    setName("");
    setCategoryId("");
    setCostPrice(0);
    setSalePrice(0);
    setAddingCategory(false);
    setNewCategoryName("");
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Tên sản phẩm không được để trống");
      let productCode = code.trim();
      if (!productCode) {
        const { data: existing } = await supabase
          .from("products")
          .select("code")
          .order("code", { ascending: false })
          .limit(100);
        let maxNum = 0;
        if (existing) {
          for (const p of existing) {
            const num = parseInt(p.code, 10);
            if (!isNaN(num) && num > maxNum) maxNum = num;
          }
        }
        productCode = String(maxNum + 1).padStart(6, "0");
      }
      const { data, error } = await supabase
        .from("products")
        .insert({
          code: productCode,
          name: name.trim(),
          category_id: categoryId || null,
          cost_price: costPrice,
          sale_price: salePrice,
          stock_quantity: 0,
        })
        .select()
        .single();
      if (error) throw error;
      return data as NewProduct;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Đã thêm sản phẩm mới");
      onSuccess?.(data);
      onOpenChange(false);
      resetForm();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const inputClass =
    "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) resetForm(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Thêm hàng hóa mới</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {/* Product Code */}
          <div>
            <Label>Mã hàng hóa</Label>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Mã tự động sinh nếu để trống"
              className="font-mono"
            />
          </div>

          {/* Product Name */}
          <div>
            <Label>Tên sản phẩm *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nhập tên sản phẩm"
            />
          </div>

          {/* Category with inline add */}
          <div>
            <Label>Nhóm hàng</Label>
            <div className="flex gap-1.5">
              <Popover open={categoryOpen} onOpenChange={setCategoryOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className="flex-1 justify-between h-10 text-sm font-normal"
                  >
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
                    {/* Inline add category */}
                    <div className="border-t p-2">
                      {addingCategory ? (
                        <div className="flex gap-1.5">
                          <Input
                            value={newCategoryName}
                            onChange={(e) => setNewCategoryName(e.target.value)}
                            placeholder="Tên nhóm mới"
                            className="h-8 text-sm"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                addCategoryMutation.mutate();
                              }
                              if (e.key === "Escape") setAddingCategory(false);
                            }}
                          />
                          <Button
                            size="sm"
                            className="h-8 px-3"
                            onClick={() => addCategoryMutation.mutate()}
                            disabled={addCategoryMutation.isPending}
                          >
                            {addCategoryMutation.isPending ? "..." : "Lưu"}
                          </Button>
                        </div>
                      ) : (
                        <button
                          className="flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 w-full px-1 py-1"
                          onClick={() => setAddingCategory(true)}
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Thêm nhóm mới
                        </button>
                      )}
                    </div>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Prices */}
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

          {/* Stock (read-only) */}
          <div>
            <Label>Tồn kho</Label>
            <Input value="0" disabled className="bg-muted" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { onOpenChange(false); resetForm(); }}>
            Hủy
          </Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={!name.trim() || saveMutation.isPending}
          >
            {saveMutation.isPending ? "Đang lưu..." : "Lưu"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
