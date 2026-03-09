import { useState, useMemo, useRef, useEffect } from "react";
import Barcode from "react-barcode";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Trash2, ArrowRight, Printer, ArrowLeft } from "lucide-react";
import { formatCurrency } from "@/components/CurrencyInput";
import { cn } from "@/lib/utils";

type ProductItem = {
  id: string;
  code: string;
  name: string;
  sale_price: number;
  stock_quantity: number;
};

type PrintItem = ProductItem & { print_qty: number };

type Step = "quantity" | "options" | "preview";

const LAYOUTS = [
  { value: "3", label: "3 nhãn / hàng (A4/Tomy)", cols: 3, barWidth: 1.0, barHeight: 28, nameFontSize: "text-[9px]", priceFontSize: "text-[10px]", storeFontSize: "text-[8px]", codeFontSize: 8, maxW: "max-w-[680px]", padding: "p-1.5" },
  { value: "2", label: "2 nhãn / hàng", cols: 2, barWidth: 1.4, barHeight: 36, nameFontSize: "text-[11px]", priceFontSize: "text-xs", storeFontSize: "text-[9px]", codeFontSize: 10, maxW: "max-w-[460px]", padding: "p-2" },
  { value: "1", label: "1 nhãn / hàng (Giấy cuộn)", cols: 1, barWidth: 1.8, barHeight: 44, nameFontSize: "text-xs", priceFontSize: "text-sm", storeFontSize: "text-[10px]", codeFontSize: 12, maxW: "max-w-[280px]", padding: "p-3" },
];

interface BarcodePrintDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: ProductItem[];
  storeName?: string;
}

