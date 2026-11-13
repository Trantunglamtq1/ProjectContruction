# 🏗️ Construction Drawing Inspection & Checklist System

Hệ thống quản lý hoạt động kiểm tra và nghiệm thu cấu kiện/hạng mục xây dựng gắn liền với bản vẽ thiết kế (PDF Viewport) theo quy trình nghiệp vụ thực tế.

## 🎯 Điểm mấu chốt của hệ thống
- **Nguồn gốc từ Bản vẽ (Drawing Origin):** Mọi cấu kiện (**Object**) không phải dữ liệu nhập tay tuỳ ý mà bắt buộc truy vết được về đúng bản vẽ PDF và vị trí khoanh vùng (**Marker Coordinates**) trên trang bản vẽ.
- **Biểu mẫu động (FormIO):** Form Inspection được cấu hình động qua JSON Schema, thay đổi tiêu chí kiểm tra không cần sửa code.
- **Quy trình phê duyệt inspection (Elsa Workflow):** `Draft` → `Submitted` → `UnderReview` → `Reviewed` → `Approved`, có từ chối và nộp lại.
- **Nghiệm thu liên kết (Checklist):** Tiêu chí Checklist gắn liền với từng Form Inspection; tự động đánh dấu `Done` khi Inspection được `Approved`.
- **Bảo mật & Phân quyền (JWT Auth):** Hệ thống phân quyền chặt chẽ theo 4 Actor:
  - 👑 **Admin**: Quản trị tài khoản, gán và chuyển đổi Role cho người dùng.
  - 👷 **Submitter** (Kỹ sư hiện trường): Upload bản vẽ, khoanh marker tạo Object, điền và nộp Form Inspection.
  - 🔍 **Reviewer** (Giám sát công trình): Xem xét Inspection, quản lý Checklist và theo dõi tiến độ.
  - ✍️ **Approver** (Quản lý dự án): Ra quyết định phê duyệt (Approve) hoặc từ chối (Reject).

---

## Độ tin cậy luồng inspection

Các thao tác nộp, thẩm tra, phê duyệt và từ chối ghi trạng thái nghiệp vụ, lịch sử, thay đổi checklist liên quan và lệnh đồng bộ trong cùng lần lưu SQL Server. API trả `202 Accepted` và `workflowSyncStatus: "Pending"` khi đã ghi nhận thao tác nhưng Elsa còn đang đồng bộ. Worker thử lại lệnh chưa hoàn tất; `Retrying` cho biết đồng bộ gặp lỗi, cần theo dõi và xử lý nguyên nhân. Chỉ tiếp tục bước duyệt tiếp theo khi trạng thái là `Synchronized`.

Elsa 3.2 dùng SQL Server để lưu workflow và bookmark. Worker dùng khóa SQL theo hồ sơ và kiểm tra trạng thái Elsa trước khi thử lại; không giả định giao dịch Elsa và giao dịch nghiệp vụ là một. Thông báo sau khi lưu là best effort, chưa có cam kết gửi lại nếu dịch vụ thông báo lỗi.

API trả `rowVersion` dạng base64; client phải gửi lại giá trị đã đọc khi sửa, nộp, tiếp nhận, thẩm tra, duyệt, từ chối hoặc xóa inspection. Dữ liệu cũ trả HTTP `409`; thiếu hoặc sai định dạng phiên bản bị từ chối. API client cần cập nhật cho hợp đồng này.

Danh sách `GET /api/inspections` nhận `pageNumber` và `pageSize`; vẫn nhận `page` cho client cũ, ưu tiên `pageNumber` nếu có cả hai. Response bổ sung `statusCounts` với đủ sáu khóa `Draft`, `Submitted`, `UnderReview`, `Reviewed`, `Approved`, `Rejected`. Số đếm và `totalCount` cùng áp dụng search và tất cả bộ lọc trên toàn bộ kết quả, trước phân trang; đổi trang không đổi phạm vi thống kê.

`search` hỗ trợ ID đầy đủ hoặc mã tám ký tự đầu đang hiển thị (ví dụ `#A1B2C3D4`), có/không `#`, không phân biệt hoa thường và bỏ khoảng trắng đầu/cuối. Mã ngắn có thể khớp nhiều hồ sơ; không coi mã ngắn là định danh duy nhất. Tìm theo tên cấu kiện, người nộp và bản vẽ tiếp tục được hỗ trợ.

