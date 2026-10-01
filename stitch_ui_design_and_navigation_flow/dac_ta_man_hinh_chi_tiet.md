# TÀI LIỆU THIẾT KẾ GIAO DIỆN & ĐẶC TẢ MÀN HÌNH HỆ THỐNG (CHI TIẾT)

**Dự án:** Quản lý Nghiệm thu Công trình (Inspection & Checklist System)
**Stack Frontend:** React, TypeScript, Ant Design (antd), FormIO, React Query, pdf.js, Axios Interceptors
**Stack Backend:** ASP.NET Core, CQRS (MediatR), EF Core, JWT Authentication, Elsa Workflow

> Mọi hành động trên UI đều ánh xạ đúng 1 Command/Query đã định nghĩa trong tài liệu đặc tả nghiệp vụ. Bản này bổ sung chi tiết: từng thành phần giao diện, từng nút bấm (label, loại, màu sắc), và quy tắc màu theo trạng thái.

---

## 0. QUY ƯỚC MÀU SẮC & NÚT BẤM DÙNG CHUNG TOÀN HỆ THỐNG

### 0.1. Bảng màu (Color Tokens)

| Token | Mã màu | Dùng cho |
|---|---|---|
| Primary | `#1677FF` | Nút hành động chính, link, marker active trên Viewport |
| Primary Hover | `#4096FF` | Hover state của nút Primary |
| Success | `#52C41A` | Trạng thái Approved/Done, nút Phê duyệt |
| Success Hover | `#73D13D` | Hover của nút Phê duyệt |
| Warning | `#FAAD14` | Trạng thái Submitted/UnderReview/InProgress |
| Error / Danger | `#FF4D4F` | Trạng thái Rejected, nút Từ chối/Xóa, validate error |
| Error Hover | `#FF7875` | Hover của nút danger |
| Neutral / Draft | `#8C8C8C` | Trạng thái Draft, Pending, text phụ |
| Border mặc định | `#D9D9D9` | Viền nút Default, viền input |
| Nền trang | `#F5F7FA` | Background layout tổng thể |
| Nền Card/Table | `#FFFFFF` | Nền các khối nội dung |
| Text chính | `#262626` | Chữ nội dung chính |
| Text phụ | `#8C8C8C` | Placeholder, mô tả phụ, timestamp |

### 0.2. Quy ước loại nút (áp dụng cho MỌI màn hình bên dưới)

| Loại nút | antd Component | Nền | Chữ | Viền | Dùng cho |
|---|---|---|---|---|---|
| **Primary (xanh dương)** | `<Button type="primary">` | `#1677FF` (hover `#4096FF`) | `#FFFFFF` | không viền | Hành động chính: Đăng nhập, Đăng ký, Lưu bản nháp, Gửi duyệt, Tạo mới, Xác nhận, Tiếp nhận hồ sơ, Lưu Object |
| **Success (xanh lá)** | `<Button type="primary" style={{background:'#52C41A'}}>` | `#52C41A` (hover `#73D13D`) | `#FFFFFF` | không viền | Duy nhất cho hành động: Phê duyệt (Approve) |
| **Danger (đỏ)** | `<Button danger type="primary">` | `#FF4D4F` (hover `#FF7875`) | `#FFFFFF` | không viền | Từ chối (Reject), Xóa |
| **Default (viền xám)** | `<Button>` | `#FFFFFF` | `#262626` | `1px solid #D9D9D9` | Hủy, Quay lại, Tải lại trang, Đóng Modal |
| **Text/Link** | `<Button type="link">` | trong suốt | `#1677FF` | không viền, không nền | Điều hướng phụ: "Đăng ký ngay", "Đăng nhập", "Xem chi tiết" |
| **Đăng xuất** | `<Button type="text">` | trong suốt | `#8C8C8C` (hover chữ đỏ `#FF4D4F`) | không viền | Riêng cho nút Đăng xuất ở Header |

