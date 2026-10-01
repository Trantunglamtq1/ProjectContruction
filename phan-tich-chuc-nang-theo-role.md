# PHÂN TÍCH CHỨC NĂNG (NÚT) THEO TỪNG ROLE

**Dự án:** Quản lý Nghiệm thu Công trình (Inspection & Checklist System)
**Số Role:** 4 — Admin, Submitter, Reviewer, Approver
**Nguồn tham chiếu:** Tài liệu đặc tả nghiệp vụ & Kế hoạch 23 ngày; Tài liệu đặc tả màn hình chi tiết (11 màn hình)

> Nguyên tắc chung: nút chỉ hiện khi **cả Role lẫn Status hiện tại của dữ liệu** đều thoả điều kiện — không chỉ dựa vào Role đơn thuần. Mỗi hành động trong bảng dưới đều ánh xạ đúng 1 Command/Query đã định nghĩa ở Backend.

---

## 1. ADMIN — chỉ quản trị người dùng, không chạm vào nghiệp vụ Inspection/Checklist

| Khu vực | Nút / Hành động | Màn hình | Điều kiện hiện |
|---|---|---|---|
| Quản lý User | Tìm kiếm / lọc theo Role | Danh sách User (`/admin/users`) | — |
| Quản lý User | Gán Role | Danh sách User | User có `RoleId = null` |
| Quản lý User | Đổi Role | Danh sách User | User đã có Role; disable trên chính dòng Admin đang đăng nhập |
| Chung | Đăng xuất | Header (toàn hệ thống) | — |

**Nhận xét:** Admin có đúng 1 hành động nghiệp vụ duy nhất (gán/đổi Role). Không truy cập Bản vẽ, Inspection, Checklist kể cả ở chế độ xem — đúng vai trò "quản trị hệ thống", không tham gia quy trình nghiệm thu.

---

## 2. SUBMITTER — role có nhiều nút nhất, là người khởi tạo toàn bộ dữ liệu

| Khu vực | Nút / Hành động | Màn hình | Điều kiện hiện |
|---|---|---|---|
| Bản vẽ | Upload bản vẽ (PDF) | Danh sách Bản vẽ (`/drawings`) | — |
| Bản vẽ | Mở Viewport | Danh sách Bản vẽ | — |
| Viewport | Khoanh vùng Object mới | Viewport (`/drawings/:id/viewport`) | — |
| Viewport | Lưu Object | Modal trong Viewport | — |
| Inspection | Tạo mới Inspection | Danh sách Inspection (`/inspections`) | — |
| Inspection | Sửa | Danh sách Inspection | `Status = Draft`, đúng chủ sở hữu (`CreatedBy = UserId`) |
| Inspection | Xóa | Danh sách Inspection | `Status = Draft`, đúng chủ sở hữu |
| Inspection | Lưu bản nháp | Tạo/Sửa Inspection (`/inspections/create`, `/:id/edit`) | — |
| Inspection | Gửi duyệt (Submit) | Tạo/Sửa Inspection | — |
| Inspection | Tạo lại (Resubmit) | Chi tiết Inspection (`/inspections/:id`) | `Status = Rejected`, đúng chủ sở hữu |
| Checklist | *(không có nút — chỉ xem)* | Danh sách/Chi tiết Checklist | — |

**Nhận xét:** Submitter là role nặng nhất về số thao tác (9 nút nghiệp vụ) — ưu tiên hoàn thiện đúng luồng này trước trong kế hoạch triển khai, vì dữ liệu Reviewer/Approver thao tác đều bắt nguồn từ đây.

---

## 3. REVIEWER — thẩm tra hồ sơ + phê duyệt bước 1 + toàn quyền Checklist