Migration giữ trạng thái và lịch sử cũ, lưu ID workflow trước đây vào lệnh khôi phục và dựng bookmark phù hợp với cấp duyệt đã lưu. Không tự tạo quyết định duyệt mới. Migration khôi phục không hỗ trợ rollback tự động; cần sao lưu và kiểm tra kế hoạch khôi phục trước khi áp dụng. Thiết lập connection string qua cấu hình môi trường, không đưa mật khẩu vào mã nguồn.

Chạy test SQL Server riêng bằng cách đặt biến môi trường `CONSTRUCTION_TEST_SQL` thành connection string của **máy chủ thử nghiệm**, rồi chạy `dotnet test tests/ConstructionProject.IntegrationTests/ConstructionProject.IntegrationTests.csproj`. Các test SQL tạo database tên `ConstructionProject_Test_<guid>` và giữ lại để kiểm tra; không trỏ test vào máy chủ production. Nếu không đặt biến này, các test SQL được bỏ qua và không chứng minh hành vi migration, concurrency hay restart.

Checklist cũng dùng hàng đợi đồng bộ Elsa và trả `202 Accepted` khi đã ghi nhận nhưng chưa đồng bộ xong. API trả `rowVersion` cho checklist và từng tiêu chí; client gửi lại phiên bản khi thay đổi, bao gồm JSON body trong yêu cầu DELETE. Token cũ trả HTTP 409. Migration `AddChecklistItemsRevision` và `AddChecklistWorkflowOperations` giữ dữ liệu cũ và xếp khôi phục các checklist đang chờ; cần sao lưu và kiểm tra trạng thái hàng đợi khi áp dụng.

**Giới hạn:** phân quyền theo công trình và phiên bản bản vẽ chưa triển khai. Các hồ sơ thiếu người tạo cần được quản trị viên xử lý trước khi sửa hoặc nộp lại. Chưa có màn hình quản trị để xử lý lệnh đồng bộ bị lỗi kéo dài; thông báo chưa được bảo đảm gửi lại.

### Demo khoảng 5 phút

1. Đăng nhập Submitter, mở checklist đã được duyệt, tạo và nộp phiếu inspection.
2. Chờ trạng thái đồng bộ hoàn tất; đăng nhập Reviewer, tiếp nhận rồi thẩm tra, hoặc từ chối kèm lý do.
3. Nếu bị từ chối, đăng nhập lại Submitter để sửa và nộp lại; Reviewer tiếp nhận và thẩm tra lại.
4. Đăng nhập Approver để duyệt cấp cuối; xem lịch sử và trạng thái checklist.
5. Thử sửa một bản nháp đã thay đổi từ phiên khác để xem thông báo `409` và yêu cầu tải lại.

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

Dự án có 3 tầng kiểm thử. Unit tests và nhóm API dùng InMemory chạy không cần SQL Server; các test migration, rowversion và workflow bền vững cần SQL Server thực.

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

Để chạy cả các test SQL Server, đặt `CONSTRUCTION_TEST_SQL` thành chuỗi kết nối tới máy chủ thử nghiệm có quyền tạo database. Các test tạo database riêng mang tiền tố `ConstructionProject_Test_` và giữ lại sau khi chạy. Khi thiếu biến này, các test SQL bị bỏ qua; kết quả đó không chứng minh migration/concurrency/workflow đạt. Không dùng kết nối ứng dụng hoặc production. Trên Windows nếu test host không được ghi EventLog, đặt `Logging__EventLog__LogLevel__Default=None` cho tiến trình test.

#### Frontend — Unit tests (Vitest)

Kiểm thử logic thuần đã tách khỏi component: undo/redo history và tính toán kích thước nút bấm:

```bash
cd frontend
npm test              # chạy 1 lần
npm run test:watch    # watch mode
npm run test:coverage # kèm báo cáo coverage (v8)
```

#### Kết quả kiểm chứng ngày 12/11/2026 (bản tích hợp giai đoạn 1)

| Tầng | Công cụ | Số test | Trạng thái |
|------|---------|---------|------------|
| Backend Unit | xUnit + Moq + EF InMemory | **47** | ✅ Pass |
| Backend Integration | WebApplicationFactory + JWT + SQL Server | **45** | ✅ Pass, không bỏ qua |
| Frontend Unit | Vitest + v8 coverage | **16** | ✅ Pass |
| **Tổng** | | **108** | ✅ |

