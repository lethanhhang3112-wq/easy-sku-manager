import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";

type Supplier = {
  id: string;
  code: string;
  name: string;
  phone: string | null;
  address: string | null;
  created_at: string;
};

async function generateSupplierCode(): Promise<string> {
  const { data } = await supabase
    .from("suppliers")
    .select("code")
    .like("code", "NCC%")
    .order("code", { ascending: false })
    .limit(1);

  if (data && data.length > 0) {
    const lastNum = parseInt(data[0].code.replace("NCC", ""), 10);
    return `NCC${String(lastNum + 1).padStart(4, "0")}`;
  }
  return "NCC0001";
}

const SuppliersPage = () => {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");

  const { data: suppliers = [], isLoading } = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suppliers")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Supplier[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editing) {
        const { error } = await supabase
          .from("suppliers")
          .update({ name, phone: phone || null, address: address || null })
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("suppliers")
          .insert({ code, name, phone: phone || null, address: address || null });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      toast.success(editing ? "Đã cập nhật nhà cung cấp" : "Đã thêm nhà cung cấp");
      closeDialog();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("suppliers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      toast.success("Đã xóa nhà cung cấp");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openAdd = async () => {
    setEditing(null);
    setCode(await generateSupplierCode());
    setName("");
    setPhone("");
    setAddress("");
    setOpen(true);
  };

  const openEdit = (s: Supplier) => {
    setEditing(s);
    setCode(s.code);
    setName(s.name);
    setPhone(s.phone || "");
    setAddress(s.address || "");
    setOpen(true);
  };

  const closeDialog = () => {
    setOpen(false);
    setEditing(null);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Nhà cung cấp</h1>
        <Button onClick={openAdd}>
          <Plus className="mr-2 h-4 w-4" /> Thêm NCC
        </Button>
      </div>

      <div className="bg-card rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Mã NCC</TableHead>
              <TableHead>Tên</TableHead>
              <TableHead>Điện thoại</TableHead>
              <TableHead>Địa chỉ</TableHead>
              <TableHead className="w-[100px]">Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Đang tải...</TableCell></TableRow>
            ) : suppliers.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Chưa có nhà cung cấp nào</TableCell></TableRow>
            ) : (
              suppliers.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-mono">{s.code}</TableCell>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell>{s.phone || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{s.address || "—"}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(s)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(s.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Sửa nhà cung cấp" : "Thêm nhà cung cấp"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Mã NCC</Label>
              <Input value={code} disabled className="font-mono bg-muted" />
            </div>
            <div>
              <Label>Tên nhà cung cấp *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nhập tên" />
            </div>
            <div>
              <Label>Điện thoại</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Nhập SĐT" />
            </div>
            <div>
              <Label>Địa chỉ</Label>
              <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Nhập địa chỉ" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Hủy</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={!name.trim() || saveMutation.isPending}>
              {saveMutation.isPending ? "Đang lưu..." : "Lưu"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SuppliersPage;