### 0.3. Quy ước màu Tag trạng thái

| Trạng thái | antd Tag color | Mã màu nền Tag |
|---|---|---|
| Draft | `default` | `#F5F5F5` nền, `#8C8C8C` chữ |
| Submitted | `gold` | `#FFF7E6` nền, `#FAAD14` chữ |
| UnderReview | `gold` | `#FFF7E6` nền, `#FAAD14` chữ |
| Open / InProgress | `gold` | `#FFF7E6` nền, `#FAAD14` chữ |
| Approved / Done / Completed | `green` | `#F6FFED` nền, `#52C41A` chữ |
| Rejected | `red` | `#FFF1F0` nền, `#FF4D4F` chữ |
| Chưa gán (Role = null) | `default` | `#F5F5F5` nền, `#8C8C8C` chữ, viền nét đứt |

### 0.4. Layout khung tổng (Master Layout — áp dụng mọi trang sau đăng nhập)

| Vùng | Thành phần | Chi tiết |
|---|---|---|
| Header (cao 64px, nền `#FFFFFF`, border-bottom `#F0F0F0`) | Logo | Góc trái, kích thước 32x32px |
| | Breadcrumb | Cạnh logo, chữ `#8C8C8C`, mục hiện tại `#262626` |
| | User info | Góc phải: `Avatar` (antd, 32px) + `FullName` (chữ `#262626`, 14px) + `Tag` Role (màu theo bảng dưới) |
| | Nút Đăng xuất | Icon `LogoutOutlined` + text "Đăng xuất", loại **Text/Link** (mục 0.2) |
| Sidebar (rộng 220px, nền `#FFFFFF`) | `Menu` antd, item active nền `#E6F4FF` chữ `#1677FF`, item thường chữ `#262626` | Danh sách menu theo Role (xem mục 0.5) |
| Content (nền `#F5F7FA`, padding 24px) | Nơi render từng màn hình | — |

Màu Tag Role ở Header: `Admin` = `purple` (`#F9F0FF` nền, `#722ED1` chữ); `Submitter` = `blue` (`#E6F4FF` nền, `#1677FF` chữ); `Reviewer` = `cyan` (`#E6FFFB` nền, `#13C2C2` chữ); `Approver` = `orange` (`#FFF7E6` nền, `#FA8C16` chữ).

### 0.5. Sidebar menu theo Role

| Role | Menu item hiển thị |
|---|---|
| Admin | Quản lý người dùng |
| Submitter | Bản vẽ, Inspection |
| Reviewer | Bản vẽ, Inspection, Checklist |
| Approver | Bản vẽ, Inspection, Checklist |
| Role = null | (Sidebar ẩn hoàn toàn) |

### 0.6. Xử lý phiên đăng nhập & trạng thái tải dữ liệu (Global)

- **401 (hết hạn JWT):** interceptor xoá token, `message.warning` nền vàng nhạt "Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại", điều hướng `/auth/login`.
- **Loading:** `Skeleton` (khi tải lần đầu) hoặc `Table loading` (khi tải lại danh sách).
- **Empty:** `Empty` antd, icon mặc định màu `#D9D9D9`, dòng chữ mô tả `#8C8C8C`.
- **Error:** `Result status="error"` màu icon `#FF4D4F`, kèm nút Default "Thử lại".

---

## 1. MÀN HÌNH ĐĂNG KÝ TÀI KHOẢN (REGISTER)

**Route:** `/auth/register` | **Actor:** Người dùng vãng lai

### Bố cục
`Card` rộng 420px, căn giữa màn hình theo chiều dọc và ngang, nền `#FFFFFF`, bo góc 8px, shadow nhẹ.

### Thành phần chi tiết

