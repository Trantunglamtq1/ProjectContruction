# 🏗️ Construction Drawing Inspection & Checklist System

Hệ thống quản lý hoạt động kiểm tra và nghiệm thu cấu kiện/hạng mục xây dựng gắn liền với bản vẽ thiết kế (PDF Viewport) theo quy trình nghiệp vụ thực tế.

## 🎯 Điểm mấu chốt của hệ thống
- **Nguồn gốc từ Bản vẽ (Drawing Origin):** Mọi cấu kiện (**Object**) không phải dữ liệu nhập tay tuỳ ý mà bắt buộc truy vết được về đúng bản vẽ PDF và vị trí khoanh vùng (**Marker Coordinates**) trên trang bản vẽ.
- **Biểu mẫu động (FormIO):** Form Inspection được cấu hình động qua JSON Schema, thay đổi tiêu chí kiểm tra không cần sửa code.
- **Quy trình phê duyệt (Elsa Workflow):** Quản lý luồng duyệt trạng thái (`Draft` → `Submitted` → `UnderReview` → `Approved` / `Rejected`).
- **Nghiệm thu liên kết (Checklist):** Tiêu chí Checklist gắn liền với từng Form Inspection; tự động đánh dấu `Done` khi Inspection được `Approved`.
- **Bảo mật & Phân quyền (JWT Auth):** Hệ thống phân quyền chặt chẽ theo 4 Actor:
  - 👑 **Admin**: Quản trị tài khoản, gán và chuyển đổi Role cho người dùng.
  - 👷 **Submitter** (Kỹ sư hiện trường): Upload bản vẽ, khoanh marker tạo Object, điền và nộp Form Inspection.
  - 🔍 **Reviewer** (Giám sát công trình): Xem xét Inspection, quản lý Checklist và theo dõi tiến độ.
  - ✍️ **Approver** (Quản lý dự án): Ra quyết định phê duyệt (Approve) hoặc từ chối (Reject).

---

## 🛠️ Công nghệ sử dụng
- **Backend Architecture:** Clean Architecture (Domain, Application, Infrastructure, API).
- **Mô hình xử lý:** CQRS (Command Query Responsibility Segregation) với MediatR.
- **Cơ sở dữ liệu:** Microsoft SQL Server (Code-First với Entity Framework Core 8).
- **Validation:** FluentValidation pipeline behavior.
- **Xác thực:** JWT Bearer Token, mã hóa mật khẩu bằng BCrypt.Net.
- **Tài liệu API:** Swagger / OpenAPI có tích hợp Authorize Bearer Token.

---

## 📁 Cấu trúc thư mục

```
e:/Contruction_Project/
├── backend/
│   ├── ConstructionProject.Domain/         # Entities, Enums, Constants, Schemas (SOLID)
│   ├── ConstructionProject.Application/    # CQRS Commands, Queries, DTOs, Behaviors, Interfaces
│   ├── ConstructionProject.Infrastructure/ # EF Core DbContext, Configurations, Storage, JWT, BCrypt
│   └── ConstructionProject.API/            # Controllers, Middlewares, Program.cs
├── frontend/                               # React + TypeScript + Vite + Ant Design + FormIO
│   └── src/components/formio/              # Builder, renderer, layout & history logic (có unit test)
├── tests/
│   ├── ConstructionProject.UnitTests/      # xUnit + Moq + FluentAssertions + EF InMemory
│   ├── ConstructionProject.IntegrationTests/ # WebApplicationFactory + JWT + authorization matrix
│   ├── test_auth_jwt.py                    # Script tự động test 10 kịch bản Auth & Role
│   ├── test_day2_api.py                    # Script test Upload bản vẽ & Tạo Object từ Marker
│   └── api-tests.http                      # File HTTP request cho REST Client / VS Code
├── .github/workflows/ci.yml                # CI: build + test + coverage cho backend & frontend
└── test_sample_drawing.pdf                 # File PDF mẫu dùng cho test tự động
```

---

## 🚀 Hướng dẫn cài đặt & Khởi chạy

### 1. Yêu cầu môi trường
- [.NET 8.0 SDK](https://dotnet.microsoft.com/download/dotnet/8.0) trở lên
- Microsoft SQL Server / SQL Server Express (đang chạy service `MSSQL$SQLEXPRESS`)

### 2. Cập nhật Database
Chạy lệnh Migration để tự động tạo toàn bộ bảng và seed sẵn dữ liệu:
```bash
dotnet ef database update --project backend/ConstructionProject.Infrastructure --startup-project backend/ConstructionProject.API
```

> **Tài khoản Admin mặc định:**  
> - **Username:** `admin` (hoặc Email: `admin@construction.local`)  
> - **Password:** `Admin@123`  
> - **Role:** `Admin`

### 3. Chạy API Server
```bash
dotnet run --project backend/ConstructionProject.API --urls "http://localhost:5092"
```

Truy cập Swagger UI trực tiếp trên trình duyệt:  
👉 **[http://localhost:5092/swagger](http://localhost:5092/swagger)**

### 4. Chạy kiểm thử tự động

Dự án có 3 tầng kiểm thử, tất cả đều chạy được **offline, không cần Docker/SQL Server**:

#### Backend — Unit tests (xUnit + Moq + FluentAssertions + EF InMemory)

Kiểm thử toàn bộ vòng đời trạng thái Inspection (`Submit` → `Review` → `Approve`/`Reject`),
validator, password hashing và các nhánh lỗi nghiệp vụ:

```bash
dotnet test tests/ConstructionProject.UnitTests/ConstructionProject.UnitTests.csproj
```

#### Backend — Integration tests (WebApplicationFactory)

Dựng API thật (controllers, JWT, middleware, SignalR) với database in-memory và seed sẵn
4 tài khoản theo 4 role. Kiểm thử ma trận phân quyền `401 / 403 / 200` và các endpoint chính:

```bash
dotnet test tests/ConstructionProject.IntegrationTests/ConstructionProject.IntegrationTests.csproj
```

#### Frontend — Unit tests (Vitest)

Kiểm thử logic thuần đã tách khỏi component: undo/redo history và tính toán kích thước nút bấm:

```bash
cd frontend
npm test              # chạy 1 lần
npm run test:watch    # watch mode
npm run test:coverage # kèm báo cáo coverage (v8)
```

#### Kết quả hiện tại

| Tầng | Công cụ | Số test | Trạng thái |
|------|---------|---------|------------|
| Backend Unit | xUnit + Moq + EF InMemory | **31** | ✅ Pass |
| Backend Integration | WebApplicationFactory + JWT | **11** | ✅ Pass |
| Frontend Unit | Vitest + v8 coverage | **16** | ✅ Pass |
| **Tổng** | | **58** | ✅ |

#### CI/CD

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) tự động chạy khi push/PR:

- **Backend job:** .NET 8 → restore → build Release → unit tests → integration tests → upload coverage.
- **Frontend job:** Node 22 → `npm ci` → lint → type-check → unit tests + coverage → production build.

---

## 🧪 Script kiểm thử API thủ công (tuỳ chọn)

Yêu cầu API đang chạy ở `http://localhost:5092`:

```bash
python tests/test_auth_jwt.py
```
