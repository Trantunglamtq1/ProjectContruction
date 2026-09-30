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
├── src/
│   ├── ConstructionProject.Domain/         # Entities, Enums, Constants, Schemas (SOLID)
│   ├── ConstructionProject.Application/    # CQRS Commands, Queries, DTOs, Behaviors, Interfaces
│   ├── ConstructionProject.Infrastructure/ # EF Core DbContext, Configurations, Storage, JWT, BCrypt
│   └── ConstructionProject.API/            # Controllers, Middlewares, Program.cs
├── tests/
│   ├── test_auth_jwt.py                    # Script tự động test 10 kịch bản Auth & Role
│   ├── test_day2_api.py                    # Script test Upload bản vẽ & Tạo Object từ Marker
│   └── api-tests.http                      # File HTTP request cho REST Client / VS Code
├── CHECKLIST-TIEN-DO-23-NGAY.md            # Bảng theo dõi tiến độ chi tiết từng ngày
├── du-an-inspection-checklist.md           # Tài liệu đặc tả nghiệp vụ tổng thể 23 ngày
└── dac-ta-man-hinh.md                      # Đặc tả chi tiết giao diện màn hình
```

---

## 🚀 Hướng dẫn cài đặt & Khởi chạy

### 1. Yêu cầu môi trường
- [.NET 8.0 SDK](https://dotnet.microsoft.com/download/dotnet/8.0) trở lên
- Microsoft SQL Server / SQL Server Express (đang chạy service `MSSQL$SQLEXPRESS`)

### 2. Cập nhật Database
Chạy lệnh Migration để tự động tạo toàn bộ bảng và seed sẵn dữ liệu:
```bash
dotnet ef database update --project src/ConstructionProject.Infrastructure --startup-project src/ConstructionProject.API
```

> **Tài khoản Admin mặc định:**  
> - **Username:** `admin` (hoặc Email: `admin@construction.local`)  
> - **Password:** `Admin@123`  
> - **Role:** `Admin`

### 3. Chạy API Server
```bash
dotnet run --project src/ConstructionProject.API --urls "http://localhost:5092"
```

Truy cập Swagger UI trực tiếp trên trình duyệt:  
👉 **[http://localhost:5092/swagger](http://localhost:5092/swagger)**

### 4. Chạy kiểm thử tự động
```bash
python tests/test_auth_jwt.py
```