| # | Thành phần | Component antd | Label / Placeholder | Màu sắc | Validate |
|---|---|---|---|---|---|
| 1 | Tiêu đề | `Typography.Title level={3}` | "Đăng ký tài khoản" | Chữ `#262626` | — |
| 2 | Input Username | `Input` | Placeholder "Nhập tên đăng nhập" | Viền `#D9D9D9`, focus viền `#1677FF` | Bắt buộc, không trùng (check ở BE) |
| 3 | Input Email | `Input` | Placeholder "Nhập email" | như trên | Bắt buộc, đúng định dạng email |
| 4 | Input Họ tên | `Input` | Placeholder "Nhập họ và tên" | như trên | Bắt buộc |
| 5 | Input Mật khẩu | `Input.Password` | Placeholder "Nhập mật khẩu" | như trên | Bắt buộc, ≥ 6 ký tự |
| 6 | Input Xác nhận mật khẩu | `Input.Password` | Placeholder "Nhập lại mật khẩu" | như trên | Phải khớp mục 5 |
| 7 | **Nút Đăng ký** | `Button type="primary"` full-width | "Đăng ký" | Nền `#1677FF`, chữ trắng (loại **Primary**) | Disable khi form chưa hợp lệ |
| 8 | Link phụ | `Button type="link"` | "Đã có tài khoản? Đăng nhập" | Chữ `#1677FF` (loại **Text/Link**) | Điều hướng `/auth/login` |

### Logic
- Validate client theo bảng trên → gọi `RegisterCommand` → thành công: `message.success` nền xanh lá nhạt "Đăng ký thành công, vui lòng đăng nhập" → điều hướng `/auth/login`.
- Lỗi trùng Username/Email: hiển thị `Form.Item help` màu đỏ `#FF4D4F` ngay dưới field tương ứng, không dùng toast chung.

---

## 2. MÀN HÌNH ĐĂNG NHẬP (LOGIN)

**Route:** `/auth/login` | **Actor:** Toàn bộ người dùng

> **Xác nhận quan trọng:** màn hình này **chỉ có 2 trường nhập là Tài khoản (Username) và Mật khẩu (Password)** — người dùng **không** chọn Role ở đây. Role được xác định hoàn toàn từ dữ liệu server trả về (JWT claims) sau khi đăng nhập thành công, không có bất kỳ Select/Radio nào cho Role trên form này.

### Bố cục
`Card` rộng 400px, căn giữa màn hình, nền `#FFFFFF`, bo góc 8px.

### Thành phần chi tiết

| # | Thành phần | Component antd | Label / Placeholder | Màu sắc | Ghi chú |
|---|---|---|---|---|---|
| 1 | Tiêu đề | `Typography.Title level={3}` | "Đăng nhập" | Chữ `#262626` | — |
| 2 | Input Tài khoản | `Input` (prefix icon `UserOutlined`) | Placeholder "Tài khoản" | Viền `#D9D9D9`, focus `#1677FF` | Chỉ nhập Username, KHÔNG có field Role |
| 3 | Input Mật khẩu | `Input.Password` (prefix icon `LockOutlined`) | Placeholder "Mật khẩu" | như trên | — |
| 4 | Checkbox | `Checkbox` | "Ghi nhớ đăng nhập" | Chữ `#262626`, tick `#1677FF` | Tuỳ chọn |
| 5 | **Nút Đăng nhập** | `Button type="primary"` full-width | "Đăng nhập" | Nền `#1677FF` (loại **Primary**) | — |
| 6 | Link phụ | `Button type="link"` | "Chưa có tài khoản? Đăng ký ngay" | Chữ `#1677FF` | Điều hướng `/auth/register` |
| 7 | Thông báo lỗi (nếu có) | `Alert type="error"` | "Sai tài khoản hoặc mật khẩu" | Nền `#FFF1F0`, chữ `#FF4D4F` | Hiện phía trên form khi login thất bại |

### Logic
- Gọi `LoginCommand(username, password)` — không gửi kèm Role vì người dùng không nhập.
- Server trả JWT chứa claims `UserId` + `Role` (do Admin đã gán từ trước, hoặc `null` nếu chưa được gán).
- FE giải mã JWT để điều hướng, **không tự suy luận hay cho người dùng chọn Role trên client**:
  - `Role == null` → `/pending-approval`
  - `Role == "Admin"` → `/admin/users`
  - `Role` là Submitter/Reviewer/Approver → `/drawings`

