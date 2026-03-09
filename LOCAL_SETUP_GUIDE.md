# 🚀 Hướng dẫn cài đặt và chạy dự án trên máy local

> Tài liệu này hướng dẫn chi tiết từng bước để chạy dự án **KiotPOS** trên máy tính cá nhân sau khi clone hoặc tải mã nguồn về.

---

## 📋 1. Yêu cầu hệ thống (Prerequisites)

Trước khi bắt đầu, hãy đảm bảo máy tính đã cài đặt các phần mềm sau:

| Phần mềm | Phiên bản yêu cầu | Tải về |
|---|---|---|
| **Node.js** | v18 LTS hoặc v20 LTS | [nodejs.org](https://nodejs.org/) |
| **npm** | Đi kèm Node.js (v9+) | Tự động cài khi cài Node.js |
| **Git** | Bất kỳ | [git-scm.com](https://git-scm.com/) |
| **Code Editor** | Khuyến nghị VS Code | [code.visualstudio.com](https://code.visualstudio.com/) |

### Kiểm tra phiên bản đã cài

Mở Terminal (hoặc Command Prompt) và chạy:

```bash
node -v
# Kết quả mong đợi: v18.x.x hoặc v20.x.x

npm -v
# Kết quả mong đợi: 9.x.x hoặc cao hơn
```

> ⚠️ **Lưu ý:** Nếu lệnh `node -v` báo lỗi `command not found`, bạn cần cài Node.js trước (xem mục [Gỡ lỗi](#-6-gỡ-lỗi-thường-gặp-troubleshooting)).

---

## 📦 2. Cài đặt mã nguồn (Installation)

### Bước 2.1 — Clone dự án

```bash
git clone <URL_REPO_CUA_BAN>
```

### Bước 2.2 — Di chuyển vào thư mục dự án

```bash
cd <ten-thu-muc-du-an>
```

### Bước 2.3 — Cài đặt dependencies

```bash
npm install
```

> Lệnh này sẽ đọc file `package.json` và tải về tất cả thư viện cần thiết vào thư mục `node_modules/`. Quá trình có thể mất 1–3 phút tùy tốc độ mạng.

---

## 🔑 3. Thiết lập biến môi trường (Environment Variables) — **QUAN TRỌNG**

Dự án cần kết nối tới **Supabase** (dịch vụ cơ sở dữ liệu). Bạn phải tạo file chứa thông tin kết nối.

### Bước 3.1 — Tạo file `.env`

Tạo file tên **`.env`** ở **thư mục gốc** của dự án (cùng cấp với `package.json`):

```bash
# Trên macOS / Linux
touch .env

# Trên Windows (PowerShell)
New-Item .env
```

### Bước 3.2 — Thêm nội dung vào file `.env`

Mở file `.env` bằng VS Code hoặc bất kỳ trình soạn thảo nào, dán nội dung sau:

```env
VITE_SUPABASE_URL=your_project_url_here
VITE_SUPABASE_PUBLISHABLE_KEY=your_anon_key_here
```

### Bước 3.3 — Lấy giá trị từ Supabase Dashboard

1. Đăng nhập vào [supabase.com/dashboard](https://supabase.com/dashboard)
2. Chọn project của bạn
3. Vào **Project Settings** (biểu tượng ⚙️ ở sidebar trái)
4. Chọn tab **API**
5. Copy các giá trị:

| Biến môi trường | Lấy từ đâu |
|---|---|
| `VITE_SUPABASE_URL` | Mục **Project URL** |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Mục **Project API keys** → `anon` / `public` |

> ⚠️ **KHÔNG** sử dụng `service_role` key ở phía client. Key này chỉ dùng cho backend/edge functions.

> 💡 File `.env` đã được thêm vào `.gitignore` nên sẽ **không** bị đẩy lên Git.

---

## 🗄️ 4. Thiết lập cơ sở dữ liệu (Database Setup)

Dự án sử dụng các bảng trong Supabase. Bạn cần chạy các migration SQL để tạo schema.

### Bước 4.1 — Mở SQL Editor

1. Trong Supabase Dashboard, chọn **SQL Editor** ở sidebar trái
2. Bấm **New query**

### Bước 4.2 — Chạy migrations

Tìm các file SQL trong thư mục `supabase/migrations/` của dự án. Mở từng file theo **thứ tự thời gian** (tên file bắt đầu bằng timestamp) và copy nội dung vào SQL Editor, rồi bấm **Run**.

```
supabase/migrations/
├── 20250101000000_create_products.sql
├── 20250101000001_create_categories.sql
├── ...
```

> 💡 Chạy từng file một theo thứ tự để tránh lỗi foreign key.

### Bước 4.3 — Kiểm tra

Sau khi chạy xong, vào **Table Editor** trong Supabase Dashboard để xác nhận các bảng đã được tạo: `products`, `categories`, `customers`, `sales_orders`, `import_orders`, v.v.

---

## ▶️ 5. Khởi chạy dự án (Running the App)

### Bước 5.1 — Chạy development server

```bash
npm run dev
```

Kết quả mong đợi trên terminal:

```
  VITE v5.x.x  ready in xxx ms

  ➜  Local:   http://localhost:8080/
  ➜  Network: http://192.168.x.x:8080/
```

### Bước 5.2 — Mở trình duyệt

Truy cập địa chỉ hiển thị trên terminal (thường là):

👉 **http://localhost:8080**

> 💡 Nếu port `8080` đã bị chiếm, Vite sẽ tự chọn port khác (ví dụ `8081`). Hãy xem terminal để biết port chính xác.

### Bước 5.3 — Dừng server

Nhấn `Ctrl + C` trong terminal để tắt server.

---

## 🔧 6. Gỡ lỗi thường gặp (Troubleshooting)

### ❌ Lỗi: Màn hình trắng hoặc "Fetch Failed"

**Nguyên nhân:** File `.env` chưa được tạo, đặt sai tên, hoặc giá trị key không đúng.

**Cách khắc phục:**
1. Kiểm tra file `.env` nằm đúng ở thư mục gốc (cùng cấp `package.json`)
2. Tên file phải chính xác là `.env` (không phải `env`, `.env.txt`, hay `.env.example`)
3. Đảm bảo **không có dấu cách** trước hoặc sau dấu `=`
4. Kiểm tra URL và Key đã copy đúng từ Supabase Dashboard
5. **Khởi động lại** dev server sau khi sửa file `.env`:
   ```bash
   # Nhấn Ctrl+C để dừng, rồi chạy lại
   npm run dev
   ```

### ❌ Lỗi: `command not found: npm`

**Nguyên nhân:** Node.js chưa được cài đặt, hoặc chưa được thêm vào PATH.

**Cách khắc phục:**
1. Tải và cài Node.js LTS từ [nodejs.org](https://nodejs.org/)
2. **Đóng hoàn toàn** terminal/Command Prompt rồi mở lại
3. Chạy `node -v` để xác nhận

### ❌ Lỗi: `npm install` thất bại

**Cách khắc phục:**
```bash
# Xóa cache và thử lại
rm -rf node_modules package-lock.json
npm install
```

### ❌ Lỗi: Bảng không tồn tại / "relation does not exist"

**Nguyên nhân:** Chưa chạy migration SQL.

**Cách khắc phục:** Quay lại [Bước 4](#️-4-thiết-lập-cơ-sở-dữ-liệu-database-setup) và chạy tất cả file migration.

---

## 📁 Cấu trúc thư mục chính

```
├── public/              # File tĩnh (favicon, robots.txt)
├── src/
│   ├── components/      # React components (UI)
│   │   ├── ui/          # shadcn/ui components
│   │   ├── shared/      # Components dùng chung
│   │   └── sales/       # Components cho module bán hàng
│   ├── hooks/           # Custom React hooks
│   ├── integrations/    # Supabase client & types (tự động tạo)
│   ├── lib/             # Utility functions
│   ├── pages/           # Các trang chính (route)
│   ├── App.tsx          # Router chính
│   ├── main.tsx         # Entry point
│   └── index.css        # Global styles & design tokens
├── supabase/
│   ├── config.toml      # Cấu hình Supabase
│   └── migrations/      # SQL migration files
├── .env                 # Biến môi trường (TỰ TẠO, không có sẵn)
├── package.json         # Dependencies & scripts
├── tailwind.config.ts   # Cấu hình Tailwind CSS
└── vite.config.ts       # Cấu hình Vite
```

---

## 🛠️ Các lệnh hữu ích

| Lệnh | Mô tả |
|---|---|
| `npm run dev` | Chạy development server |
| `npm run build` | Build bản production |
| `npm run preview` | Xem bản build trước khi deploy |

---

## 🌐 7. Deploy lên Production

### Lựa chọn A — Deploy lên Vercel

#### Bước 7A.1 — Chuẩn bị

1. Tạo tài khoản tại [vercel.com](https://vercel.com/) (miễn phí)
2. Đẩy mã nguồn lên GitHub, GitLab hoặc Bitbucket

#### Bước 7A.2 — Import dự án

1. Đăng nhập Vercel → bấm **"Add New…"** → **"Project"**
2. Chọn repository chứa mã nguồn
3. Vercel sẽ tự nhận diện framework là **Vite**

#### Bước 7A.3 — Cấu hình Environment Variables

Trong màn hình cấu hình, thêm biến môi trường:

| Name | Value |
|---|---|
| `VITE_SUPABASE_URL` | *(URL Supabase của bạn)* |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | *(Anon key của bạn)* |

> ⚠️ **Bắt buộc** phải thêm biến môi trường trước khi deploy, nếu không app sẽ hiện màn hình trắng.

#### Bước 7A.4 — Cấu hình Build

Vercel thường tự nhận diện đúng, nhưng hãy kiểm tra:

| Cài đặt | Giá trị |
|---|---|
| **Framework Preset** | Vite |
| **Build Command** | `npm run build` |
| **Output Directory** | `dist` |
| **Install Command** | `npm install` |

#### Bước 7A.5 — Deploy

Bấm **"Deploy"** và đợi 1–2 phút. Sau khi hoàn tất, Vercel sẽ cung cấp URL dạng:

```
https://ten-du-an.vercel.app
```

#### Bước 7A.6 — Xử lý lỗi 404 khi refresh trang

Vì dự án dùng **React Router** (client-side routing), cần thêm file `vercel.json` ở thư mục gốc:

```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

> 💡 Không có file này, khi người dùng refresh trang ở `/products` hoặc `/sales` sẽ bị lỗi 404.

---

### Lựa chọn B — Deploy lên Netlify

#### Bước 7B.1 — Chuẩn bị

1. Tạo tài khoản tại [netlify.com](https://www.netlify.com/) (miễn phí)
2. Đẩy mã nguồn lên GitHub, GitLab hoặc Bitbucket

#### Bước 7B.2 — Import dự án

1. Đăng nhập Netlify → bấm **"Add new site"** → **"Import an existing project"**
2. Chọn Git provider và repository

#### Bước 7B.3 — Cấu hình Build

| Cài đặt | Giá trị |
|---|---|
| **Build Command** | `npm run build` |
| **Publish Directory** | `dist` |

#### Bước 7B.4 — Cấu hình Environment Variables

Vào **Site configuration** → **Environment variables** → **Add a variable**:

| Key | Value |
|---|---|
| `VITE_SUPABASE_URL` | *(URL Supabase của bạn)* |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | *(Anon key của bạn)* |

#### Bước 7B.5 — Xử lý lỗi 404 khi refresh trang

Tạo file `public/_redirects` trong dự án với nội dung:

```
/*    /index.html   200
```

> 💡 File này nằm trong `public/` để Vite tự copy vào `dist/` khi build.

#### Bước 7B.6 — Deploy

Bấm **"Deploy site"**. Sau khi hoàn tất, Netlify cung cấp URL dạng:

```
https://ten-du-an.netlify.app
```

---

### 📝 So sánh nhanh Vercel vs Netlify

| Tiêu chí | Vercel | Netlify |
|---|---|---|
| **Tốc độ build** | Nhanh | Nhanh |
| **Free tier** | 100 GB bandwidth/tháng | 100 GB bandwidth/tháng |
| **Custom domain** | ✅ Miễn phí | ✅ Miễn phí |
| **Auto deploy từ Git** | ✅ | ✅ |
| **Preview deployments** | ✅ Mỗi PR | ✅ Mỗi PR |
| **Redirect config** | `vercel.json` | `_redirects` file |

> 💡 Cả hai đều phù hợp cho dự án này. Chọn nền tảng bạn quen thuộc hơn.

---

### ⚡ Deploy nhanh bằng CLI (Nâng cao)

#### Vercel CLI

```bash
# Cài đặt
npm install -g vercel

# Deploy
vercel

# Deploy production
vercel --prod
```

#### Netlify CLI

```bash
# Cài đặt
npm install -g netlify-cli

# Build trước
npm run build

# Deploy preview
netlify deploy --dir=dist

# Deploy production
netlify deploy --dir=dist --prod
```

---

> 📬 Nếu gặp vấn đề không có trong danh sách trên, hãy tạo Issue trên repository hoặc liên hệ người quản lý dự án.
