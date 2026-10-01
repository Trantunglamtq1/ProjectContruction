# TÀI LIỆU THIẾT KẾ GIAO DIỆN & ĐẶC TẢ MÀN HÌNH HỆ THỐNG

**Dự án:** Quản lý Nghiệm thu Công trình (Inspection & Checklist System)
**Stack Frontend:** React, TypeScript, Ant Design (antd), FormIO, React Query, pdf.js, Axios Interceptors
**Stack Backend:** ASP.NET Core, CQRS (MediatR), EF Core, JWT Authentication, Elsa Workflow

> Tài liệu này đặc tả UI dựa trên "Tài liệu đặc tả nghiệp vụ & Kế hoạch thực hiện" (Phần 1 & Phần 2) — mọi hành động trên UI đều phải ánh xạ đúng 1 Command/Query đã định nghĩa ở đó. Phần nào chưa có Command tương ứng được đánh dấu **[CHƯA CÓ BACKEND]** và không đưa vào scope demo 23 ngày trừ khi có quyết định mở rộng.

---

## 1. HƯỚNG DẪN DESIGN SYSTEM & GLOBAL LAYOUT

### 1.1. Color Tokens (Ant Design ConfigProvider)

| Token | Giá trị | Dùng cho |
|---|---|---|
| Primary | `#1677FF` | Nút hành động, liên kết, marker đang active trên Viewport |
| Success | `#52C41A` | Trạng thái Approved, Done |
| Warning | `#FAAD14` | Trạng thái Submitted, UnderReview, InProgress |
| Error | `#FF4D4F` | Trạng thái Rejected, validate error |
| Neutral / Draft | `#8C8C8C` | Trạng thái Draft, Pending |
| Nền tảng | `#F5F7FA` | Background layout |

### 1.2. Master Layout Structure

- **Header:** Logo, Breadcrumbs, User Profile (`FullName`, Tag `Role`), nút Đăng xuất.
- **Sidebar (hiện menu theo Role lấy từ JWT claims):**
  - `Admin`: Quản lý người dùng (`/admin/users`)
  - `Submitter`: Bản vẽ (`/drawings`), Inspection (`/inspections`)
  - `Reviewer`: Bản vẽ (`/drawings`), Inspection (`/inspections`), Checklist (`/checklists`)
  - `Approver`: Bản vẽ (`/drawings`), Inspection (`/inspections`), Checklist — chỉ xem (`/checklists`)
  - `Role = null`: ẩn toàn bộ Sidebar, chỉ hiện màn hình chờ (Màn 03)

### 1.3. Xử lý phiên đăng nhập (Global — áp dụng toàn hệ thống)

- Axios response interceptor bắt mã lỗi `401`: xoá token khỏi bộ nhớ/localStorage, hiển thị `message.warning("Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại")`, điều hướng về `/auth/login`.
- Áp dụng cho **mọi** API call, không riêng 1 màn hình — đặt tại tầng HTTP client, không lặp lại logic ở từng component.

### 1.4. Loading / Error / Empty state (áp dụng cho mọi bảng và danh sách)

- **Loading:** `Skeleton` hoặc `Table loading={true}` của antd khi đang gọi Query.
- **Empty:** `Empty` component antd với thông báo phù hợp ngữ cảnh (vd: "Chưa có bản vẽ nào, hãy tải lên bản vẽ đầu tiên").
- **Error:** `Result status="error"` kèm nút `Thử lại` (re-trigger React Query).
- Đây là yêu cầu bắt buộc theo Giai đoạn buffer FE trong kế hoạch triển khai, không phải tuỳ chọn.

---

## 2. DANH SÁCH & ĐẶC TẢ CHI TIẾT 11 MÀN HÌNH

### MÀN HÌNH 01: ĐĂNG KÝ TÀI KHOẢN (REGISTER)

- **Route:** `/auth/register`
- **Actors:** Người dùng vãng lai / kỹ sư mới
- **Mục tiêu:** Tạo tài khoản mới với `RoleId = null` (chờ Admin gán quyền).
- **UI:** Card căn giữa; input `Username`, `Email`, `FullName`, `Password`, `ConfirmPassword`; nút `Đăng ký`; link `Đã có tài khoản? Đăng nhập`.
- **Logic:**
  - Validate client: email đúng định dạng, mật khẩu ≥ 6 ký tự, ConfirmPassword khớp Password.
  - Gọi `RegisterCommand`. Thành công → message + điều hướng `/auth/login`.
  - Lỗi trùng Username/Email: hiển thị lỗi ngay dưới field tương ứng (không phải toast chung chung).