---

## 3. MÀN HÌNH CHỜ GÁN QUYỀN (PENDING ROLE)

**Route:** `/pending-approval` | **Actor:** Tài khoản `Role = null`

### Thành phần chi tiết

| # | Thành phần | Component | Nội dung | Màu sắc |
|---|---|---|---|---|
| 1 | Icon trạng thái | `Result icon` | Đồng hồ cát / `ClockCircleOutlined` | `#FAAD14` |
| 2 | Tiêu đề | `Result title` | "Tài khoản đang chờ phê duyệt" | `#262626` |
| 3 | Mô tả | `Result subTitle` | "Tài khoản đang chờ Admin gán quyền. Vui lòng liên hệ quản trị viên." | `#8C8C8C` |
| 4 | Nút 1 | `Button` (Default) | "Tải lại trang" | Viền `#D9D9D9`, chữ `#262626` |
| 5 | Nút 2 | `Button type="text"` | "Đăng xuất" | Chữ `#8C8C8C`, hover đỏ `#FF4D4F` |

### Logic
- Route guard toàn cục: mọi URL khác khi `Role == null` đều redirect về đây.
- "Tải lại trang" gọi lại API lấy thông tin User hiện tại (hoặc F5), nếu đã có Role thì tự điều hướng đi tiếp.

---

## 4. MÀN HÌNH QUẢN TRỊ NGƯỜI DÙNG (ADMIN)

**Route:** `/admin/users` | **Actor:** Chỉ `Admin`

### Thành phần chi tiết

| # | Thành phần | Component | Nội dung | Màu sắc |
|---|---|---|---|---|
| 1 | Ô tìm kiếm | `Input.Search` | Placeholder "Tìm theo tên/username" | Viền `#D9D9D9` |
| 2 | Select lọc Role | `Select` | Options: Tất cả / Admin / Submitter / Reviewer / Approver / Chưa gán | — |
| 3 | Bảng danh sách | `Table` | Cột: STT, Username, FullName, Email, Role hiện tại (`Tag`), CreatedAt, Thao tác | Nền `#FFFFFF`, header `#FAFAFA` |
| 4 | Tag Role trong bảng | `Tag` | Theo màu Role ở mục 0.4; "Chưa gán" dùng Tag màu `#F5F5F5`/`#8C8C8C` viền nét đứt | — |
| 5 | Nút trên mỗi dòng | `Button type="link"` | "Gán Role" (nếu Role null) hoặc "Đổi Role" (nếu đã có) | Chữ `#1677FF` (loại Text/Link) |
| 6 | Nút trên dòng chính Admin đang đăng nhập | `Button type="link" disabled` | "Đổi Role" bị vô hiệu hoá | Chữ xám `#D9D9D9`, kèm `Tooltip` "Không thể tự đổi Role của chính mình" |
| 7 | Modal Gán quyền | `Modal` | Tiêu đề "Gán Role cho {FullName}" | — |
| 8 | Select trong Modal | `Select` | Options: Submitter / Reviewer / Approver | — |
| 9 | Nút Xác nhận (Modal) | `Button type="primary"` | "Xác nhận" | Nền `#1677FF` (loại Primary) |
| 10 | Nút Hủy (Modal) | `Button` | "Hủy" | Viền `#D9D9D9` (loại Default) |

### Logic
- `GetUsersQuery` load danh sách theo filter; chọn Role trong Modal → `AssignRoleCommand(userId, roleId)` → `message.success` "Gán quyền thành công" nền xanh lá nhạt → React Query invalidate danh sách.

---

## 5. MÀN HÌNH DANH SÁCH & TẢI LÊN BẢN VẼ

