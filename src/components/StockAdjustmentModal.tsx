import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CurrencyInput, formatCurrency } from "@/components/CurrencyInput";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: string;
  productName: string;
  type: "in" | "out";
  currentStock: number;
};

export function StockAdjustmentModal({ open, onOpenChange, productId, productName, type, currentStock }: Props) {
  const queryClient = useQueryClient();
  const [quantity, setQuantity] = useState(1);
  const [unitPrice, setUnitPrice] = useState(0);
  const [note, setNote] = useState("");

  const isIn = type === "in";
  const totalValue = quantity * unitPrice;

  const mutation = useMutation({
    mutationFn: async () => {
      if (quantity <= 0) throw new Error("Số lượng phải lớn hơn 0");
      if (!isIn && quantity > currentStock) throw new Error(`Tồn kho chỉ còn ${currentStock}, không thể xuất ${quantity}`);

      const { error: adjError } = await supabase.from("stock_adjustments").insert({
        product_id: productId,
        type,
        quantity,
        unit_price: unitPrice,
        note: note.trim(),
      });
      if (adjError) throw adjError;

      // Update product stock
      const newStock = isIn ? currentStock + quantity : currentStock - quantity;
      const { error: prodError } = await supabase
        .from("products")
        .update({ stock_quantity: newStock })
        .eq("id", productId);
      if (prodError) throw prodError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success(isIn ? "Đã nhập kho thành công" : "Đã xuất kho thành công");
      resetAndClose();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const resetAndClose = () => {
    setQuantity(1);
    setUnitPrice(0);
    setNote("");
    onOpenChange(false);
  };

  const inputClass =
    "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetAndClose(); else onOpenChange(v); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className={isIn ? "text-emerald-600" : "text-destructive"}>
            {isIn ? "📥 Nhập kho" : "📤 Xuất kho"} — {productName}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Số lượng *</Label>
            <Input
              type="number"
              min={1}
              max={!isIn ? currentStock : undefined}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
            />
            {!isIn && <p className="text-xs text-muted-foreground mt-1">Tồn kho hiện tại: {currentStock}</p>}
          </div>
          <div>
            <Label>Đơn giá</Label>
            <CurrencyInput value={unitPrice} onChange={setUnitPrice} className={inputClass} />
          </div>
          <div className="p-3 rounded-md bg-muted">
            <span className="text-sm text-muted-foreground">Thành tiền: </span>
            <span className="font-bold">{formatCurrency(totalValue)}</span>
          </div>
          <div>
            <Label>Ghi chú</Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={isIn ? "VD: Nhập lô hàng mùa hè" : "VD: Hàng lỗi trả nhà cung cấp"}
              rows={2}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={resetAndClose}>Hủy</Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || quantity <= 0}
            className={isIn ? "bg-emerald-600 hover:bg-emerald-700" : "bg-destructive hover:bg-destructive/90"}
          >
            {mutation.isPending ? "Đang xử lý..." : isIn ? "Xác nhận nhập" : "Xác nhận xuất"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
