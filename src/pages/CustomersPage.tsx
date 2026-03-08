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

type Customer = {
  id: string;
  code: string;
  name: string;
  phone: string | null;
  address: string | null;
  created_at: string;
};

async function generateCustomerCode(): Promise<string> {
  const { data } = await supabase
    .from("customers")
    .select("code")
    .like("code", "KH%")
    .order("code", { ascending: false })
    .limit(1);

  if (data && data.length > 0) {
    const lastNum = parseInt(data[0].code.replace("KH", ""), 10);
    return `KH${String(lastNum + 1).padStart(4, "0")}`;
  }
  return "KH0001";
}

const CustomersPage = () => {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Customer[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editing) {
        const { error } = await supabase
          .from("customers")
          .update({ name, phone: phone || null, address: address || null })
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("customers")
          .insert({ code, name, phone: phone || null, address: address || null });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      toast.success(editing ? "Đã cập nhật khách hàng" : "Đã thêm khách hàng");
      closeDialog();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("customers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      toast.success("Đã xóa khách hàng");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openAdd = async () => {
    setEditing(null);
    setCode(await generateCustomerCode());
    setName("");
    setPhone("");
    setAddress("");
    setOpen(true);
  };

  const openEdit = (c: Customer) => {
    setEditing(c);
    setCode(c.code);
    setName(c.name);
    setPhone(c.phone || "");
    setAddress(c.address || "");
    setOpen(true);
  };

  const closeDialog = () => {
    setOpen(false);
    setEditing(null);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Khách hàng</h1>
        <Button onClick={openAdd}>
          <Plus className="mr-2 h-4 w-4" /> Thêm khách hàng
        </Button>
      </div>

      <div className="bg-card rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Mã KH</TableHead>
              <TableHead>Tên</TableHead>
              <TableHead>Điện thoại</TableHead>
              <TableHead>Địa chỉ</TableHead>
              <TableHead className="w-[100px]">Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Đang tải...</TableCell></TableRow>
            ) : customers.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Chưa có khách hàng nào</TableCell></TableRow>
            ) : (
              customers.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono">{c.code}</TableCell>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell>{c.phone || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{c.address || "—"}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(c)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(c.id)}>
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
            <DialogTitle>{editing ? "Sửa khách hàng" : "Thêm khách hàng"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Mã khách hàng</Label>
              <Input value={code} disabled className="font-mono bg-muted" />
            </div>
            <div>
              <Label>Tên khách hàng *</Label>
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

export default CustomersPage;