**Route:** `/drawings` | **Actor:** `Submitter` (tải lên), `Reviewer`/`Approver` (chỉ xem)

### Thành phần chi tiết

| # | Thành phần | Component | Nội dung | Màu sắc | Điều kiện hiện |
|---|---|---|---|---|---|
| 1 | Khung tải file | `Upload.Dragger` | Icon `InboxOutlined` màu `#1677FF`, text "Kéo thả file PDF vào đây hoặc bấm để chọn file" | Viền nét đứt `#D9D9D9`, nền `#FAFAFA`, hover viền `#1677FF` | Chỉ Submitter |
| 2 | Bảng danh sách | `Table` | Cột: Tên file, Người tải, Ngày tải, Số Object đã tạo, Thao tác | Nền trắng | Tất cả |
| 3 | Nút trên mỗi dòng | `Button type="link"` | "Mở Viewport" | Chữ `#1677FF` | Tất cả |

### Logic
- Kéo thả PDF → `UploadDrawingFileCommand`; validate chỉ nhận đuôi `.pdf`, nếu sai định dạng hiện `message.error` "Chỉ chấp nhận file PDF" nền đỏ nhạt.
- Click "Mở Viewport" → điều hướng `/drawings/:drawingId/viewport`.

---

## 6. MÀN HÌNH VIEWPORT & KHOANH VÙNG TẠO OBJECT

**Route:** `/drawings/:drawingId/viewport` | **Actor:** `Submitter` (khoanh vùng), `Reviewer`/`Approver` (chỉ xem)

### Bố cục
Chia 2 cột: Sidebar trái 30% (nền `#FFFFFF`), Canvas phải 70% (nền `#262626` tối để làm nổi bản vẽ trắng).

### Thành phần chi tiết

| # | Thành phần | Component | Nội dung | Màu sắc | Điều kiện hiện |
|---|---|---|---|---|---|
| 1 | Danh sách Object (sidebar) | `List` | Mỗi item: Tên Object + số trang | Item hover nền `#F5F7FA` | Tất cả |
| 2 | Nút khoanh vùng mới | `Button type="primary"` | "+ Khoanh vùng Object mới" | Nền `#1677FF` (Primary) | Chỉ Submitter |
| 3 | Thanh điều khiển trang | `Button` nhóm icon | `LeftOutlined`/`RightOutlined` (Prev/Next), số trang hiện tại dạng text `#FFFFFF` | Nút Default nền trong suốt viền trắng mờ | Tất cả |
| 4 | Nút Zoom | `Button` icon | `ZoomInOutlined`, `ZoomOutOutlined` | như trên | Tất cả |
| 5 | Nút Reset View | `Button` | "Reset View" | Default, viền trắng mờ | Tất cả |
| 6 | Khung render PDF | `<canvas>` (pdf.js) | — | Nền trắng | Tất cả |
| 7 | Overlay marker đã lưu | `<div>` tuyệt đối, viền 2px | Viền `#1677FF`, nền `rgba(22,119,255,0.1)` | Marker đang chọn: viền `#FA8C16` | Tất cả |
| 8 | Overlay marker đang vẽ (kéo chuột) | `<div>` tuyệt đối, viền nét đứt | Viền nét đứt `#1677FF` | — | Chỉ Submitter |
| 9 | Modal đặt tên Object | `Modal` | Tiêu đề "Tạo Object mới" | — | Chỉ Submitter |
| 10 | Text thông số (trong Modal) | `Typography.Text` | "Trang {n} · x:{x}, y:{y}, w:{w}, h:{h}" | Chữ `#8C8C8C`, 12px | — |
| 11 | Input Tên Object (Modal) | `Input` | Placeholder "VD: Cột C12 - Tầng 3" | Viền `#D9D9D9` | Bắt buộc |
| 12 | Input Mô tả thêm (Modal) | `Input.TextArea` | Placeholder "Mô tả thêm (không bắt buộc)" | như trên | — |
| 13 | Nút Lưu Object (Modal) | `Button type="primary"` | "Lưu Object" | Nền `#1677FF` (Primary) | — |
| 14 | Nút Hủy (Modal) | `Button` | "Hủy" | Viền `#D9D9D9` (Default) | — |

