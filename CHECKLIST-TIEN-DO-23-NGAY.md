# 📋 CHECKLIST TIẾN ĐỘ THỰC HIỆN DỰ ÁN (KẾ HOẠCH 23 NGÀY)
> **Tài liệu tham chiếu:** [du-an-inspection-checklist.md](file:///e:/Contruction_Project/du-an-inspection-checklist.md)  
> **Cập nhật lúc:** 29/09/2026  
> **Trạng thái tổng thể:** Hoàn thành toàn bộ **Backend Giai đoạn 0** (Auth & Admin) và **Backend Giai đoạn 1** (Bản vẽ & Object). Sẵn sàng bắt đầu Frontend hoặc tiếp nối Backend Giai đoạn 2.

---

## 📊 BẢNG TỔNG QUAN TIẾN ĐỘ 5 GIAI ĐOẠN

| Giai đoạn | Nội dung chính | Trạng thái Backend | Trạng thái Frontend |
| :--- | :--- | :---: | :---: |
| **GIAI ĐOẠN 0** (Ngày 1 - 5) | Authentication, JWT, Admin gán Role |  **100% Hoàn thành** | ⏳ Chưa làm (Ngày 3, 4, 5) |
| **GIAI ĐOẠN 1** (Ngày 6 - 9) | Bản vẽ PDF, Upload, Viewport, Object |  **100% Hoàn thành** | ⏳ Chưa làm (Ngày 8, 9) |
| **GIAI ĐOẠN 2** (Ngày 10 - 13) | CQRS Inspection/Checklist, Elsa Workflow | ⏳ Chưa làm (Đã có Entity & DB) | — |
| **GIAI ĐOẠN 3** (Ngày 14 - 18) | Giao diện Inspection, Checklist, Custom CSS | — | ⏳ Chưa làm |
| **GIAI ĐOẠN 4** (Ngày 19 - 23) | Tích hợp E2E, Kiểm thử toàn diện, Demo | ⏳ Chưa làm | ⏳ Chưa làm |

---

## 🔍 CHI TIẾT CHECKLIST TỪNG NGÀY

### 🔹 GIAI ĐOẠN 0: Authentication, JWT & Admin gán Role (Ngày 1 - 5)

#### Ngày 1: Backend: User, Role, Register, Login, JWT
- [x] Tạo entity `User.cs`, `Role.cs` độc lập theo chuẩn SOLID.
- [x] Tạo migration `AddAuthAndRoles` cập nhật vào SQL Server Express.
- [x] Seed sẵn 4 Role hệ thống: `Admin`, `Submitter`, `Reviewer`, `Approver`.
- [x] Seed sẵn tài khoản Admin mặc định: `admin` / `Admin@123`.
- [x] `RegisterCommand` + Handler + Validator (kiểm tra trùng username/email, băm mật khẩu bằng BCrypt, tài khoản mới có `RoleId = null`).
- [x] `LoginCommand` + Handler (xác thực mật khẩu, sinh JWT Access Token chứa claims: `sub`, `name`, `email`, `role`, `fullName`).
- [x] Cấu hình JWT Bearer Authentication cho Web API và Swagger UI (có nút Authorize).
- [x] **DoD:** Đăng ký thành công, đăng nhập nhận JWT, gọi API không kèm token bị chặn 401.

#### Ngày 2: Backend: Authorization theo Role & API quản lý User (Admin)
- [x] Áp dụng `[Authorize(Roles = "Admin")]` cho các API quản lý người dùng.
- [x] `GetUsersQuery`: Admin lấy danh sách toàn bộ User kèm Role hiện tại.
- [x] `GetRolesQuery`: Admin lấy danh sách 4 vai trò của hệ thống.
- [x] `AssignRoleCommand`: Admin gán hoặc thay đổi Role cho người dùng.
- [x] `GetCurrentUserQuery` (`/api/auth/me`): Lấy thông tin tài khoản đang đăng nhập.
- [x] Dịch vụ `CurrentUserService` trích xuất `UserId` và `Role` từ JWT claims tự động.
- [x] Thiết lập quan hệ FK chặt chẽ: `User (1) — (n) DrawingFile / Object / FormInspection / Checklist`.
- [x] Tạo file test tự động `tests/test_auth_jwt.py` và `tests/api-tests.http` (pass 100%).
- [x] **DoD:** Admin gán Role thành công, user thường không gọi được API Admin (bị chặn 403).

#### Ngày 3: Frontend: Đăng ký, Đăng nhập & gắn JWT
- [ ] Khởi tạo ứng dụng React + Vite + TypeScript.
- [ ] Xây dựng màn Đăng ký tài khoản (Form Ant Design) nối API `/api/auth/register`.
- [ ] Xây dựng màn Đăng nhập nối API `/api/auth/login`, lưu token vào state/localStorage.
- [ ] Cấu hình Axios Interceptor tự động đính kèm `Bearer token` vào mọi request.
- [ ] Xây dựng Route Guard (chuyển hướng về Login nếu chưa đăng nhập).
- [ ] Xử lý màn hình chờ "Tài khoản đang chờ Admin gán quyền" nếu `RoleId == null`.

#### Ngày 4: Frontend: Màn Quản lý người dùng (Admin)
- [ ] Xây dựng màn danh sách User (Ant Design Table): hiển thị Username, Email, FullName, Role.
- [ ] Chức năng modal/select gán và thay đổi Role cho từng User nối API `PUT /api/users/{id}/role`.
- [ ] Ẩn menu và chặn truy cập màn Quản lý người dùng nếu tài khoản không phải Role `Admin`.

#### Ngày 5: Buffer Authentication & Kiểm thử phân quyền Frontend
- [ ] Kiểm thử toàn bộ luồng Auth trên giao diện: Đăng ký mới → Admin gán Role → Kỹ sư đăng nhập lại.
- [ ] Rà soát xử lý lỗi token hết hạn (auto logout).

---

### 🔹 GIAI ĐOẠN 1: Bản vẽ, Upload, Viewport, Object (Ngày 6 - 9)

#### Ngày 6: Thiết kế domain tổng thể & Chuẩn bị nền tảng
- [x] Hoàn thiện ERD tổng thể gồm 7 bảng: `Roles`, `Users`, `DrawingFiles`, `Objects`, `FormInspections`, `Checklists`, `ChecklistItems`.
- [x] Cấu hình Fluent API độc lập cho từng thực thể (tránh lỗi Multiple Cascade Paths trong SQL Server).
- [x] Thiết kế 2 schema JSON FormIO chuẩn: `default-inspection-schema.json` và `default-checklist-item-schema.json`.
- [x] Định nghĩa các State Machine: `InspectionStatus` (`Draft` $\rightarrow$ `Submitted` $\rightarrow$ `UnderReview` $\rightarrow$ `Approved` / `Rejected`) và `ChecklistStatus`.

#### Ngày 7: Backend: Upload bản vẽ & Tạo Object từ marker
- [x] Entity `DrawingFile` và `ConstructionObject` độc lập, quan hệ 1-N.
- [x] `UploadDrawingFileCommand`: Validate chỉ nhận file PDF, lưu vào local storage, ghi nhận `UploadedById` từ JWT.
- [x] `CreateObjectFromMarkerCommand`: Bắt buộc gắn `DrawingFileId` hợp lệ, lưu tọa độ JSON (x, y, width, height), ghi nhận `CreatedById` từ JWT.
- [x] `GetDrawingFilesQuery` & `GetDrawingFileByIdQuery`: Lấy danh sách và chi tiết bản vẽ kèm danh sách Object.
- [x] `GetObjectsQuery` & `GetObjectByIdQuery`: Lấy danh sách Object có filter theo `DrawingFileId`.
- [x] Endpoint stream file PDF `/api/drawings/files/{fileName}` phục vụ Viewport.
- [x] Kiểm thử tự động `tests/test_day2_api.py` (pass 100%).

#### Ngày 8: Frontend: Màn Upload & Viewport xem bản vẽ
- [ ] Màn hình danh sách bản vẽ kèm nút Upload file PDF (dùng `antd Upload`).
- [ ] Tích hợp thư viện `pdf.js` hiển thị Viewport bản vẽ PDF trên web.
- [ ] Điều khiển chuyển trang (Next / Previous), Zoom in / Zoom out bản vẽ.

#### Ngày 9: Frontend: Khoanh vùng tạo Object trên Viewport
- [ ] Dựng lớp overlay Canvas trên Viewport cho phép người dùng kéo chuột khoanh vùng hình chữ nhật (Marker).
- [ ] Modal nhập tên Object sau khi khoanh vùng (gọi API `POST /api/objects`).
- [ ] Vẽ lại toàn bộ các Marker Object đã lưu trên trang bản vẽ để người dùng click xem/chọn.

---

### 🔹 GIAI ĐOẠN 2: Backend: CQRS Inspection/Checklist, Elsa Workflow (Ngày 10 - 13)

#### Ngày 10: CQRS Form Inspection: Create / Submit / Query
- [x] Đã tạo sẵn Entity `FormInspection.cs` và cấu hình DbContext.
- [ ] `CreateInspectionCommand`: Khởi tạo bản ghi Draft, bắt buộc chọn `ObjectId` có sẵn, chỉ Role `Submitter`.
- [ ] `SubmitInspectionCommand`: Validate `FormDataJson` theo schema FormIO, chuyển trạng thái sang `Submitted`.
- [ ] `GetInspectionsQuery`: Lọc theo Object/Status, phân trang.
- [ ] Viết Stored Procedure `sp_GetInspectionList` theo yêu cầu tối ưu query danh sách.

#### Ngày 11: Tích hợp Elsa Workflow cho Inspection
- [ ] Cài đặt gói NuGet Elsa Workflow Server + Dashboard.
- [ ] Thiết kế Workflow Definition `InspectionApprovalWorkflow`: `Start` $\rightarrow$ `WaitForSubmit` $\rightarrow$ `NotifyReviewer` $\rightarrow$ `Decision` $\rightarrow$ `SetStatus` $\rightarrow$ `End`.
- [ ] Trigger workflow instance khi `SubmitInspectionCommand` thành công.
- [ ] Đồng bộ hai chiều trạng thái từ Elsa Workflow vào trường `Status` của entity `FormInspection`.

#### Ngày 12: CQRS Checklist & Business Rule
- [x] Đã tạo sẵn Entity `Checklist.cs` và `ChecklistItem.cs` trong Database.
- [ ] `CreateChecklistCommand`: Tạo Checklist cho Object (chỉ Role `Reviewer`).
- [ ] `AddChecklistItemCommand`: Thêm tiêu chí và liên kết tới `FormInspection`.
- [ ] `GetChecklistsQuery`: Lấy danh sách Checklist kèm trạng thái Inspection liên kết.
- [ ] Enforce Business Rule: Checklist chỉ tự động chuyển `Completed` khi tất cả các item bắt buộc (`IsRequired = true`) đã `Done`.

#### Ngày 13: Buffer Backend, Unit Test & Review
- [ ] Viết Unit Test cho MediatR Handlers và FluentValidation Validators.
- [ ] Rà soát Clean Code và tối ưu hiệu năng các câu truy vấn.

---

### 🔹 GIAI ĐOẠN 3: Frontend: Inspection, Checklist, Custom CSS (Ngày 14 - 18)

#### Ngày 14: Frontend: Màn danh sách Inspection & Chọn Object
- [ ] Màn danh sách Inspection (Ant Design Table + Filter Status + Pagination).
- [ ] Màn tạo Inspection: Bắt buộc chọn Object đã tạo từ bản vẽ (chỉ hiển thị cho Role `Submitter`).

#### Ngày 15: Custom CSS theo Design System
- [ ] Cấu hình Ant Design `ConfigProvider` (màu chủ đạo, border-radius, typography).
- [ ] Viết CSS Modules cho Table, Filter bar, Badge trạng thái (không dùng `!important`).

#### Ngày 16: Form Inspection: Submit qua FormIO & Xem chi tiết
- [ ] Tích hợp `@formio/react` render form kiểm tra động theo schema JSON.
- [ ] Màn xem chi tiết form đã nộp kèm các nút duyệt `Approve` / `Reject` (chỉ hiển thị cho `Reviewer` / `Approver`).
- [ ] Tự động cập nhật danh sách sau khi submit (React Query invalidation).

#### Ngày 17: Màn hình Checklist
- [ ] Màn danh sách Checklist theo từng Object.
- [ ] Giao diện thêm mới Checklist và chọn liên kết `FormInspection` cho từng tiêu chí.
- [ ] Hiển thị trực quan tiến độ hoàn thành Checklist.

#### Ngày 18: Buffer Frontend toàn bộ các khối
- [ ] Xử lý Loading Skeleton, Empty State, Error Alert cho toàn bộ các màn hình.
- [ ] Đồng bộ hóa UI/UX giữa các màn hình: Auth, Admin, Viewport, Inspection, Checklist.

---

### 🔹 GIAI ĐOẠN 4: Tích hợp, Kiểm thử, Hoàn thiện demo (Ngày 19 - 23)

#### Ngày 19: Tích hợp End-to-End toàn bộ luồng
- [ ] Kiểm tra luồng thực tế: Đăng ký $\rightarrow$ Admin gán Role $\rightarrow$ Kỹ sư upload bản vẽ $\rightarrow$ Khoanh Object $\rightarrow$ Tạo Inspection $\rightarrow$ Nộp form $\rightarrow$ Duyệt $\rightarrow$ Checklist cập nhật `Done`.

#### Ngày 20: Kiểm thử toàn diện & Lập Bug List
- [ ] Test kịch bản ngoại lệ: Token hết hạn, tài khoản chưa có Role, Reject rồi nộp lại, Checklist có nhiều tiêu chí.

#### Ngày 21: Buffer sửa lỗi & Review Code
- [ ] Sửa dứt điểm các lỗi Blocker / Major.
- [ ] Rà soát bảo mật JWT và toàn vẹn dữ liệu.

#### Ngày 22: Tài liệu kỹ thuật & Kịch bản Demo
- [ ] Viết tài liệu kỹ thuật ngắn gọn (1-2 trang): Kiến trúc, lý do chọn công nghệ, các trade-offs.
- [ ] Soạn kịch bản Demo chi tiết từng bước cho 4 tài khoản (`Admin`, `Submitter`, `Reviewer`, `Approver`).

#### Ngày 23: Demo thử & Đóng gói hoàn thiện
- [ ] Chạy thử nghiệm toàn bộ kịch bản demo.
- [ ] Hoàn thiện file `README.md` hướng dẫn chạy dự án local. Sẵn sàng trình bày chính thức.