---

### MÀN HÌNH 02: ĐĂNG NHẬP (LOGIN)

- **Route:** `/auth/login`
- **Actors:** Toàn bộ người dùng
- **Mục tiêu:** Xác thực và nhận JWT.
- **UI:** Card đăng nhập; input `Username`/`Password`; nút `Đăng nhập`; link `Chưa có tài khoản? Đăng ký ngay`.
- **Logic:**
  - Gọi `LoginCommand`, lưu JWT, interceptor tự gắn `Authorization: Bearer <token>` cho mọi request sau.
  - Giải mã claims để điều hướng:
    - `Role == null` → `/pending-approval`
    - `Role == 'Admin'` → `/admin/users`
    - `Role` nghiệp vụ (Submitter/Reviewer/Approver) → `/drawings`

---

### MÀN HÌNH 03: CHỜ GÁN QUYỀN (PENDING ROLE)

- **Route:** `/pending-approval`
- **Actors:** Tài khoản `RoleId = null`
- **UI:** `Result` (status="info"), nội dung: *"Tài khoản đang chờ Admin gán quyền. Vui lòng liên hệ quản trị viên."*; nút `Tải lại trang`, `Đăng xuất`.
- **Logic:** Route guard toàn cục — mọi URL khác khi Role = null đều redirect về đây.

---

### MÀN HÌNH 04: QUẢN TRỊ NGƯỜI DÙNG & GÁN QUYỀN (ADMIN)

- **Route:** `/admin/users`
- **Actors:** Chỉ `Admin`
- **UI:**
  - Filter: tìm theo tên/username, Select theo Role.
  - `Table`: `STT`, `Username`, `FullName`, `Email`, `Role hiện tại` (Tag màu, "Chưa gán" nếu null), `CreatedAt`, `Thao tác`.
  - Nút `Gán Role` (nếu Role null) hoặc `Đổi Role`; `Modal` chọn Role (Submitter/Reviewer/Approver) + xác nhận.
- **Logic:**
  - `GetUsersQuery` load danh sách; xác nhận Modal gọi `AssignRoleCommand(userId, roleId)`; invalidate cache sau khi thành công.
  - Không cho Admin tự đổi Role của chính tài khoản Admin đang đăng nhập (tránh tự khoá quyền của mình) — disable nút Đổi Role trên dòng của chính mình.

---

### MÀN HÌNH 05: DANH SÁCH & TẢI LÊN BẢN VẼ

- **Route:** `/drawings`
- **Actors:** `Submitter` (tải lên), `Reviewer`/`Approver` (chỉ xem)
- **UI:**
  - `Upload.Dragger` chỉ nhận `.pdf` — ẩn hoàn toàn với Reviewer/Approver, chỉ hiện với Submitter.
  - `Table`: `Tên file`, `Người tải`, `Ngày tải`, `Số Object đã tạo`, `Thao tác` (`Mở Viewport`).
- **Logic:**
  - Kéo thả PDF → `UploadDrawingFileCommand`.
  - Click `Mở Viewport` → điều hướng `/drawings/:drawingId/viewport`.

---

### MÀN HÌNH 06: VIEWPORT BẢN VẼ & KHOANH VÙNG TẠO OBJECT

- **Route:** `/drawings/:drawingId/viewport`
- **Actors:** `Submitter` (khoanh vùng), `Reviewer`/`Approver` (chỉ xem, không có nút khoanh vùng)
- **UI:**
  - **Sidebar trái (30%):** danh sách Object đã tạo trên bản vẽ (`List`); nút `+ Khoanh vùng Object mới` (chỉ Submitter).
  - **Canvas phải (70%):** thanh điều khiển (Prev/Next trang, Zoom In/Out, Reset View); khung pdf.js; overlay canvas để vẽ marker hình chữ nhật.
  - **Modal đặt tên Object:** hiển thị Trang số + toạ độ (x, y, width, height); input `Tên Object` (bắt buộc), `Mô tả thêm`.