### Logic
- Kéo chuột trên canvas vẽ vùng chọn hình chữ nhật → nhả chuột mở Modal (thành phần 9-14).
- "Lưu Object" → `CreateObjectFromMarkerCommand` → marker chuyển từ nét đứt sang nét liền `#1677FF`, thêm vào danh sách sidebar.
- Marker đã lưu tự hiện lại khi chuyển trang đúng `PageNumber` (dữ liệu từ `GetObjectsQuery`).

---

## 7. MÀN HÌNH DANH SÁCH FORM INSPECTION

**Route:** `/inspections` | **Actor:** `Submitter`, `Reviewer`, `Approver`

### Thành phần chi tiết

| # | Thành phần | Component | Nội dung | Màu sắc | Điều kiện hiện |
|---|---|---|---|---|---|
| 1 | Select lọc Trạng thái | `Select` | Tất cả/Draft/Submitted/UnderReview/Approved/Rejected | — | Tất cả |
| 2 | Select lọc Object | `Select` (search được) | Danh sách Object | — | Tất cả |
| 3 | Nút Tạo mới | `Button type="primary"` | "+ Tạo mới Inspection" | Nền `#1677FF` (Primary) | Chỉ Submitter |
| 4 | Bảng danh sách | `Table` | Mã số, Tên Object, Người tạo, Ngày tạo/nộp, Trạng thái (`Tag`), Thao tác | — | Tất cả |
| 5 | Tag trạng thái trong bảng | `Tag` | Theo mã màu mục 0.3 | — | — |
| 6 | Nút Sửa (dòng Draft) | `Button type="link"` | "Sửa" | Chữ `#1677FF` | Chỉ chủ sở hữu Submitter, dòng Draft |
| 7 | Nút Xóa (dòng Draft) | `Button type="link" danger` | "Xóa" | Chữ `#FF4D4F` | Chỉ chủ sở hữu Submitter, dòng Draft |

### Logic
- `GetInspectionsQuery` (phân trang, filter). Click dòng → `/inspections/:id`. Nút Xóa mở `Popconfirm` xác nhận trước khi gọi API xoá.

---

## 8. MÀN HÌNH TẠO MỚI / CHỈNH SỬA FORM INSPECTION

**Route:** `/inspections/create` hoặc `/inspections/:id/edit` | **Actor:** Chỉ `Submitter`

**Guard:** `/edit` chỉ mở khi `Status = Draft` và `CreatedBy = UserId hiện tại`; sai điều kiện → redirect `/inspections/:id`.

### Thành phần chi tiết

| # | Thành phần | Component | Nội dung | Màu sắc |
|---|---|---|---|---|
| 1 | Select Bản vẽ | `Select` | Danh sách DrawingFile | Viền `#D9D9D9` |
| 2 | Select Object (cascading) | `Select` (search được, disable đến khi chọn Bản vẽ) | Danh sách Object thuộc bản vẽ đã chọn | như trên |
| 3 | Form động FormIO | `@formio/react Form` | Render theo schema JSON | Theo theme mặc định FormIO, override primary color = `#1677FF` |
| 4 | Nút Hủy | `Button` | "Hủy" | Viền `#D9D9D9` (Default) |
| 5 | Nút Lưu bản nháp | `Button` | "Lưu bản nháp" | Viền `#1677FF`, chữ `#1677FF`, nền trắng (Default-outline, không phải Primary đặc để phân biệt mức ưu tiên thấp hơn Gửi duyệt) |
| 6 | Nút Gửi duyệt | `Button type="primary"` | "Gửi duyệt" | Nền `#1677FF` (Primary — nút nhấn mạnh nhất trên màn) |

