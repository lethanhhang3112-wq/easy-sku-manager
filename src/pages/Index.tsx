import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, Package, AlertTriangle, ShoppingCart } from "lucide-react";

const stats = [
  { title: "Doanh thu hôm nay", value: "0 ₫", icon: DollarSign, color: "text-primary" },
  { title: "Đơn bán hôm nay", value: "0", icon: ShoppingCart, color: "text-success" },
  { title: "Tổng sản phẩm", value: "0", icon: Package, color: "text-accent-foreground" },
  { title: "Sắp hết hàng", value: "0", icon: AlertTriangle, color: "text-destructive" },
];

const Index = () => {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Tổng quan</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <stat.icon className={`h-5 w-5 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default Index;