| Khu vực | Nút / Hành động | Màn hình | Điều kiện hiện |
|---|---|---|---|
| Bản vẽ | *(không có nút — chỉ xem)* | Danh sách Bản vẽ, Viewport | — |
| Inspection | Tiếp nhận hồ sơ | Chi tiết Inspection (`/inspections/:id`) | `Status = Submitted` |
| Inspection | **Phê duyệt thẩm tra (Reviewer Approve)** | Chi tiết Inspection | `Status = UnderReview` |
| Inspection | **Từ chối thẩm tra (Reviewer Reject)** | Chi tiết Inspection | `Status = UnderReview` |
| Checklist | Tạo mới Checklist | Danh sách Checklist (`/checklists`) | — |
| Checklist | Thêm tiêu chí | Chi tiết Checklist (`/checklists/:id`) | — |
| Checklist | Gắn Form Inspection | Chi tiết Checklist | Item chưa có `LinkedInspectionId` |
| Checklist | Đóng Checklist (Hoàn tất) | Chi tiết Checklist | Mọi `ChecklistItem` bắt buộc đã `Done` |

**Nhận xét:** Reviewer vận hành **bước phê duyệt cấp 1 (thẩm định chất lượng)**. Sau khi Reviewer bấm **Phê duyệt thẩm tra**, hồ sơ chuyển sang trạng thái `Reviewed` (hoặc `PendingFinalApproval`), lúc này hồ sơ mới được chuyển tiếp tới lượt **Approver**. Nếu Reviewer từ chối (Reject), hồ sơ trả về cho Submitter.

---

## 4. APPROVER — cấp phê duyệt quyết định cuối cùng (Cấp 2 - Chủ Đầu Tư)

| Khu vực | Nút / Hành động | Màn hình | Điều kiện hiện |
|---|---|---|---|
| Bản vẽ | *(không có nút — chỉ xem)* | Danh sách Bản vẽ, Viewport | — |
| Checklist | *(không có nút — chỉ xem)* | Danh sách/Chi tiết Checklist | — |
| Inspection | **Phê duyệt chính thức (Final Approve)** | Chi tiết Inspection (`/inspections/:id`) | `Status = Reviewed` (Bắt buộc Reviewer đã duyệt trước) |
| Inspection | **Từ chối chính thức (Final Reject)** | Chi tiết Inspection | `Status = Reviewed` |

**Nhận xét:** Approver chỉ tiếp nhận và ra quyết định trên những đơn **đã được Reviewer phê duyệt bước 1** (`Status = Reviewed`). Quyết định Approve cuối cùng của Approver sẽ kéo theo toàn bộ `ChecklistItem` liên kết tự động chuyển trạng thái sang `Done`.

---

## 5. Bảng tổng hợp số lượng nút nghiệp vụ theo Role (Quy trình 2 cấp phê duyệt)

| Khu vực | Admin | Submitter | Reviewer | Approver |
|---|---|---|---|---|
| Quản lý User | 3 *(Gán, Đổi, Khóa/Mở)* | 0 | 0 | 0 |
| Bản vẽ & Viewport | 0 | 3 | 0 (chỉ xem) | 0 (chỉ xem) |
| Inspection | 0 | 6 | 3 *(Tiếp nhận, Duyệt cấp 1, Từ chối)* | 2 *(Duyệt cuối, Từ chối)* |
| Checklist | 0 | 0 (chỉ xem) | 4 | 0 (chỉ xem) |
| **Tổng nút nghiệp vụ** | **3** | **9** | **7** | **2** |

---

## 6. Rủi ro triển khai liên quan đến phân bổ Role

- Submitter chiếm gần phân nửa tổng số thao tác toàn hệ thống (9/18 nút nghiệp vụ) — nếu Giai đoạn 3 (Frontend Inspection/Checklist) trong kế hoạch 23 ngày bị trễ, ưu tiên hoàn thiện đúng luồng Submitter trước, vì Reviewer/Approver/Admin đều phụ thuộc vào dữ liệu do Submitter tạo ra để có đối tượng mà thao tác.
- Approver tuy ít nút nhất nhưng nằm ở điểm nghẽn cuối quy trình (Approve/Reject) — mọi lỗi ở 2 nút này ảnh hưởng trực tiếp đến trạng thái Checklist, cần kiểm thử kỹ ở Giai đoạn 4 (tích hợp & kiểm thử).
- Admin và luồng gán Role là phụ thuộc nền (blocking dependency) cho cả 3 Role nghiệp vụ còn lại — không có tài khoản được gán Role thì không ai thao tác được gì, nên vẫn giữ nguyên tắc ưu tiên hoàn thành Giai đoạn 0 (Authentication) sớm nhất.