### Logic
- "Lưu bản nháp" → `CreateInspectionCommand`, không validate chặt theo schema.
- "Gửi duyệt" → validate đầy đủ theo schema ở client, sau đó `SubmitInspectionCommand`.

---

## 9. MÀN HÌNH CHI TIẾT ĐỢT KIỂM TRA & DUYỆT

**Route:** `/inspections/:id` | **Actor:** `Submitter`/`Reviewer`/`Approver`

### Thành phần chi tiết

| # | Thành phần | Component | Nội dung | Màu sắc | Điều kiện hiện (Role + Status) |
|---|---|---|---|---|---|
| 1 | Tiến trình | `Steps` (Draft→Submitted→UnderReview) hoặc `Result` (khi Approved/Rejected) | — | Bước hiện tại `#1677FF`, bước xong `#52C41A`, `Result` success xanh `#52C41A` / error đỏ `#FF4D4F` | Tất cả |
| 2 | Thẻ tóm tắt | `Descriptions` | Object, Bản vẽ gốc, Người nộp, Thời gian nộp | Nền `#FAFAFA` | Tất cả |
| 3 | Vùng xem FormIO | `@formio/react Form` (readOnly) | — | — | Tất cả |
| 4 | Nút Tiếp nhận hồ sơ | `Button type="primary"` | "Tiếp nhận hồ sơ" | Nền `#1677FF` (Primary) | Reviewer + Status=Submitted |
| 5 | Nút Phê duyệt | `Button type="primary" style={{background:'#52C41A'}}` | "Phê duyệt" | Nền `#52C41A` (Success) | Approver + Status=UnderReview |
| 6 | Nút Từ chối | `Button danger type="primary"` | "Từ chối" | Nền `#FF4D4F` (Danger) | Approver + Status=UnderReview |
| 7 | Nút Tạo lại/Resubmit | `Button type="primary"` | "Tạo lại (Resubmit)" | Nền `#1677FF` (Primary) | Submitter (chủ sở hữu) + Status=Rejected |
| 8 | Modal Từ chối | `Modal` | Tiêu đề "Lý do từ chối" | — | — |
| 9 | Textarea lý do (Modal) | `Input.TextArea` | Placeholder "Nhập lý do từ chối (bắt buộc)" | Viền `#D9D9D9` | Bắt buộc |
| 10 | Nút Xác nhận Từ chối (Modal) | `Button danger type="primary"` | "Xác nhận từ chối" | Nền `#FF4D4F` (Danger) | — |
| 11 | Khối hiển thị RejectReason (khi đã Rejected) | `Alert type="error"` | "Lý do từ chối: {RejectReason}" | Nền `#FFF1F0`, chữ `#FF4D4F` | Status=Rejected |

### Logic
- Bảng điều kiện hiện nút (mục 4-7) áp dụng nghiêm ngặt — nút chỉ render khi cả Role lẫn Status đều khớp, không chỉ dựa vào Role.
- "Phê duyệt" thành công → Elsa hoàn tất workflow → tự động chuyển `ChecklistItem` liên kết sang `Done`.
- "Tạo lại/Resubmit" → tạo Inspection mới Draft, copy `ObjectId` + `FormDataJson` cũ, điều hướng sang Màn 8 (edit).

---

## 10. MÀN HÌNH DANH SÁCH CHECKLIST

**Route:** `/checklists` | **Actor:** `Reviewer` (quản lý), `Submitter`/`Approver` (chỉ xem)

### Thành phần chi tiết

