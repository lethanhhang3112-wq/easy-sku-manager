import { useState, useMemo, useRef, useEffect, useCallback } from "react";
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

export type BarcodePrintProduct = {
  id: string;
  code: string;
  name: string;
  sale_price: number;
  defaultPrintQuantity?: number;
};

type PrintItem = BarcodePrintProduct & { print_qty: number };

type Step = "quantity" | "options" | "preview";

const LAYOUTS = [
  { value: "xp350-2", label: "Xprinter 350BM — 70×22mm (2 tem/hàng)", cols: 2, barWidth: 0.8, barHeight: 20, nameFontSize: "text-[7px]", priceFontSize: "text-[8px]", storeFontSize: "text-[6px]", codeFontSize: 6, maxW: "max-w-[264px]", padding: "p-0.5", paperWidth: "70mm", paperHeight: "22mm", labelWidth: "35mm", labelHeight: "22mm" },
  { value: "3", label: "3 nhãn / hàng (A4/Tomy)", cols: 3, barWidth: 1.0, barHeight: 28, nameFontSize: "text-[9px]", priceFontSize: "text-[10px]", storeFontSize: "text-[8px]", codeFontSize: 8, maxW: "max-w-[680px]", padding: "p-1.5", paperWidth: "210mm", paperHeight: "297mm", labelWidth: undefined, labelHeight: undefined },
  { value: "2", label: "2 nhãn / hàng (A4)", cols: 2, barWidth: 1.4, barHeight: 36, nameFontSize: "text-[11px]", priceFontSize: "text-xs", storeFontSize: "text-[9px]", codeFontSize: 10, maxW: "max-w-[460px]", padding: "p-2", paperWidth: "210mm", paperHeight: "297mm", labelWidth: undefined, labelHeight: undefined },
  { value: "1", label: "1 nhãn / hàng (Giấy cuộn)", cols: 1, barWidth: 1.8, barHeight: 44, nameFontSize: "text-xs", priceFontSize: "text-sm", storeFontSize: "text-[10px]", codeFontSize: 12, maxW: "max-w-[280px]", padding: "p-3", paperWidth: "80mm", paperHeight: undefined, labelWidth: undefined, labelHeight: undefined },
];

interface BarcodePrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialProducts: BarcodePrintProduct[];
  storeName?: string;
}

export const BarcodePrintModal = ({
  isOpen,
  onClose,
  initialProducts,
  storeName = "",
}: BarcodePrintModalProps) => {
  const [step, setStep] = useState<Step>("quantity");
  const [items, setItems] = useState<PrintItem[]>([]);
  const [showPrice, setShowPrice] = useState(true);
  const [showStoreName, setShowStoreName] = useState(false);
  const [layout, setLayout] = useState("3");
  const printRef = useRef<HTMLDivElement>(null);

  // Stabilize initialProducts to avoid infinite useEffect loops
  const productsKey = initialProducts.map((p) => `${p.id}:${p.defaultPrintQuantity ?? 1}`).join(",");

  useEffect(() => {
    if (isOpen && initialProducts.length > 0) {
      setItems(
        initialProducts.map((p) => ({
          ...p,
          print_qty: p.defaultPrintQuantity ?? 1,
        }))
      );
      setStep("quantity");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, productsKey]);

  const updateQty = (id: string, qty: number) => {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, print_qty: Math.max(1, qty) } : i))
    );
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

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
    // Inject dynamic print styles based on selected layout
    const styleId = "barcode-print-styles";
    let styleEl = document.getElementById(styleId);
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = styleId;
      document.head.appendChild(styleEl);
    }

    const isXprinter = selectedLayout.value === "xp350-2";
    const pageWidth = selectedLayout.paperWidth || "210mm";
    const pageHeight = selectedLayout.paperHeight || "297mm";

    const cols = selectedLayout.cols;

    styleEl.textContent = `
      @media print {
        @page {
          size: ${pageWidth} ${pageHeight || "auto"};
          margin: 0;
        }
        html, body {
          height: auto !important;
          overflow: visible !important;
          margin: 0 !important;
          padding: 0 !important;
        }
        body * { visibility: hidden !important; }
        #barcode-print-area,
        #barcode-print-area * { visibility: visible !important; }
        #barcode-print-area {
          position: absolute !important;
          left: 0;
          top: 0;
          width: ${pageWidth};
          height: auto !important;
          overflow: visible !important;
          padding: ${isXprinter ? "0" : "2mm"} !important;
          margin: 0 !important;
          display: grid !important;
          grid-template-columns: repeat(${cols}, 1fr) !important;
          gap: ${isXprinter ? "0" : "1mm"} !important;
        }
        #barcode-print-area > div {
          border: none !important;
          break-inside: avoid !important;
          page-break-inside: avoid !important;
          page-break-after: auto !important;
          overflow: visible !important;
          display: flex !important;
          flex-direction: column !important;
          align-items: center !important;
          justify-content: center !important;
          ${isXprinter ? `
            width: ${selectedLayout.labelWidth};
            height: ${selectedLayout.labelHeight};
            padding: 1mm !important;
          ` : `
            padding: 1.5mm !important;
          `}
        }
      }
    `;

    window.print();
  };

  const totalLabels = items.reduce((s, i) => s + i.print_qty, 0);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        className={cn(
          "p-0 flex flex-col z-[60]",
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

        {/* STEP 1: Quantity */}
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

        {/* STEP 2: Options */}
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
                <SelectContent className="z-[70]">
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

        {/* STEP 3: Preview */}
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
