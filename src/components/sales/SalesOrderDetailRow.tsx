import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar } from "@/components/ui/calendar";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  SquareArrowOutUpRight, CalendarIcon, Trash2, Copy, FileDown,
  Pencil, Save, RotateCcw, Printer,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/components/CurrencyInput";

const fmt = (n: number) => formatCurrency(n);

type SalesOrder = {
  id: string;
  code: string;
  customer_id: string | null;
  total_amount: number;
  payment_method: string;
  created_at: string;
  status: string;
  customers: { name: string; code: string } | null;
};

type DetailItem = {
  id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  products: { code: string; name: string } | null;
};

interface SalesOrderDetailRowProps {
  order: SalesOrder;
  colSpan: number;
  onVoid: (order: SalesOrder) => void;
  onCopy: (order: SalesOrder, items: DetailItem[]) => void;
  onExport: (order: SalesOrder, items: DetailItem[]) => void;
  onPrint: () => void;
}

export const SalesOrderDetailRow = ({
  order,
  colSpan,
  onVoid,
  onCopy,
  onExport,
  onPrint,
}: SalesOrderDetailRowProps) => {
  const [notes, setNotes] = useState("");

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["sales_detail_items", order.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales_order_items")
        .select("*, products:product_id(code, name)")
        .eq("sales_order_id", order.id);
      if (error) throw error;
      return data as DetailItem[];
    },
  });

  const subtotal = items.reduce((s, i) => s + i.quantity * i.unit_price, 0);
  const discount = 0;
  const customerOwes = subtotal - discount;
  const customerPaid = order.total_amount;
  const isCancelled = order.status === "cancelled";

  return (
    <tr>
      <td colSpan={colSpan} className="p-0 border-0">
        <div className="border-t-2 border-primary bg-primary/[0.02]">
          <Tabs defaultValue="info" className="w-full">
            {/* ─── Tab Navigation ─── */}
            <div className="px-5 pt-4">
              <TabsList className="w-fit">
                <TabsTrigger value="info">Thông tin</TabsTrigger>
                <TabsTrigger value="payment-history">Lịch sử thanh toán</TabsTrigger>
              </TabsList>
            </div>

            {/* ═══ INFO TAB ═══ */}
            <TabsContent value="info" className="mt-0 px-5 pb-0">
              {/* ── Header Row ── */}
              <div className="flex items-center gap-4 py-3 flex-wrap">
                <span className="font-semibold text-sm flex items-center gap-1.5">
                  {order.customers?.name || "Khách lẻ"}
                  <SquareArrowOutUpRight className="h-3.5 w-3.5 text-primary cursor-pointer" />
                </span>
                <span className="text-sm text-muted-foreground">
                  Mã HĐ: <span className="font-mono text-primary">{order.code}</span>
                </span>
                <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-0 shadow-none">
                  {isCancelled ? "Đã hủy" : "Hoàn thành"}
                </Badge>
                <span className="ml-auto text-sm text-muted-foreground">Chi nhánh trung tâm</span>
              </div>

              {/* ── General Info Grid ── */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-3 py-3 border-y border-border text-sm">
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">Người tạo</span>
                  <p className="font-medium">Admin</p>
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">Người bán</span>
                  <Select defaultValue="admin">
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="staff1">Nhân viên 1</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">Ngày bán</span>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="w-full justify-start text-sm h-8 font-normal">
                        <CalendarIcon className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" />
                        {format(new Date(order.created_at), "dd/MM/yyyy HH:mm")}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={new Date(order.created_at)}
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">Kênh bán</span>
                  <Select defaultValue="direct">
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="direct">Bán trực tiếp</SelectItem>
                      <SelectItem value="online">Online</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">Bảng giá</span>
                  <p className="font-medium">Bảng giá chung</p>
                </div>
              </div>

              {/* ── Product Table ── */}
              <div className="py-3">
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="text-xs font-semibold">Mã hàng</TableHead>
                        <TableHead className="text-xs font-semibold">Tên hàng</TableHead>
                        <TableHead className="text-xs font-semibold text-right">Số lượng</TableHead>
                        <TableHead className="text-xs font-semibold text-right">Đơn giá</TableHead>
                        <TableHead className="text-xs font-semibold text-right">Giảm giá</TableHead>
                        <TableHead className="text-xs font-semibold text-right">Giá bán</TableHead>
                        <TableHead className="text-xs font-semibold text-right">Thành tiền</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoading ? (
                        Array.from({ length: 2 }).map((_, i) => (
                          <TableRow key={i}>
                            {Array.from({ length: 7 }).map((_, j) => (
                              <TableCell key={j}><Skeleton className="h-3 w-full" /></TableCell>
                            ))}
                          </TableRow>
                        ))
                      ) : items.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-muted-foreground text-xs py-6">
                            Không có sản phẩm
                          </TableCell>
                        </TableRow>
                      ) : (
                        items.map((item) => {
                          const itemDiscount = 0;
                          const salePrice = item.unit_price - itemDiscount;
                          const total = item.quantity * salePrice;
                          return (
                            <TableRow key={item.id}>
                              <TableCell className="font-mono text-xs text-primary">{item.products?.code || "—"}</TableCell>
                              <TableCell className="text-sm">{item.products?.name || "—"}</TableCell>
                              <TableCell className="text-right">{item.quantity}</TableCell>
                              <TableCell className="text-right">{fmt(item.unit_price)}</TableCell>
                              <TableCell className="text-right text-muted-foreground">{fmt(itemDiscount)}</TableCell>
                              <TableCell className="text-right">{fmt(salePrice)}</TableCell>
                              <TableCell className="text-right font-medium">{fmt(total)}</TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* ── Summary + Notes ── */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-3 border-t border-border">
                {/* Left: Notes */}
                <div>
                  <Textarea
                    placeholder="Ghi chú..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="min-h-[100px] text-sm resize-none"
                  />
                </div>
                {/* Right: Financial Summary */}
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tổng tiền hàng</span>
                    <span className="font-medium">{fmt(subtotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Giảm giá hóa đơn</span>
                    <span className="font-medium">{fmt(discount)}</span>
                  </div>
                  <div className="flex justify-between border-t border-border pt-2">
                    <span className="font-semibold">Khách cần trả</span>
                    <span className="font-semibold text-primary">{fmt(customerOwes)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Khách đã trả</span>
                    <span className="font-medium">{fmt(customerPaid)}</span>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* ═══ PAYMENT HISTORY TAB ═══ */}
            <TabsContent value="payment-history" className="mt-0 px-5 pb-4">
              <PaymentHistoryTable order={order} />
            </TabsContent>
          </Tabs>

          {/* ─── Sticky Action Bar ─── */}
          <div className="border-t border-border px-5 py-3 flex items-center gap-2 flex-wrap bg-background">
            {/* Left: Ghost actions */}
            <div className="flex items-center gap-1">
              {!isCancelled && (
                <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => onVoid(order)}>
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Hủy
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={() => onCopy(order, items)}>
                <Copy className="mr-1.5 h-3.5 w-3.5" /> Sao chép
              </Button>
              <Button variant="ghost" size="sm" onClick={() => onExport(order, items)}>
                <FileDown className="mr-1.5 h-3.5 w-3.5" /> Xuất file
              </Button>
            </div>

            {/* Right: Solid/Outline actions */}
            <div className="ml-auto flex items-center gap-2">
              <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">
                <Pencil className="mr-1.5 h-3.5 w-3.5" /> Chỉnh sửa
              </Button>
              <Button variant="outline" size="sm">
                <Save className="mr-1.5 h-3.5 w-3.5" /> Lưu
              </Button>
              <Button variant="outline" size="sm">
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Trả hàng
              </Button>
              <Button variant="outline" size="sm" onClick={onPrint}>
                <Printer className="mr-1.5 h-3.5 w-3.5" /> In
              </Button>
            </div>
          </div>
        </div>
      </td>
    </tr>
  );
};