| # | Thành phần | Component | Nội dung | Màu sắc | Điều kiện hiện |
|---|---|---|---|---|---|
| 1 | Select lọc trạng thái | `Select` | Tất cả/Open/InProgress/Completed | — | Tất cả |
| 2 | Nút Tạo mới Checklist | `Button type="primary"` | "+ Tạo mới Checklist" | Nền `#1677FF` (Primary) | Chỉ Reviewer |
| 3 | Card Checklist (mỗi item) | `Card` | Tên Checklist, Object liên kết, `Tag` trạng thái, `Progress` | Nền trắng, bo góc 8px | Tất cả |
| 4 | Progress bar | `Progress` | % ChecklistItem bắt buộc đã Done | Màu strokeColor `#52C41A` | — |
| 5 | Modal Tạo mới | `Modal` | Tiêu đề "Tạo Checklist mới" | — | Chỉ Reviewer |
| 6 | Input Tên (Modal) | `Input` | Placeholder "VD: Nghiệm thu hệ thống điện tầng 3" | Viền `#D9D9D9` | Bắt buộc |
| 7 | Input Mô tả (Modal) | `Input.TextArea` | Placeholder "Mô tả (không bắt buộc)" | như trên | — |
| 8 | Select Object (Modal) | `Select` (search được) | Danh sách Object có sẵn | như trên | Bắt buộc |
| 9 | Nút Tạo (Modal) | `Button type="primary"` | "Tạo" | Nền `#1677FF` (Primary) | — |

### Logic
- Click Card → điều hướng `/checklists/:id`. Modal Tạo mới → `CreateChecklistCommand` → điều hướng thẳng sang Màn 11 để thêm ChecklistItem.

---

## 11. MÀN HÌNH CHI TIẾT CHECKLIST & GẮN INSPECTION

**Route:** `/checklists/:id` | **Actor:** `Reviewer` (quản lý đầy đủ), `Submitter`/`Approver` (chỉ xem)

### Thành phần chi tiết

| # | Thành phần | Component | Nội dung | Màu sắc | Điều kiện hiện |
|---|---|---|---|---|---|
| 1 | Header thông tin | `Descriptions` | Tên, Mô tả, Object liên kết, `Tag` Trạng thái Checklist | — | Tất cả |
| 2 | Nút Thêm tiêu chí | `Button type="primary"` | "+ Thêm tiêu chí" | Nền `#1677FF` (Primary) | Chỉ Reviewer |
| 3 | Bảng ChecklistItem | `Table` | STT, Tên tiêu chí, Bắt buộc (`Tag`/`Checkbox` readonly), Inspection liên kết (tên + `Tag` trạng thái), Trạng thái mục (`Tag` Pending/Done), Thao tác | — | Tất cả |
| 4 | Nút Gắn Inspection (mỗi dòng) | `Button type="link"` | "Gắn Form Inspection" | Chữ `#1677FF` | Chỉ Reviewer, item chưa có LinkedInspectionId |
| 5 | Modal gắn Inspection | `Modal` | Tiêu đề "Chọn Form Inspection" | — | Chỉ Reviewer |
| 6 | Select Inspection (Modal) | `Select` (search được) | Danh sách Inspection cùng ObjectId, chưa gắn item khác | — | — |
| 7 | Nút Xác nhận (Modal) | `Button type="primary"` | "Xác nhận" | Nền `#1677FF` (Primary) | — |
| 8 | Nút Đóng Checklist | `Button type="primary" style={{background:'#52C41A'}}` | "Đóng Checklist (Hoàn tất)" | Nền `#52C41A` (Success) khi đủ điều kiện; disabled (nền `#F5F5F5`, chữ `#BFBFBF`) khi chưa đủ | Chỉ Reviewer |
| 9 | Tooltip khi nút Đóng bị disable | `Tooltip` | "Còn {n} tiêu chí bắt buộc chưa hoàn thành" | Nền tối `#262626`, chữ trắng | Khi disabled |

### Logic
- "Thêm tiêu chí" → `AddChecklistItemCommand`. Gắn Inspection → cập nhật `LinkedInspectionId`.
- ChecklistItem tự chuyển `Done` khi Inspection liên kết được Approved ở Màn 9 (refetch khi quay lại trang này).
- "Đóng Checklist" chỉ enable khi mọi item `IsRequired=true` đều `Done`; backend vẫn validate lại dù FE đã disable đúng.
