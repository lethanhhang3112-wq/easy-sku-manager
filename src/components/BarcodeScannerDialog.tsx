import { useState, useCallback } from "react";
import { useZxing } from "react-zxing";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScanLine, X } from "lucide-react";

interface BarcodeScannerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScan: (code: string) => void;
}

export const BarcodeScannerDialog = ({
  open,
  onOpenChange,
  onScan,
}: BarcodeScannerDialogProps) => {
  const [lastScanned, setLastScanned] = useState("");

  const { ref } = useZxing({
    paused: !open,
    onDecodeResult(result) {
      const text = result.getText();
      if (text && text !== lastScanned) {
        setLastScanned(text);
        onScan(text);
        onOpenChange(false);
      }
    },
    onError(err) {
      // Silently ignore decode errors during scanning
    },
  });

  const handleOpenChange = useCallback((v: boolean) => {
    if (!v) setLastScanned("");
    onOpenChange(v);
  }, [onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-0">
          <DialogTitle className="flex items-center gap-2">
            <ScanLine className="h-5 w-5" /> Quét mã vạch
          </DialogTitle>
          <DialogDescription>
            Hướng camera vào mã vạch sản phẩm để quét.
          </DialogDescription>
        </DialogHeader>
        <div className="relative bg-black">
          <video
            ref={ref}
            className="w-full aspect-[4/3] object-cover"
          />
          {/* Scan overlay */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-[70%] h-24 border-2 border-primary/70 rounded-lg relative">
              <div className="absolute inset-x-0 top-1/2 h-0.5 bg-primary/60 animate-pulse" />
            </div>
          </div>
        </div>
        <div className="px-5 pb-4 flex justify-end">
          <Button variant="outline" size="sm" onClick={() => handleOpenChange(false)}>
            <X className="mr-1.5 h-3.5 w-3.5" /> Đóng
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// Compact scan button to embed next to search inputs
interface ScanButtonProps {
  onScan: (code: string) => void;
  className?: string;
}

export const BarcodeScanButton = ({ onScan, className }: ScanButtonProps) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="outline"
        size="icon"
        className={`h-9 w-9 shrink-0 ${className || ""}`}
        onClick={() => setOpen(true)}
        title="Quét mã vạch"
      >
        <ScanLine className="h-4 w-4" />
      </Button>
      <BarcodeScannerDialog
        open={open}
        onOpenChange={setOpen}
        onScan={onScan}
      />
    </>
  );
};
