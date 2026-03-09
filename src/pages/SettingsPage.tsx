import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { toast } from "sonner";
import { Store, Printer, Save, Plus, Pencil, Trash2, Star, ChevronDown, Copy, Code, Barcode } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────
type StoreSettings = {
  id: number;
  store_name: string;
  store_address: string;
  store_phone: string;
  receipt_footer_text: string;
  print_paper_size: string;
};

type PrintTemplate = {
  id: string;
  name: string;
  type: string;
  paper_size: string;
  content: string;
  is_default: boolean;
  created_at: string;
};

// ─── Constants ───────────────────────────────────────────────────
const TABS = [
  { key: "store", label: "Thông tin cửa hàng", icon: Store },
  { key: "print", label: "Quản lý mẫu in", icon: Printer },
] as const;

type TabKey = (typeof TABS)[number]["key"];

const TEMPLATE_TYPES: Record<string, string> = {
  sales_invoice: "Hóa đơn bán hàng",
  import_order: "Phiếu nhập hàng",
};

const PAPER_SIZES: Record<string, { label: string; width: number }> = {
  K80: { label: "K80 (80mm)", width: 302 },
  K58: { label: "K58 (58mm)", width: 220 },
  A4: { label: "A4", width: 595 },
};

const VARIABLES = [
  { key: "{{StoreName}}", desc: "Tên cửa hàng" },
  { key: "{{StoreAddress}}", desc: "Địa chỉ cửa hàng" },
  { key: "{{StorePhone}}", desc: "SĐT cửa hàng" },
  { key: "{{InvoiceCode}}", desc: "Mã hóa đơn" },
  { key: "{{CreatedAt}}", desc: "Ngày tạo" },
  { key: "{{CustomerName}}", desc: "Tên khách hàng" },
  { key: "{{ItemsList}}", desc: "Danh sách sản phẩm" },
  { key: "{{TotalAmount}}", desc: "Tổng tiền" },
  { key: "{{Discount}}", desc: "Giảm giá" },
  { key: "{{AmountPaid}}", desc: "Đã thanh toán" },
  { key: "{{FooterText}}", desc: "Lời chào cuối" },
];

const MOCK_DATA: Record<string, string> = {
  "{{StoreName}}": "Cửa hàng ABC",
  "{{StoreAddress}}": "123 Nguyễn Huệ, Q.1, TP.HCM",
  "{{StorePhone}}": "0901 234 567",
  "{{InvoiceCode}}": "HD090325001",
  "{{CreatedAt}}": "09/03/2026 14:30",
  "{{CustomerName}}": "Anh Tuấn",
  "{{ItemsList}}": `<tr><td style="padding:2px 0">Áo thun nam</td><td style="text-align:center">2</td><td style="text-align:right">150,000</td><td style="text-align:right">300,000</td></tr><tr><td style="padding:2px 0">Quần jean</td><td style="text-align:center">1</td><td style="text-align:right">350,000</td><td style="text-align:right">350,000</td></tr>`,
  "{{TotalAmount}}": "650,000",
  "{{Discount}}": "50,000",
  "{{AmountPaid}}": "600,000",
  "{{FooterText}}": "Cảm ơn quý khách và hẹn gặp lại!",
};

const DEFAULT_TEMPLATE = `<div style="font-family: 'Courier New', monospace; font-size: 13px; padding: 8px;">
  <div style="text-align: center; margin-bottom: 8px;">
    <div style="font-size: 16px; font-weight: bold;">{{StoreName}}</div>
    <div style="font-size: 11px;">{{StoreAddress}}</div>
    <div style="font-size: 11px;">ĐT: {{StorePhone}}</div>
  </div>
  <div style="border-top: 1px dashed #000; margin: 6px 0;"></div>
  <div style="text-align: center; font-weight: bold; font-size: 15px; margin: 4px 0;">HÓA ĐƠN BÁN HÀNG</div>
  <div style="font-size: 12px; margin-bottom: 6px;">
    <div>Mã HĐ: {{InvoiceCode}}</div>
    <div>Ngày: {{CreatedAt}}</div>
    <div>Khách hàng: {{CustomerName}}</div>
  </div>
  <div style="border-top: 1px dashed #000; margin: 6px 0;"></div>
  <table style="width: 100%; font-size: 12px; border-collapse: collapse;">
    <thead>
      <tr style="border-bottom: 1px dashed #000;">
        <th style="text-align: left; padding: 2px 0;">Sản phẩm</th>
        <th style="text-align: center;">SL</th>
        <th style="text-align: right;">Đơn giá</th>
        <th style="text-align: right;">T.Tiền</th>
      </tr>
    </thead>
    <tbody>{{ItemsList}}</tbody>
  </table>
  <div style="border-top: 1px dashed #000; margin: 6px 0;"></div>
  <div style="font-size: 12px;">
    <div style="display: flex; justify-content: space-between;"><span>Tổng tiền:</span><span style="font-weight:bold;">{{TotalAmount}}</span></div>
    <div style="display: flex; justify-content: space-between;"><span>Giảm giá:</span><span>{{Discount}}</span></div>
    <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 14px; margin-top: 4px;"><span>Thanh toán:</span><span>{{AmountPaid}}</span></div>
  </div>
  <div style="border-top: 1px dashed #000; margin: 8px 0;"></div>
  <div style="text-align: center; font-size: 12px; font-style: italic;">{{FooterText}}</div>
</div>`;