export const BarcodePrintDialog = ({
  open,
  onOpenChange,
  products,
  storeName = "",
}: BarcodePrintDialogProps) => {
  const [step, setStep] = useState<Step>("quantity");
  const [items, setItems] = useState<PrintItem[]>([]);
  const [showPrice, setShowPrice] = useState(true);
  const [showStoreName, setShowStoreName] = useState(false);
  const [layout, setLayout] = useState("3");
  const printRef = useRef<HTMLDivElement>(null);

  // Initialize items when dialog opens with products
  useEffect(() => {
    if (open && products.length > 0) {
      setItems(
        products.map((p) => ({
          ...p,
          print_qty: 1,
        }))
      );
      setStep("quantity");
    }
  }, [open, products]);

  const updateQty = (id: string, qty: number) => {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, print_qty: Math.max(1, qty) } : i))
    );
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  // Data replication: repeat each product by its print_qty
  const replicatedItems = useMemo(() => {
    const result: PrintItem[] = [];
    for (const item of items) {
      for (let i = 0; i < item.print_qty; i++) {
        result.push(item);
      }
    }
    return result;
  }, [items]);

  const selectedLayout = LAYOUTS.find((l) => l.value === layout) || LAYOUTS[0];

  const handlePrint = () => {
    window.print();
  };

  const totalLabels = items.reduce((s, i) => s + i.print_qty, 0);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className={cn(
          "p-0 flex flex-col",
          step === "preview"
            ? "max-w-[95vw] w-[900px] h-[90vh]"
            : "max-w-2xl"
        )}
      >
        <DialogHeader className="px-6 pt-5 pb-0">
          <DialogTitle>
            {step === "quantity" && "In tem mã vạch — Nhập số lượng"}
            {step === "options" && "In tem mã vạch — Tùy chọn"}
            {step === "preview" && "In tem mã vạch — Xem trước"}
          </DialogTitle>
          <DialogDescription>
            {step === "quantity" && "Chọn số lượng tem in cho mỗi sản phẩm."}
            {step === "options" && "Cấu hình kiểu giấy và nội dung hiển thị."}
            {step === "preview" && `Tổng ${totalLabels} nhãn — Bấm "In tem mã" để in.`}
          </DialogDescription>
        </DialogHeader>

        {/* ═══ STEP 1: Quantity ═══ */}
        {step === "quantity" && (
          <div className="flex-1 overflow-auto px-6 py-4">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Mã hàng</TableHead>
                  <TableHead>Tên hàng</TableHead>
                  <TableHead className="w-[120px] text-center">Số lượng tem</TableHead>
                  <TableHead className="w-[50px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                      Không có sản phẩm nào
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-mono text-xs text-primary">
                        {item.code}
                      </TableCell>
                      <TableCell className="text-sm">{item.name}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={1}
                          value={item.print_qty}
                          onChange={(e) =>
                            updateQty(item.id, parseInt(e.target.value) || 1)
                          }
                          className="h-8 text-center text-sm"
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => removeItem(item.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            <div className="flex justify-between items-center mt-4">
              <span className="text-sm text-muted-foreground">
                Tổng: {totalLabels} nhãn
              </span>
              <Button
                onClick={() => setStep("options")}
                disabled={items.length === 0}
              >
                Tiếp tục <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* ═══ STEP 2: Options ═══ */}
        {step === "options" && (
          <div className="flex-1 overflow-auto px-6 py-4 space-y-5">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Checkbox
                  id="show-price"
                  checked={showPrice}
                  onCheckedChange={(v) => setShowPrice(v === true)}
                />
                <Label htmlFor="show-price" className="cursor-pointer">
                  In kèm giá bán
                </Label>
              </div>
              <div className="flex items-center gap-3">
                <Checkbox
                  id="show-store"
                  checked={showStoreName}
                  onCheckedChange={(v) => setShowStoreName(v === true)}
                />
                <Label htmlFor="show-store" className="cursor-pointer">
                  In tên cửa hàng
                </Label>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Kiểu giấy in</Label>
              <Select value={layout} onValueChange={setLayout}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LAYOUTS.map((l) => (
                    <SelectItem key={l.value} value={l.value}>
                      {l.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-between mt-6">
              <Button variant="outline" onClick={() => setStep("quantity")}>
                <ArrowLeft className="mr-1.5 h-4 w-4" /> Quay lại
              </Button>
              <Button onClick={() => setStep("preview")}>
                Xem bản in <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* ═══ STEP 3: Preview ═══ */}
        {step === "preview" && (
          <div className="flex-1 flex flex-col overflow-hidden px-6 pb-5">
            <div className="flex justify-between items-center mb-3">
              <Button variant="outline" size="sm" onClick={() => setStep("options")}>
                <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Quay lại
              </Button>
              <Button size="sm" onClick={handlePrint}>
                <Printer className="mr-1.5 h-4 w-4" /> In tem mã
              </Button>
            </div>

            <div className="flex-1 overflow-auto bg-muted/30 rounded-lg p-4">
              <div
                ref={printRef}
                id="barcode-print-area"
                className={cn(
                  "grid gap-2 mx-auto bg-background p-2",
                  selectedLayout.cols === 3 && "grid-cols-3",
                  selectedLayout.cols === 2 && "grid-cols-2",
                  selectedLayout.cols === 1 && "grid-cols-1",
                  selectedLayout.maxW
                )}
              >
                {replicatedItems.map((item, idx) => (
                  <div
                    key={`${item.id}-${idx}`}
                    className={cn("border border-dashed border-border/60 flex flex-col items-center text-center", selectedLayout.padding)}
                  >
                    {showStoreName && storeName && (
                      <div className={cn("font-medium text-muted-foreground mb-0.5 truncate w-full", selectedLayout.storeFontSize)}>
                        {storeName}
                      </div>
                    )}
                    <div className={cn("font-medium truncate w-full leading-tight mb-1", selectedLayout.nameFontSize)}>
                      {item.name}
                    </div>
                    <Barcode
                      value={item.code}
                      width={selectedLayout.barWidth}
                      height={selectedLayout.barHeight}
                      fontSize={selectedLayout.codeFontSize}
                      margin={0}
                      displayValue={true}
                    />
                    {showPrice && (
                      <div className={cn("font-bold mt-1", selectedLayout.priceFontSize)}>
                        {formatCurrency(item.sale_price)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