- **Logic:**
  - Kéo chuột vẽ vùng chọn → nhả chuột mở Modal xác nhận.
  - `Lưu Object` → `CreateObjectFromMarkerCommand`.
  - Marker đã lưu tự render lại đúng vị trí khi mở lại trang tương ứng (dùng `GetObjectsQuery` theo `DrawingFileId` + `PageNumber`).

---

### MÀN HÌNH 07: DANH SÁCH FORM INSPECTION

- **Route:** `/inspections`
- **Actors:** `Submitter`, `Reviewer`, `Approver`
- **UI:**
  - Filter: Select `Trạng thái`, Select `Object`; nút `+ Tạo mới Inspection` (chỉ Submitter).
  - `Table`: `Mã số`, `Tên Object`, `Người tạo`, `Ngày tạo/nộp`, `Trạng thái` (Tag màu), `Thao tác`.
- **Logic:**
  - `GetInspectionsQuery` (phân trang, filter).
  - Click dòng → `/inspections/:id`.
  - Dòng ở trạng thái `Draft` hiện thêm `Sửa`/`Xóa`, chỉ hiện với đúng Submitter đã tạo dòng đó (so `CreatedBy` với `UserId` trong JWT).

---

### MÀN HÌNH 08: TẠO MỚI / CHỈNH SỬA FORM INSPECTION

- **Route:** `/inspections/create` hoặc `/inspections/:id/edit`
- **Actors:** Chỉ `Submitter`
- **Guard bắt buộc:** route `/edit` chỉ mở được khi Inspection có `Status = Draft` **và** `CreatedBy = UserId hiện tại`; nếu không thoả, redirect về `/inspections/:id` (trang chi tiết read-only).
- **UI:**
  - Header cố định: Select `Bản vẽ` → Select `Object` (cascading, bắt buộc chọn từ danh sách có sẵn, không cho nhập tay).
  - Vùng form động: container FormIO (`@formio/react`) render schema JSON.
  - Footer: `Hủy`, `Lưu bản nháp`, `Gửi duyệt (Submit)`.
- **Logic:**
  - `Lưu bản nháp` → `CreateInspectionCommand` (cho phép dữ liệu chưa đầy đủ, không validate chặt theo schema).
  - `Gửi duyệt` → validate đầy đủ theo schema FormIO ở client trước, sau đó gọi `SubmitInspectionCommand` → backend validate lại, khởi tạo Elsa Workflow instance nếu hợp lệ.

---

### MÀN HÌNH 09: CHI TIẾT ĐỢT KIỂM TRA & DUYỆT

- **Route:** `/inspections/:id`
- **Actors:** `Submitter` (xem), `Reviewer` (tiếp nhận), `Approver` (duyệt/từ chối)
- **UI:**
  - Hiển thị tiến trình trạng thái: dùng `Steps` cho nhánh chính Draft → Submitted → UnderReview, và khi đến bước cuối thay bằng `Result` (status="success" cho Approved, status="error" cho Rejected) thay vì cố nhét 2 nhánh rẽ vào 1 `Steps` tuyến tính.
  - Thẻ tóm tắt: Object liên kết, bản vẽ gốc, người nộp, thời gian nộp.
  - Vùng xem FormIO (read-only view).
  - **Khu vực hành động — điều kiện hiện nút phải kết hợp cả Role và Status hiện tại:**

    | Nút | Role yêu cầu | Status yêu cầu |
    |---|---|---|
    | Tiếp nhận hồ sơ (chuyển UnderReview) | Reviewer | Submitted |
    | Phê duyệt (Approve) | Approver | UnderReview |
    | Từ chối (Reject) | Approver | UnderReview |
    | Tạo lại / Resubmit | Submitter (chủ sở hữu) | Rejected |

  - **Modal Từ chối:** textarea `RejectReason` (bắt buộc).
- **Logic:**
  - `Tiếp nhận hồ sơ` → gọi API chuyển trạng thái Submitted → UnderReview qua Elsa.
  - `Approve` → gọi API phê duyệt → Elsa hoàn tất workflow → tự động chuyển các `ChecklistItem` liên kết sang `Done`.
  - `Reject` → bắt buộc `RejectReason`, chuyển `Rejected`.
  - `Tạo lại / Resubmit` (chỉ hiện khi Rejected) → tạo 1 Inspection mới ở trạng thái Draft, copy sẵn `ObjectId` và `FormDataJson` cũ để Submitter chỉnh sửa nhanh thay vì nhập lại từ đầu, sau đó theo đúng luồng Màn 08.
  - *Nút "Yêu cầu bổ sung" ở bản thiết kế trước đã được bỏ khỏi scope demo vì chưa có Command/State tương ứng ở Backend — nếu cần, phải bổ sung thành 1 hạng mục riêng trong kế hoạch (thêm state + Elsa activity mới), không tự thêm vào UI khi chưa có API.*