// ─── Parser ──────────────────────────────────────────────────────
function parseTemplate(content: string, data: Record<string, string>): string {
  let result = content;
  for (const [key, value] of Object.entries(data)) {
    result = result.split(key).join(value);
  }
  return result;
}

// ═════════════════════════════════════════════════════════════════
const SettingsPage = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabKey>("store");

  // Store settings state
  const [storeName, setStoreName] = useState("");
  const [storePhone, setStorePhone] = useState("");
  const [storeAddress, setStoreAddress] = useState("");
  const [receiptFooter, setReceiptFooter] = useState("");
  const [paperSize, setPaperSize] = useState("K80");

  // Template editor state
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<PrintTemplate | null>(null);
  const [tplName, setTplName] = useState("");
  const [tplType, setTplType] = useState("sales_invoice");
  const [tplPaper, setTplPaper] = useState("K80");
  const [tplContent, setTplContent] = useState(DEFAULT_TEMPLATE);
  const [tplDefault, setTplDefault] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PrintTemplate | null>(null);
  const [varsOpen, setVarsOpen] = useState(true);

  // ─── Queries ─────────────────────────────────────────────────
  const { data: settings, isLoading: settingsLoading } = useQuery({
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

  const { data: templates = [], isLoading: templatesLoading } = useQuery({
    queryKey: ["print_templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("print_templates")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as PrintTemplate[];
    },
  });

  useEffect(() => {
    if (settings) {
      setStoreName(settings.store_name);
      setStorePhone(settings.store_phone);
      setStoreAddress(settings.store_address);
      setReceiptFooter(settings.receipt_footer_text);
      setPaperSize(settings.print_paper_size);
    }
  }, [settings]);

  // ─── Live Preview ────────────────────────────────────────────
  const previewHtml = useMemo(() => parseTemplate(tplContent, MOCK_DATA), [tplContent]);
  const previewWidth = PAPER_SIZES[tplPaper]?.width || 302;

  // ─── Mutations ───────────────────────────────────────────────
  const saveSettingsMutation = useMutation({
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

  const saveTemplateMutation = useMutation({
    mutationFn: async () => {
      if (!tplName.trim()) throw new Error("Tên mẫu in không được để trống");

      // If setting as default, unset others of same type
      if (tplDefault) {
        await supabase
          .from("print_templates")
          .update({ is_default: false })
          .eq("type", tplType);
      }

      if (editingTemplate) {
        const { error } = await supabase
          .from("print_templates")
          .update({
            name: tplName.trim(),
            type: tplType,
            paper_size: tplPaper,
            content: tplContent,
            is_default: tplDefault,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingTemplate.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("print_templates")
          .insert({
            name: tplName.trim(),
            type: tplType,
            paper_size: tplPaper,
            content: tplContent,
            is_default: tplDefault,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["print_templates"] });
      toast.success(editingTemplate ? "Đã cập nhật mẫu in!" : "Đã tạo mẫu in mới!");
      setEditorOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("print_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["print_templates"] });
      toast.success("Đã xóa mẫu in");
      setDeleteTarget(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const setDefaultMutation = useMutation({
    mutationFn: async (tpl: PrintTemplate) => {
      await supabase.from("print_templates").update({ is_default: false }).eq("type", tpl.type);
      const { error } = await supabase.from("print_templates").update({ is_default: true }).eq("id", tpl.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["print_templates"] });
      toast.success("Đã đặt làm mẫu mặc định");
    },
    onError: (e: any) => toast.error(e.message),
  });

  // ─── Handlers ──────────────────────────────────────────────
  const openNewTemplate = () => {
    setEditingTemplate(null);
    setTplName("");
    setTplType("sales_invoice");
    setTplPaper("K80");
    setTplContent(DEFAULT_TEMPLATE);
    setTplDefault(false);
    setEditorOpen(true);
  };

  const openEditTemplate = (tpl: PrintTemplate) => {
    setEditingTemplate(tpl);
    setTplName(tpl.name);
    setTplType(tpl.type);
    setTplPaper(tpl.paper_size);
    setTplContent(tpl.content);
    setTplDefault(tpl.is_default);
    setEditorOpen(true);
  };

  const copyVariable = (v: string) => {
    navigator.clipboard.writeText(v);
    toast.success(`Đã copy: ${v}`);
  };

  // ─── Render ────────────────────────────────────────────────
  return (
    <div className="flex h-[calc(100vh-2rem)] -m-6">
      {/* Left sidebar */}
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
        {/* ═══ TAB: Store Info ═══ */}
        {activeTab === "store" && (
          <Card className="max-w-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Store className="h-5 w-5" /> Thông tin cửa hàng
              </CardTitle>
              <CardDescription>Thông tin này sẽ được sử dụng để in trên hóa đơn bán hàng.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {settingsLoading ? (
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
                    <Input id="store-name" value={storeName} onChange={(e) => setStoreName(e.target.value)} placeholder="VD: Cửa hàng ABC" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="store-phone">Điện thoại</Label>
                    <Input id="store-phone" value={storePhone} onChange={(e) => setStorePhone(e.target.value)} placeholder="VD: 0901 234 567" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="store-address">Địa chỉ</Label>
                    <Textarea id="store-address" value={storeAddress} onChange={(e) => setStoreAddress(e.target.value)} placeholder="VD: 123 Nguyễn Huệ, Q.1, TP.HCM" rows={2} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="receipt-footer">Lời chào cuối hóa đơn</Label>
                    <Textarea id="receipt-footer" value={receiptFooter} onChange={(e) => setReceiptFooter(e.target.value)} placeholder="VD: Cảm ơn quý khách và hẹn gặp lại!" rows={2} />
                  </div>
                  <div className="border-t pt-4 mt-2 flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="flex items-center gap-2"><Barcode className="h-4 w-4" /> Quản lý mã vạch hàng hóa</Label>
                      <p className="text-xs text-muted-foreground">Bật tính năng in tem mã vạch từ trang Hàng hóa.</p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                  <Button onClick={() => saveSettingsMutation.mutate()} disabled={saveSettingsMutation.isPending}>
                    <Save className="mr-1.5 h-4 w-4" />
                    {saveSettingsMutation.isPending ? "Đang lưu..." : "Lưu thay đổi"}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* ═══ TAB: Print Templates ═══ */}
        {activeTab === "print" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold">Quản lý mẫu in</h2>
                <p className="text-sm text-muted-foreground">Tạo và quản lý các mẫu in hóa đơn, phiếu nhập.</p>
              </div>
              <Button onClick={openNewTemplate}>
                <Plus className="mr-1.5 h-4 w-4" /> Thêm mẫu in mới
              </Button>
            </div>

            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Tên mẫu</TableHead>
                      <TableHead>Loại chứng từ</TableHead>
                      <TableHead>Khổ giấy</TableHead>
                      <TableHead>Mặc định</TableHead>
                      <TableHead className="text-right">Thao tác</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {templatesLoading ? (
                      Array.from({ length: 3 }).map((_, i) => (
                        <TableRow key={i}>
                          {Array.from({ length: 5 }).map((_, j) => (
                            <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                          ))}
                        </TableRow>
                      ))
                    ) : templates.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                          Chưa có mẫu in nào. Bấm "Thêm mẫu in mới" để bắt đầu.
                        </TableCell>
                      </TableRow>
                    ) : (
                      templates.map((tpl) => (
                        <TableRow key={tpl.id}>
                          <TableCell className="font-medium">{tpl.name}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">{TEMPLATE_TYPES[tpl.type] || tpl.type}</Badge>
                          </TableCell>
                          <TableCell>{PAPER_SIZES[tpl.paper_size]?.label || tpl.paper_size}</TableCell>
                          <TableCell>
                            {tpl.is_default ? (
                              <Badge className="bg-primary/10 text-primary border-primary/20">Mặc định</Badge>
                            ) : (
                              <button
                                onClick={() => setDefaultMutation.mutate(tpl)}
                                className="text-xs text-muted-foreground hover:text-primary transition-colors"
                              >
                                Đặt mặc định
                              </button>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditTemplate(tpl)}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(tpl)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* ═══ TEMPLATE EDITOR DIALOG ═══ */}
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-w-[95vw] w-[1200px] h-[90vh] flex flex-col p-0">
          <DialogHeader className="px-6 pt-5 pb-0">
            <DialogTitle>{editingTemplate ? "Sửa mẫu in" : "Tạo mẫu in mới"}</DialogTitle>
            <DialogDescription>Thiết kế mẫu in sử dụng HTML và các biến động.</DialogDescription>
          </DialogHeader>

          <div className="flex-1 flex overflow-hidden px-6 pb-5 gap-5 mt-4">
            {/* Left: Editor */}
            <div className="flex-1 flex flex-col min-w-0 space-y-4 overflow-y-auto pr-2">
              {/* Basic fields */}
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Tên mẫu in</Label>
                  <Input value={tplName} onChange={(e) => setTplName(e.target.value)} placeholder="VD: Mẫu K80 Mặc định" className="h-9" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Loại chứng từ</Label>
                  <Select value={tplType} onValueChange={setTplType}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(TEMPLATE_TYPES).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Khổ giấy</Label>
                  <Select value={tplPaper} onValueChange={setTplPaper}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(PAPER_SIZES).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="tpl-default"
                  checked={tplDefault}
                  onCheckedChange={(v) => setTplDefault(v === true)}
                />
                <Label htmlFor="tpl-default" className="text-sm cursor-pointer flex items-center gap-1.5">
                  <Star className="h-3.5 w-3.5" /> Đặt làm mẫu mặc định
                </Label>
              </div>

              {/* Variables cheat sheet */}
              <Collapsible open={varsOpen} onOpenChange={setVarsOpen}>
                <CollapsibleTrigger asChild>
                  <button className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
                    <Code className="h-3.5 w-3.5" />
                    Biến có sẵn (bấm để copy)
                    <ChevronDown className={cn("h-3 w-3 transition-transform", varsOpen && "rotate-180")} />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-2 grid grid-cols-2 gap-1">
                    {VARIABLES.map((v) => (
                      <button
                        key={v.key}
                        onClick={() => copyVariable(v.key)}
                        className="flex items-center gap-2 text-left px-2 py-1 rounded text-xs hover:bg-accent transition-colors group"
                      >
                        <code className="bg-muted px-1.5 py-0.5 rounded font-mono text-[11px] text-primary">{v.key}</code>
                        <span className="text-muted-foreground">{v.desc}</span>
                        <Copy className="h-3 w-3 ml-auto opacity-0 group-hover:opacity-50 transition-opacity" />
                      </button>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>

              {/* Code editor */}
              <div className="flex-1 min-h-0">
                <Label className="text-xs mb-1.5 block">Nội dung HTML</Label>
                <textarea
                  value={tplContent}
                  onChange={(e) => setTplContent(e.target.value)}
                  className="w-full h-full min-h-[300px] resize-none rounded-md border bg-muted/30 p-3 font-mono text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-ring"
                  spellCheck={false}
                />
              </div>

              {/* Save button */}
              <div className="flex gap-2 pt-1">
                <Button onClick={() => saveTemplateMutation.mutate()} disabled={saveTemplateMutation.isPending}>
                  <Save className="mr-1.5 h-4 w-4" />
                  {saveTemplateMutation.isPending ? "Đang lưu..." : "Lưu mẫu in"}
                </Button>
                <Button variant="outline" onClick={() => setEditorOpen(false)}>Hủy</Button>
              </div>
            </div>

            {/* Right: Live Preview */}
            <div className="w-[380px] shrink-0 flex flex-col">
              <Label className="text-xs mb-2 flex items-center gap-1.5">
                <Printer className="h-3.5 w-3.5" /> Xem trước ({PAPER_SIZES[tplPaper]?.label || tplPaper})
              </Label>
              <div className="flex-1 overflow-auto bg-muted/30 rounded-lg p-4 flex justify-center">
                <div
                  className="bg-background border shadow-lg"
                  style={{ width: previewWidth, minHeight: 400 }}
                >
                  <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══ DELETE CONFIRM ═══ */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa mẫu in</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc muốn xóa mẫu "{deleteTarget?.name}"? Thao tác này không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              Xóa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default SettingsPage;
