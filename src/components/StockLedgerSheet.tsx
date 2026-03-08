import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";

type LedgerEntry = {
  id: string;
  date: string;
  code: string;
  type: "import" | "sale";
  partnerName: string;
  quantity: number;
  price: number;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: { id: string; name: string; code: string; stock_quantity: number } | null;
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

export function StockLedgerSheet({ open, onOpenChange, product }: Props) {
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !product) return;
    setLoading(true);
    fetchStockLedger(product.id)
      .then(setEntries)
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, [open, product]);

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

        <div className="mt-6">
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
      </SheetContent>
    </Sheet>
  );
}
