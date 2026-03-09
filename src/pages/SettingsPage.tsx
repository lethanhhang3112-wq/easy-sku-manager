import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Store, Printer, Save } from "lucide-react";
import { cn } from "@/lib/utils";

type StoreSettings = {
  id: number;
  store_name: string;
  store_address: string;
  store_phone: string;
  receipt_footer_text: string;
  print_paper_size: string;
};

const TABS = [
  { key: "store", label: "Thông tin cửa hàng", icon: Store },
  { key: "print", label: "Thiết lập in ấn", icon: Printer },
] as const;

type TabKey = (typeof TABS)[number]["key"];

const SettingsPage = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabKey>("store");

  // Form state
  const [storeName, setStoreName] = useState("");
  const [storePhone, setStorePhone] = useState("");
  const [storeAddress, setStoreAddress] = useState("");
  const [receiptFooter, setReceiptFooter] = useState("");
  const [paperSize, setPaperSize] = useState("K80");

  const { data: settings, isLoading } = useQuery({
    queryKey: ["store_settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_settings")
        .select("*")
        .eq("id", 1)
        .single();
      if (error) throw error;
      return data as StoreSettings;
    },
  });

  // Populate form when data loads
  useEffect(() => {
    if (settings) {
      setStoreName(settings.store_name);
      setStorePhone(settings.store_phone);
      setStoreAddress(settings.store_address);
      setReceiptFooter(settings.receipt_footer_text);
      setPaperSize(settings.print_paper_size);
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("store_settings")
        .update({
          store_name: storeName.trim(),
          store_phone: storePhone.trim(),
          store_address: storeAddress.trim(),
          receipt_footer_text: receiptFooter.trim(),
          print_paper_size: paperSize,
          updated_at: new Date().toISOString(),
        })
        .eq("id", 1);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["store_settings"] });
      toast.success("Đã lưu cài đặt thành công!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="flex h-[calc(100vh-2rem)] -m-6">
      {/* Left sidebar tabs */}
      <div className="w-[220px] shrink-0 border-r bg-muted/30 p-4 space-y-1">
        <h2 className="text-sm font-semibold text-muted-foreground mb-3 px-2">Cài đặt</h2>
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors text-left",
                activeTab === tab.key
                  ? "bg-primary text-primary-foreground font-medium"
                  : "text-foreground hover:bg-accent"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === "store" && (
          <Card className="max-w-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Store className="h-5 w-5" /> Thông tin cửa hàng
              </CardTitle>
              <CardDescription>
                Thông tin này sẽ được sử dụng để in trên hóa đơn bán hàng.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {isLoading ? (
                <div className="space-y-4">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="space-y-2">
                      <Skeleton className="h-4 w-28" />
                      <Skeleton className="h-10 w-full" />
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="store-name">Tên cửa hàng</Label>
                    <Input
                      id="store-name"
                      value={storeName}
                      onChange={(e) => setStoreName(e.target.value)}
                      placeholder="VD: Cửa hàng ABC"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="store-phone">Điện thoại</Label>
                    <Input
                      id="store-phone"
                      value={storePhone}
                      onChange={(e) => setStorePhone(e.target.value)}
                      placeholder="VD: 0901 234 567"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="store-address">Địa chỉ</Label>
                    <Textarea
                      id="store-address"
                      value={storeAddress}
                      onChange={(e) => setStoreAddress(e.target.value)}
                      placeholder="VD: 123 Nguyễn Huệ, Q.1, TP.HCM"
                      rows={2}
                    />
                  </div>
                  <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                    <Save className="mr-1.5 h-4 w-4" />
                    {saveMutation.isPending ? "Đang lưu..." : "Lưu thay đổi"}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === "print" && (
          <Card className="max-w-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Printer className="h-5 w-5" /> Thiết lập in ấn
              </CardTitle>
              <CardDescription>
                Cấu hình khổ giấy và nội dung hiển thị trên hóa đơn.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {isLoading ? (
                <div className="space-y-4">
                  {Array.from({ length: 2 }).map((_, i) => (
                    <div key={i} className="space-y-2">
                      <Skeleton className="h-4 w-28" />
                      <Skeleton className="h-10 w-full" />
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label>Khổ giấy in</Label>
                    <Select value={paperSize} onValueChange={setPaperSize}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="K80">K80 (80mm)</SelectItem>
                        <SelectItem value="K58">K58 (58mm)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="receipt-footer">Lời chào cuối hóa đơn</Label>
                    <Textarea
                      id="receipt-footer"
                      value={receiptFooter}
                      onChange={(e) => setReceiptFooter(e.target.value)}
                      placeholder="VD: Cảm ơn quý khách và hẹn gặp lại!"
                      rows={3}
                    />
                  </div>
                  <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                    <Save className="mr-1.5 h-4 w-4" />
                    {saveMutation.isPending ? "Đang lưu..." : "Lưu thay đổi"}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default SettingsPage;