Backend build, frontend build/lint đạt; EF xác nhận model khớp migration. Playwright đã kiểm tra hai tab nhận 409, giữ nội dung chưa lưu và tải lại; thêm/xóa tiêu chí; nộp, restart, từ chối/sửa/nộp lại checklist; tạo nháp, nộp, từ chối/sửa/nộp lại inspection, tiếp nhận, duyệt hai cấp và checklist hoàn tất. Phiếu hoàn tất vẫn xem được ở chế độ chỉ đọc; nhật ký dùng `createdAt` UTC do API trả về. Kiểm tra hiển thị Pending/Retrying/NeedsRecovery dùng phản hồi GET giả lập; lỗi engine/retry thực được kiểm tra bằng SQL integration tests. Còn cảnh báo lint/Ant Design, bundle lớn và EF query filter; không phải test thất bại. Đây là kết quả cục bộ, chưa tích hợp vào develop hoặc triển khai.

#### CI/CD

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) tự động chạy khi push/PR:

- **Backend job:** .NET 8 → restore → build Release → unit tests → integration tests → upload coverage.
- **Frontend job:** Node 22 → `npm ci` → lint → type-check → unit tests + coverage → production build.

---

## Redis cache danh sách bản vẽ

Redis dùng cache-aside cho `GET /api/drawings?projectId=...`, gồm cả tìm kiếm và số lượng cấu kiện. Quyền dự án luôn được kiểm tra bằng SQL ở mỗi request. Không cache JWT, thành viên, quyền, file hay trạng thái Approval/Inspection. Danh sách không truyền `projectId` tiếp tục đọc SQL.

Chạy cùng stack hiện có:

```powershell
docker compose -p contruction_project up -d --build
docker exec construction_redis redis-cli ping
```

Compose bật Redis tại `redis:6379`, chỉ trong mạng Docker, giới hạn 128 MB và tự loại key cũ. Không cần Redis volume vì dữ liệu có thể tái tạo. SQL/MinIO dùng nguyên volume/bind mount hiện có. Host chạy .NET mặc định tắt cache; có thể đặt `Redis__Enabled=true`, `Redis__ConnectionString=<endpoint>`. Không công khai cổng Redis.

`Redis:DrawingListTtlSeconds` mặc định 60 (1–3600), `Redis:TimeoutMilliseconds` mặc định 500 (100–5000), `Redis:KeyPrefix` mặc định `construction:`; môi trường dùng chung Redis cần prefix riêng. Một connection multiplexer được tái sử dụng. Khi Redis lỗi hoặc payload hỏng, API đọc SQL và vẫn xử lý hủy request. Log Debug của `ConstructionProject.Infrastructure.Caching.RedisDrawingListCache` ghi hit/miss, không ghi payload hay chuỗi kết nối.

Migration `AddDrawingListCacheVersion` chỉ thêm cột Guid vào Projects. Phiên bản này đổi trong cùng giao dịch SQL khi bản vẽ/cấu kiện thay đổi; cache cũ không được dùng lại sau outage hay khi reader cũ hoàn tất muộn. Key gồm dự án, phiên bản và hash tìm kiếm; key cũ tự hết hạn. Thay đổi dữ liệu trực tiếp bằng SQL/bulk ngoài DbContext cần đổi phiên bản tương ứng hoặc tắt cache/chờ hết TTL.

Rollback chức năng: đặt `REDIS_ENABLED=false` trong `.env`, chạy `docker compose -p contruction_project up -d --no-deps backend`. Có thể giữ cột mới; không cần phục hồi database hoặc xóa volume.

Integration tests Redis thật dùng biến `CONSTRUCTION_TEST_REDIS`; mỗi test chỉ tạo/xóa key theo prefix riêng. CI cung cấp service Redis. Chạy host tests có thể tạm forward Redis qua cổng loopback bằng Compose override riêng. SQL tests dùng `CONSTRUCTION_TEST_SQL` trỏ master và tự tạo database test; không trỏ vào dữ liệu thật.

```powershell
$env:CONSTRUCTION_TEST_REDIS = '127.0.0.1:6380' # endpoint test đã cấu hình
dotnet test tests/ConstructionProject.IntegrationTests/ConstructionProject.IntegrationTests.csproj
```

## 🧪 Script kiểm thử API thủ công (tuỳ chọn)

Yêu cầu API đang chạy ở `http://localhost:5092`:

```bash
python tests/test_auth_jwt.py
```