---

### MÀN HÌNH 10: DANH SÁCH CHECKLIST

- **Route:** `/checklists`
- **Actors:** `Reviewer` (tạo/quản lý), `Submitter`/`Approver` (chỉ xem)
- **UI:**
  - Filter: Select trạng thái (`Open`, `InProgress`, `Completed`); nút `+ Tạo mới Checklist` (chỉ Reviewer).
  - `Table`/`Card` danh sách: `Tên Checklist`, `Object liên kết`, `Trạng thái` (Tag màu), thanh `Progress` (% ChecklistItem bắt buộc đã Done).
  - Click vào 1 dòng → điều hướng `/checklists/:id` (Màn 11).
  - **Modal Tạo mới Checklist** (chỉ Reviewer): input `Tên Checklist`, `Mô tả`, Select `Object` (bắt buộc chọn Object có sẵn); nút `Tạo` → điều hướng thẳng sang Màn 11 để thêm ChecklistItem.
- **Logic:**
  - `GetChecklistsQuery` (phân trang, filter).
  - Tạo mới → `CreateChecklistCommand`.

---

### MÀN HÌNH 11: CHI TIẾT CHECKLIST & GẮN INSPECTION

- **Route:** `/checklists/:id`
- **Actors:** `Reviewer` (quản lý đầy đủ), `Submitter`/`Approver` (chỉ xem, không có nút thêm/gắn/đóng)
- **UI:**
  - Header: Tên, Mô tả, Object liên kết, Trạng thái Checklist.
  - `Table` ChecklistItem: `STT`, `Tên tiêu chí`, `Bắt buộc (IsRequired)`, `Inspection liên kết` (tên + trạng thái Tag), `Trạng thái mục (Pending/Done)`, `Thao tác` (`+ Thêm tiêu chí`, `Gắn Form Inspection` trên từng dòng — chỉ Reviewer).
  - **Modal gắn Inspection:** chọn 1 Form Inspection cùng `ObjectId` với Checklist, chưa được gắn vào item khác.
  - Nút `Đóng Checklist (Hoàn tất)` — disabled nếu còn ≥ 1 item bắt buộc chưa `Done`, kèm tooltip giải thích lý do disable.
- **Logic:**
  - `AddChecklistItemCommand` khi thêm tiêu chí mới.
  - Gắn Inspection → cập nhật `LinkedInspectionId` cho ChecklistItem.
  - Khi Inspection liên kết chuyển `Approved` (từ Màn 09), ChecklistItem tương ứng tự động chuyển `Done` — Table ở đây cần refetch/subscribe để phản ánh đúng theo thời gian thực (React Query invalidate khi quay lại trang, hoặc đơn giản hơn cho demo: nút refresh thủ công).
  - `Đóng Checklist` chỉ gọi được khi validate phía client khớp điều kiện, backend vẫn validate lại (theo business rule Phần 1).

---

## 3. Bảng đối chiếu Route ↔ Actor (tổng hợp)

| Route | Admin | Submitter | Reviewer | Approver | Role = null |
|---|---|---|---|---|---|
| /auth/register, /auth/login | ✓ | ✓ | ✓ | ✓ | ✓ |
| /pending-approval | – | – | – | – | ✓ (duy nhất) |
| /admin/users | ✓ (duy nhất) | – | – | – | – |
| /drawings | – | ✓ | ✓ (xem) | ✓ (xem) | – |
| /drawings/:id/viewport | – | ✓ | ✓ (xem) | ✓ (xem) | – |
| /inspections | – | ✓ | ✓ | ✓ | – |
| /inspections/create, /:id/edit | – | ✓ (duy nhất) | – | – | – |
| /inspections/:id | – | ✓ (xem+resubmit) | ✓ (tiếp nhận) | ✓ (duyệt) | – |
| /checklists | – | ✓ (xem) | ✓ | ✓ (xem) | – |
| /checklists/:id | – | ✓ (xem) | ✓ (quản lý) | ✓ (xem) | – |
