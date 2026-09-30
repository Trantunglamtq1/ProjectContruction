# TÀI LIỆU ĐẶC TẢ NGHIỆP VỤ & KẾ HOẠCH THỰC HIỆN DEMO

**Module:** Authentication (Admin/Submitter/Reviewer/Approver) — Upload Bản vẽ (PDF) — Object — Form Inspection & Checklist

**Tech stack:** JWT Auth / CQRS / EF Core / FormIO / Elsa Workflow / pdf.js Viewport / React + Ant Design + React Query

**Thời lượng thực hiện:** 23 ngày làm việc

**Phạm vi:** Đăng ký/Đăng nhập + JWT + Admin gán Role, Upload bản vẽ + xác định Object, 2 module hoàn chỉnh (Backend + Frontend) — dùng cho demo review chính thức.

---

# PHẦN 1 — MÔ TẢ NGHIỆP VỤ & ĐẶC TẢ

## 1. Tổng quan nghiệp vụ

Hệ thống quản lý các hoạt động kiểm tra và nghiệm thu trên một Object xây dựng (cấu kiện/hạng mục). Điểm mấu chốt: Object không phải dữ liệu nhập tay tuỳ ý mà phải có nguồn gốc từ một bản vẽ xây dựng cụ thể — người dùng upload bản vẽ (PDF), xem qua Viewport, và khoanh vùng để xác định Object ngay trên bản vẽ đó. Toàn bộ hệ thống yêu cầu đăng nhập, mọi thao tác đều gắn với 1 tài khoản và vai trò (Role) cụ thể do Admin gán.

Phạm vi demo gồm 4 khối chức năng nối tiếp nhau:

- **Authentication & Quản trị người dùng** — đăng ký, đăng nhập, cấp JWT; Admin gán Role cho từng tài khoản.
- **Upload bản vẽ & Viewport** — tải file PDF lên hệ thống, xem bản vẽ, khoanh vùng để tạo Object gắn liền với vị trí cụ thể trên bản vẽ.
- **Form Inspection** — biểu mẫu kiểm tra hiện trường, định nghĩa động qua FormIO, gắn với 1 Object đã được xác định từ bản vẽ.
- **Checklist** — danh sách đầu việc/tiêu chí cần xác nhận trên Object, liên kết tới 1 hoặc nhiều Form Inspection.

Luồng nghiệp vụ tổng thể: **Đăng ký → Admin gán Role → Đăng nhập → Upload bản vẽ → Xác định Object trên bản vẽ → Tạo Form Inspection/Checklist cho Object đó.**

Trục kỹ thuật xương sống:

- **JWT**: xác thực người dùng, mọi API (trừ Register/Login) yêu cầu Bearer token hợp lệ.
- **FormIO**: sinh và render form động (schema JSON) — thay đổi biểu mẫu không cần sửa code.
- **Elsa Workflow**: quản lý trạng thái và luồng duyệt, tách rời logic quy trình khỏi logic nghiệp vụ thuần túy.

## 2. Actor & phân quyền

| Actor | Vai trò nghiệp vụ |
|---|---|
| **Admin** (quản trị hệ thống) | Quản lý danh sách tài khoản người dùng; gán Role (Submitter/Reviewer/Approver) cho từng tài khoản sau khi đăng ký. Không tham gia trực tiếp vào luồng Inspection/Checklist. |
| **Submitter** (kỹ sư hiện trường) | Tải bản vẽ (PDF) lên hệ thống, xem bản vẽ qua Viewport và khoanh vùng để xác định Object. Sau đó tạo Form Inspection (Draft) cho Object đó, điền dữ liệu theo schema FormIO và submit để chuyển sang luồng duyệt. |
| **Reviewer** (giám sát công trình) | Xem xét Inspection đã submit, chuyển trạng thái Under Review, yêu cầu bổ sung hoặc chuyển tiếp cho Approver. Đồng thời phụ trách Checklist: tạo Checklist cho Object, gắn các đầu việc (ChecklistItem) với Form Inspection tương ứng, theo dõi tiến độ hoàn thành. |
| **Approver** (quản lý dự án) | Ra quyết định cuối cùng: Approve hoặc Reject kèm lý do. |

> Mỗi Actor (trừ Admin) tương ứng với 1 Role được cấp trong hệ thống Authentication ở mục 3 — Role do Admin gán cho tài khoản (User) và quyết định các hành động được phép thực hiện.

## 3. Authentication & Quản trị người dùng

### 3.1. Định nghĩa

Người dùng phải đăng ký tài khoản và đăng nhập trước khi sử dụng bất kỳ chức năng nào. Tài khoản mới đăng ký sẽ **KHÔNG** được tự chọn Role — tài khoản ở trạng thái chưa có Role chính thức cho đến khi Admin vào màn Quản lý người dùng để gán Role phù hợp (Submitter/Reviewer/Approver). Đây là điểm đúng với thực tế nghiệp vụ: không ai được tự phong quyền cho chính mình. Đăng nhập thành công trả về JWT access token; token này được đính kèm trong mọi request tiếp theo (Bearer token) để hệ thống xác thực danh tính và Role hiện tại của người gọi.

> Vì không có luồng tự đăng ký làm Admin, hệ thống sẽ seed sẵn đúng 1 tài khoản Admin mặc định ngay khi khởi tạo database (qua migration/seed data), dùng để bắt đầu gán Role cho các tài khoản khác.

### 3.2. Mô hình dữ liệu

| Entity / Trường | Ý nghĩa |
|---|---|
| User.Id | Khóa chính. |
| User.Username / Email | Định danh đăng nhập, duy nhất trong hệ thống. |
| User.PasswordHash | Mật khẩu đã băm (không lưu plain text). |
| User.FullName | Tên hiển thị. |
| User.RoleId | FK tới Role, nullable — null nghĩa là tài khoản đăng ký xong nhưng chưa được Admin gán Role. |
| Role.Id / Name | Định danh vai trò: Admin / Submitter / Reviewer / Approver. |
| User.CreatedAt | Thời điểm tạo tài khoản. |

### 3.3. Quy tắc nghiệp vụ

- Đăng ký: Username/Email phải duy nhất; mật khẩu được băm trước khi lưu (BCrypt/Identity Hasher); tài khoản mới tạo ra có RoleId = null (chưa có quyền nghiệp vụ nào).
- Đăng nhập: xác thực Username/Password, trả về JWT access token chứa claims UserId và Role (có thể null); token có thời hạn (ví dụ 60 phút), demo không cần cơ chế refresh token phức tạp.
- Tài khoản có Role = null vẫn đăng nhập được nhưng không gọi được bất kỳ API nghiệp vụ nào (Upload, Object, Inspection, Checklist) cho đến khi được Admin gán Role.
- Chỉ Admin mới được gọi API quản lý người dùng: xem danh sách User kèm Role hiện tại, gán/đổi Role cho từng User (AssignRoleCommand).
- Mọi endpoint, trừ `/auth/register` và `/auth/login`, đều yêu cầu Bearer token hợp lệ — request không có/token sai trả về 401 Unauthorized.
- Authorization theo Role, enforce bằng `[Authorize(Roles = ...)]` hoặc policy tương đương: Submitter được tạo/submit Object và Inspection; Reviewer được chuyển Under Review và quản lý Checklist; chỉ Approver được Approve/Reject; chỉ Admin được quản lý User.
- Các trường CreatedBy/SubmittedBy/ReviewedBy/ApprovedBy trên Object, FormInspection, Checklist lấy trực tiếp từ UserId trong JWT claims, không cho client tự truyền lên.

## 4. Bản vẽ xây dựng (Drawing File) & Object

### 4.1. Định nghĩa

Đây là khối chức năng nền tảng, bắt buộc phải có trước khi tạo được Form Inspection hoặc Checklist. Người dùng (đã đăng nhập và đã được gán Role) upload bản vẽ xây dựng dưới dạng file PDF; hệ thống lưu file rồi hiển thị lại qua một Viewport (dùng pdf.js). Trên Viewport, người dùng khoanh vùng (marker hình chữ nhật) tại vị trí cấu kiện/hạng mục cần theo dõi và đặt tên cho vùng đó — vùng này chính là 1 Object.

Trình tự bắt buộc: **luôn upload trước, sau đó Viewport tải lại đúng file đã lưu để khoanh vùng lên trên** — toạ độ marker chỉ có ý nghĩa khi gắn với 1 bản vẽ đã tồn tại trên hệ thống (không khoanh trước trên file gốc rồi mới upload).

> Phạm vi demo chỉ hỗ trợ định dạng PDF (không xử lý Revit/BIM ở giai đoạn này, do yêu cầu engine 3D viewer riêng, không phù hợp với thời lượng hiện tại).

### 4.2. Mô hình dữ liệu

| Entity / Trường | Ý nghĩa |
|---|---|
| DrawingFile.Id | Khóa chính. |
| DrawingFile.FileName / FileType | Tên file gốc; loại file (demo chỉ nhận "pdf"). |
| DrawingFile.FileUrl | Đường dẫn lưu trữ file (local storage hoặc blob storage). |
| DrawingFile.UploadedBy / UploadedAt | UserId người upload (lấy từ JWT) và thời điểm upload. |
| Object.Id | Khóa chính. |
| Object.DrawingFileId | FK bắt buộc tới DrawingFile — Object luôn phải có nguồn gốc từ 1 bản vẽ. |
| Object.PageNumber | Trang trong file PDF chứa vùng khoanh (marker). |
| Object.MarkerCoordinates | Toạ độ vùng khoanh trên trang (x, y, width, height), lưu dạng JSON. |
| Object.Name | Tên Object do người dùng đặt khi khoanh vùng (vd: "Cột C12 - Tầng 3"). |
| Object.CreatedBy / CreatedAt | UserId người tạo (từ JWT) và thời điểm tạo Object. |

### 4.3. Quy tắc nghiệp vụ

- Demo chỉ chấp nhận upload file định dạng PDF.
- Object bắt buộc phải gắn với đúng 1 DrawingFileId + PageNumber + MarkerCoordinates — hệ thống không cho tạo Object rời rạc không có nguồn gốc bản vẽ.
- Chỉ những Object đã được tạo từ bản vẽ mới được phép chọn khi tạo Form Inspection hoặc Checklist — màn tạo Inspection/Checklist bắt buộc chọn Object có sẵn, không cho nhập tay tên Object.
- Viewport hiển thị lại toàn bộ marker/Object đã tạo trên từng bản vẽ để người dùng chọn lại hoặc xem đối chiếu vị trí thực tế.

## 5. Form Inspection

### 5.1. Định nghĩa

Form Inspection là biểu mẫu kiểm tra hiện trường được định nghĩa động qua FormIO (schema JSON), gắn với 1 Object đã được xác định từ bản vẽ (mục 4). Nội dung form (các trường kiểm tra, kết quả đạt/không đạt, ghi chú, ảnh đính kèm...) do nghiệp vụ tự cấu hình qua schema, không phụ thuộc vào việc sửa code backend/frontend.

### 5.2. Vòng đời trạng thái (State)

| Trạng thái | Mô tả |
|---|---|
| Draft | Form vừa được tạo, Submitter còn có thể chỉnh sửa/xóa tự do. |
| Submitted | Submitter đã gửi form; dữ liệu bị khóa, không cho sửa trực tiếp; Elsa Workflow instance được khởi tạo. |
| UnderReview | Reviewer đang xem xét nội dung; có thể yêu cầu bổ sung thông tin. |
| Approved | Approver đã phê duyệt; trạng thái cuối, không thể chỉnh sửa. |
| Rejected | Bị từ chối kèm lý do (RejectReason bắt buộc); có thể tạo bản Submit lại (resubmit) dưới dạng Inspection mới hoặc quay về Draft tuỳ quy ước dự án. |

### 5.3. Mô hình dữ liệu (FormInspection)

| Trường | Ý nghĩa |
|---|---|
| Id | Khóa chính. |
| ObjectId | FK tới Object (đã được xác định từ bản vẽ) mà Inspection này thuộc về. |
| FormSchemaId | FK/định danh schema FormIO được dùng để render form. |
| FormDataJson | Dữ liệu đã submit, lưu dạng JSON theo đúng cấu trúc schema. |
| Status | Trạng thái hiện tại (Draft/Submitted/UnderReview/Approved/Rejected), đồng bộ với Elsa Workflow. |
| SubmittedBy / SubmittedAt | UserId submit (từ JWT) và thời điểm submit. |
| ReviewedBy / ReviewedAt | UserId review và thời điểm chuyển UnderReview. |
| ApprovedBy / ApprovedAt | UserId duyệt cuối và thời điểm Approve. |
| RejectReason | Lý do từ chối, bắt buộc khi Status = Rejected. |
| CreatedAt / UpdatedAt | Thời gian tạo/cập nhật bản ghi. |

### 5.4. Quy tắc nghiệp vụ

- Chỉ Inspection ở trạng thái Draft mới được sửa/xóa, và chỉ bởi Submitter đã tạo nó.
- Submit sẽ validate FormDataJson theo đúng schema FormIO tương ứng trước khi chuyển Status và khởi tạo workflow instance.
- Chuyển Submitted → UnderReview → Approved/Rejected chỉ được thực hiện qua Elsa Workflow, và chỉ bởi tài khoản có Role Reviewer/Approver tương ứng (kiểm tra qua JWT claims).
- Reject bắt buộc phải có RejectReason.
- Approved là trạng thái cuối (terminal state), không thể quay lại các trạng thái trước.

## 6. Checklist

### 6.1. Định nghĩa

Checklist là danh sách các đầu việc/tiêu chí (ChecklistItem) cần kiểm tra và xác nhận trên 1 Object. Mỗi ChecklistItem có thể liên kết tới đúng 1 Form Inspection cụ thể — đây là điểm thể hiện quan hệ dữ liệu thực giữa các module trong demo.

### 6.2. Mô hình dữ liệu

| Entity / Trường | Ý nghĩa |
|---|---|
| Checklist.Id / ObjectId | Khóa chính; Object (từ bản vẽ) mà Checklist thuộc về. |
| Checklist.Name / Description | Tên và mô tả Checklist (vd: "Nghiệm thu hệ thống điện tầng 3"). |
| Checklist.Status | Open / InProgress / Completed. |
| ChecklistItem.Id / ChecklistId | Khóa chính; Checklist cha. |
| ChecklistItem.Name / IsRequired | Tên đầu việc; có bắt buộc để đóng Checklist hay không. |
| ChecklistItem.LinkedInspectionId | FK tới FormInspection liên kết (nullable — có thể chưa gắn). |
| ChecklistItem.Status | Pending / Done — Done chỉ khi Inspection liên kết đã Approved. |

### 6.3. Vòng đời trạng thái

- **Open**: Checklist vừa tạo, có thể thêm/sửa/xóa ChecklistItem tự do.
- **InProgress**: đã có ít nhất 1 ChecklistItem được gắn Inspection và đang chờ xử lý.
- **Completed**: tất cả ChecklistItem bắt buộc (IsRequired = true) đều ở trạng thái Done, tức Inspection liên kết tương ứng đã Approved.

### 6.4. Quy tắc nghiệp vụ

- 1 ChecklistItem chỉ liên kết được với 1 Form Inspection tại một thời điểm.
- ChecklistItem tự động chuyển Done khi Inspection liên kết chuyển sang Approved (thông qua sự kiện/tín hiệu từ Elsa Workflow của Inspection).
- Checklist chỉ được phép đóng (Completed) khi toàn bộ item bắt buộc đã Done — hệ thống chặn thao tác đóng thủ công nếu chưa đủ điều kiện.
- Chỉ tài khoản Role Reviewer mới được tạo/quản lý Checklist.

## 7. Quan hệ dữ liệu tổng thể

- User (n) — (1) Role
- User (1) — (n) DrawingFile / Object / FormInspection / Checklist (qua các trường CreatedBy, SubmittedBy, ReviewedBy, ApprovedBy)
- DrawingFile (1) — (n) Object
- Object (1) — (n) FormInspection
- Object (1) — (n) Checklist
- Checklist (1) — (n) ChecklistItem
- ChecklistItem (0..1) — (1) FormInspection

Chuỗi quan hệ này đảm bảo mọi hành động đều gắn với 1 tài khoản xác thực cụ thể có Role hợp lệ do Admin cấp, và mọi Object dùng trong Inspection/Checklist đều truy vết được về đúng bản vẽ gốc và đúng vị trí trên bản vẽ.

## 8. Elsa Workflow — luồng duyệt Inspection

**Workflow Definition: InspectionApprovalWorkflow**

- Start → chờ tín hiệu Submit (WaitForSubmit) được bắn từ SubmitInspectionCommand.
- NotifyReviewer → thông báo cho Reviewer có Inspection mới cần xem xét.
- Decision (Approve / Reject) → do Reviewer/Approver thao tác trên Elsa Dashboard hoặc qua API tương ứng (đã xác thực JWT, đúng Role).
- SetStatus → cập nhật Status trên entity FormInspection để đồng bộ với trạng thái workflow (phục vụ query danh sách nhanh, không cần gọi Elsa runtime mỗi lần đọc).
- End → nếu Approved, bắn tín hiệu để các ChecklistItem liên kết tự chuyển Done.

> Lưu ý kiến trúc: trạng thái hiển thị trên danh sách (list Query) luôn đọc từ field Status trên entity — không gọi trực tiếp Elsa runtime — nhằm tối ưu hiệu năng cho các màn hình danh sách nhiều dữ liệu.

---

# PHẦN 2 — KẾ HOẠCH THỰC HIỆN 23 NGÀY

Phạm vi: Authentication (Đăng ký/Đăng nhập/JWT) + Admin quản lý User/gán Role + Upload bản vẽ (PDF)/Viewport xác định Object, cùng 2 module Form Inspection và Checklist, đầy đủ Backend + Frontend, có tích hợp Elsa Workflow thật và custom CSS theo design system. Kế hoạch chia 5 giai đoạn.

## GIAI ĐOẠN 0 (Ngày 1 - 5) — Authentication: Đăng ký, Đăng nhập, JWT, Admin gán Role

#### Ngày 1: Backend: User, Role, Register, Login, JWT
**Nhiệm vụ:**
- Tạo entity User, Role (migration); seed 4 Role: Admin, Submitter, Reviewer, Approver; seed sẵn 1 tài khoản Admin mặc định.
- RegisterCommand: kiểm tra Username/Email duy nhất, băm mật khẩu (BCrypt/Identity Hasher), tạo User với RoleId = null.
- LoginCommand: xác thực Username/Password, sinh JWT access token chứa claims UserId + Role (có thể null).
- Cấu hình JWT Bearer Authentication cho toàn bộ API (trừ /auth/register, /auth/login).

**DoD:**
- Đăng ký tài khoản mới qua Postman thành công, RoleId = null; từ chối đúng khi trùng Username/Email.
- Đăng nhập trả về JWT hợp lệ; gọi 1 API bất kỳ không kèm token trả về 401.

#### Ngày 2: Backend: Authorization theo Role & API quản lý User (Admin)
**Nhiệm vụ:**
- Áp [Authorize(Roles = ...)] hoặc policy tương đương lên các nhóm API sẽ xây dựng ở các giai đoạn sau.
- GetUsersQuery (danh sách User kèm Role hiện tại) và AssignRoleCommand (gán/đổi Role cho 1 User) — chỉ Role Admin được gọi.
- Middleware lấy UserId từ JWT claims để tự động gán vào CreatedBy/SubmittedBy khi tạo dữ liệu (không nhận từ client).
- Viết unit test cho Register/Login/JWT claims/AssignRole.

**DoD:**
- Admin gán được Role cho 1 tài khoản qua Postman; tài khoản đó đăng nhập lại có Role mới trong JWT.
- Tài khoản không phải Admin gọi AssignRoleCommand bị từ chối (403).

#### Ngày 3: Frontend: Đăng ký, Đăng nhập & gắn JWT
**Nhiệm vụ:**
- Màn Đăng ký (form antd) nối RegisterCommand.
- Màn Đăng nhập nối LoginCommand, lưu JWT (memory/localStorage tuỳ quyết định bảo mật).
- Axios/fetch interceptor tự gắn Bearer token vào mọi request; route bảo vệ (redirect về Login nếu chưa xác thực).
- Xử lý trường hợp tài khoản chưa có Role: hiển thị màn chờ "Tài khoản đang chờ Admin gán quyền".

**DoD:**
- Đăng ký và đăng nhập được từ giao diện; sau đăng nhập vào được các trang được bảo vệ.
- Tài khoản chưa có Role thấy đúng màn chờ, không vào được các chức năng nghiệp vụ.

#### Ngày 4: Frontend: màn Quản lý người dùng (Admin)
**Nhiệm vụ:**
- Màn danh sách User (antd Table): hiển thị Username, FullName, Role hiện tại.
- Chức năng gán/đổi Role cho từng User (Select Role + xác nhận), nối AssignRoleCommand.
- Ẩn hoàn toàn menu này với tài khoản không phải Role Admin.

**DoD:**
- Admin xem được danh sách toàn bộ User và gán Role thành công từ giao diện.
- Tài khoản Role khác không nhìn thấy/không truy cập được màn này.

#### Ngày 5: Buffer Authentication & kiểm thử phân quyền
**Nhiệm vụ:**
- Kiểm thử toàn bộ kịch bản: đăng ký mới → Admin gán từng Role → đăng nhập lại đúng quyền tương ứng.
- Rà soát lại toàn bộ endpoint đã có, đảm bảo áp đúng [Authorize(Roles=...)].
- Fix bug phát sinh trong giai đoạn Authentication.

**DoD:**
- 4 kịch bản Role (Admin/Submitter/Reviewer/Approver) đều hoạt động đúng theo đặc tả Phần 1.
- Không còn endpoint nào thiếu kiểm soát phân quyền.

## GIAI ĐOẠN 1 (Ngày 6 - 9) — Bản vẽ, Upload, Viewport, Object

#### Ngày 6: Thiết kế domain tổng thể & chuẩn bị nền tảng
**Nhiệm vụ:**
- Vẽ ERD đầy đủ: User, Role, DrawingFile, Object, FormInspection, Checklist, ChecklistItem và các khóa ngoại.
- Định nghĩa state cho FormInspection và Checklist theo đặc tả Phần 1.
- Thiết kế FormIO schema JSON: 1 schema cho Inspection, 1 schema cho ChecklistItem template.

**DoD:**
- ERD được chốt, không còn thay đổi lớn.
- 2 schema JSON hợp lệ, test render được trên FormIO Form Builder.

#### Ngày 7: Backend: Upload bản vẽ & tạo Object từ marker
**Nhiệm vụ:**
- Tạo entity DrawingFile, Object (migration); cấu hình FK DrawingFileId bắt buộc trên Object.
- UploadDrawingFileCommand: nhận file PDF, lưu vào storage (local/blob), UploadedBy lấy từ JWT.
- CreateObjectFromMarkerCommand: nhận DrawingFileId, PageNumber, MarkerCoordinates (JSON), Name.
- GetDrawingFilesQuery, GetObjectsQuery (lọc theo DrawingFileId).

**DoD:**
- Upload file PDF qua Postman (kèm Bearer token) thành công, lưu đúng FileUrl.
- Tạo Object gắn với bản vẽ + toạ độ thành công, query lại đúng dữ liệu.

#### Ngày 8: Frontend: màn Upload & Viewport xem bản vẽ
**Nhiệm vụ:**
- Setup React + TypeScript, Ant Design, React Query, cấu trúc thư mục theo feature.
- Màn Upload bản vẽ (antd Upload) nối UploadDrawingFileCommand.
- Viewport: dùng pdf.js render nội dung file PDF, cho phép chuyển trang.

**DoD:**
- Upload được file PDF từ giao diện, thấy trong danh sách bản vẽ.
- Xem đúng nội dung PDF trên Viewport, chuyển trang hoạt động.

#### Ngày 9: Frontend: khoanh vùng tạo Object trên Viewport
**Nhiệm vụ:**
- Dựng lớp overlay (canvas) trên Viewport để khoanh vùng hình chữ nhật (marker).
- Modal đặt tên Object khi khoanh xong, gọi CreateObjectFromMarkerCommand.
- Hiển thị lại toàn bộ marker/Object đã tạo trên bản vẽ; màn danh sách Object để chọn khi tạo Inspection/Checklist.

**DoD:**
- Khoanh vùng, đặt tên và tạo được Object mới gắn đúng vị trí trên bản vẽ.
- Danh sách Object hiển thị đúng, có thể chọn lại để dùng ở bước sau.

## GIAI ĐOẠN 2 (Ngày 10 - 13) — Backend: CQRS Inspection/Checklist, Elsa Workflow

#### Ngày 10: CQRS Form Inspection: Create / Submit / Query
**Nhiệm vụ:**
- Tạo entity FormInspection, Checklist, ChecklistItem (migration), liên kết tới Object đã có.
- CreateInspectionCommand + Handler + Validator (khởi tạo Draft, bắt buộc chọn ObjectId có sẵn, chỉ Role Submitter).
- SubmitInspectionCommand + Handler (validate FormDataJson theo schema, chuyển Status).
- GetInspectionsQuery: filter theo Object/Status, phân trang; viết SP sp_GetInspectionList.

**DoD:**
- Migration chạy thành công; API Create/Submit/Get test qua Postman đúng dữ liệu, đúng Role được phép gọi.
- SP chạy đúng kết quả khi test trực tiếp trên SSMS/Azure Data Studio.

#### Ngày 11: Tích hợp Elsa Workflow cho Inspection
**Nhiệm vụ:**
- Cài đặt Elsa Workflow (NuGet); cấu hình Elsa Server + Dashboard/Studio.
- Dựng Workflow Definition InspectionApprovalWorkflow: Start → WaitForSubmit → NotifyReviewer → Decision → SetStatus → End.
- Trigger workflow instance ngay khi SubmitInspectionCommand thành công.
- Đồng bộ: khi workflow chuyển activity, cập nhật Status trên entity FormInspection.

**DoD:**
- Submit 1 Inspection → xuất hiện workflow instance mới trên Elsa Dashboard.
- Duyệt thủ công trên Dashboard → Status entity tự cập nhật đúng, đồng bộ hai chiều.

#### Ngày 12: CQRS Checklist & business rule
**Nhiệm vụ:**
- CreateChecklistCommand, AddChecklistItemCommand (chỉ Role Reviewer, liên kết 1 FormInspection cụ thể).
- GetChecklistsQuery kèm danh sách item và trạng thái Inspection liên kết.
- Validate business rule: Checklist chỉ Completed khi mọi item bắt buộc đã Done.

**DoD:**
- API Checklist hoạt động end-to-end qua Postman, đúng phân quyền Reviewer.
- Business rule chặn đúng thao tác đóng Checklist khi chưa đủ điều kiện.

#### Ngày 13: Buffer backend, unit test & review
**Nhiệm vụ:**
- Viết unit test cho các Command/Query chính (Auth, Upload, CreateObject, CreateInspection, SubmitInspection, CreateChecklist).
- Refactor theo Clean Code; sửa lỗi phát sinh trong giai đoạn.

**DoD:**
- Toàn bộ backend (Auth/Upload/Object/Inspection/Checklist/Elsa) hoạt động end-to-end qua Postman.
- Unit test pass; code đã qua 1 vòng self-review.

## GIAI ĐOẠN 3 (Ngày 14 - 18) — Frontend: Inspection, Checklist, Custom CSS

#### Ngày 14: Frontend: màn danh sách Inspection & chọn Object
**Nhiệm vụ:**
- Màn danh sách Inspection: antd Table + Filter theo Status + Pagination, nối GetInspectionsQuery.
- Màn tạo Inspection: bắt buộc chọn Object có sẵn (từ danh sách Object đã tạo ở Giai đoạn 1), chỉ hiện cho tài khoản Role Submitter.

**DoD:**
- Danh sách Inspection hiển thị đúng dữ liệu thật.
- Tạo Inspection mới chỉ cho chọn Object đã tồn tại; tài khoản không phải Submitter không thấy nút Tạo.

#### Ngày 15: Custom CSS cho Inspection theo design system
**Nhiệm vụ:**
- Cấu hình ConfigProvider (theme token: màu chủ đạo, border-radius, typography theo design system dự án).
- Custom CSS module cho Table, Filter bar, đúng convention naming, không dùng !important.

**DoD:**
- UI Inspection khớp đúng mockup/design guide được cung cấp.
- Không phá vỡ style gốc của component antd.

#### Ngày 16: Form Inspection: submit & xem chi tiết
**Nhiệm vụ:**
- Render FormIO schema ở FE cho màn Submit Inspection.
- Màn chi tiết: hiển thị dữ liệu đã submit, badge trạng thái theo Status; nút Approve/Reject chỉ hiện với Role Reviewer/Approver tương ứng.
- useMutation cho Submit; invalidate cache danh sách sau khi thành công.

**DoD:**
- Submit được 1 Inspection mới qua form.io, dữ liệu lưu đúng.
- Danh sách tự cập nhật ngay sau submit, badge trạng thái và action hiển thị đúng theo Role.

#### Ngày 17: Màn hình Checklist
**Nhiệm vụ:**
- Dựng màn danh sách Checklist (antd Table) và màn tạo mới Checklist (chọn Object có sẵn, chỉ Role Reviewer).
- Component chọn/liên kết Inspection cho từng ChecklistItem (Select/Transfer, load qua useQuery).
- Custom CSS cho màn Checklist đồng bộ style với Inspection.

**DoD:**
- Tạo được Checklist mới và gắn được Inspection có sẵn vào từng item.
- Danh sách hiển thị đúng trạng thái liên kết theo từng item, style đồng nhất.

#### Ngày 18: Buffer Frontend toàn bộ các khối chức năng
**Nhiệm vụ:**
- Xử lý edge-case: loading skeleton, error state, empty state, validate form phía client cho Auth/Admin/Viewport/Inspection/Checklist.
- Rà soát đồng bộ style giữa các màn (Login, Register, Quản lý User, Viewport, Inspection, Checklist).
- Fix bug phát sinh trong giai đoạn.

**DoD:**
- Toàn bộ màn hình đồng nhất về style, không còn trường hợp trắng màn hình khi lỗi/rỗng dữ liệu.

## GIAI ĐOẠN 4 (Ngày 19 - 23) — Tích hợp, kiểm thử, hoàn thiện demo

#### Ngày 19: Tích hợp end-to-end toàn bộ luồng
**Nhiệm vụ:**
- Test luồng thật: Đăng ký → Admin gán Role → Đăng nhập → Upload bản vẽ → khoanh vùng tạo Object → tạo Inspection → submit → duyệt qua Elsa Dashboard → FE cập nhật trạng thái.
- Kiểm tra đồng bộ trạng thái Checklist khi Inspection liên kết được Approved.
- Kiểm tra phân quyền: mỗi Role chỉ thao tác được đúng chức năng của mình.

**DoD:**
- Luồng end-to-end chạy đúng từ Đăng ký đến Approve, không cần can thiệp thủ công vào database.

#### Ngày 20: Kiểm thử toàn diện
**Nhiệm vụ:**
- Test kịch bản: tài khoản chưa có Role cố truy cập chức năng nghiệp vụ; token hết hạn; nhiều Object trên cùng 1 bản vẽ; Reject rồi resubmit; Checklist có nhiều Inspection (1 approved, 1 chưa).
- Lập bug list, ưu tiên theo mức độ ảnh hưởng (blocker/major/minor).

**DoD:**
- Có bug list rõ ràng kèm mức ưu tiên.
- Không còn lỗi blocker chưa được ghi nhận.

#### Ngày 21: Buffer sửa lỗi & review code
**Nhiệm vụ:**
- Fix toàn bộ bug ưu tiên cao/blocker từ Ngày 20.
- Review lại code theo Clean Code/CQRS convention (naming, tách trách nhiệm, validate).
- Kiểm tra riêng phần Auth/JWT/phân quyền Admin, tích hợp Elsa, và phần khoanh vùng/toạ độ marker — các điểm dễ phát sinh lỗi nhất.

**DoD:**
- Không còn bug blocker.
- Code đã qua 1 vòng self-review hoàn chỉnh.

#### Ngày 22: Tài liệu kỹ thuật & chuẩn bị demo
**Nhiệm vụ:**
- Viết note kỹ thuật ngắn (1-2 trang): kiến trúc tổng thể, lý do chọn JWT/CQRS/FormIO/Elsa/pdf.js, các trade-off đã đưa ra (vì sao chọn PDF thay vì Revit, vì sao Admin gán Role thay vì tự chọn).
- Chuẩn bị 4 tài khoản demo (Admin + mỗi Role nghiệp vụ 1 tài khoản) và kịch bản demo cụ thể theo từng bước thao tác.

**DoD:**
- Tài liệu kỹ thuật hoàn chỉnh.
- Kịch bản demo được viết thành các bước cụ thể, có thể làm theo trực tiếp.

#### Ngày 23: Demo thử & hoàn thiện cuối
**Nhiệm vụ:**
- Chạy thử demo theo đúng kịch bản đã chuẩn bị (đăng nhập lần lượt 4 tài khoản), ghi nhận điểm cần chỉnh.
- Chỉnh sửa cuối cùng (UI, wording, bug nhỏ) theo phản hồi demo thử.
- Đóng gói: source code, tài liệu, hướng dẫn chạy local (README).

**DoD:**
- Demo chạy trơn tru theo đúng kịch bản, từ Đăng ký/gán Role đến Upload bản vẽ, tạo Object, duyệt Inspection và cập nhật Checklist.
- Sẵn sàng trình bày chính thức với leader.

## Rủi ro cần lưu ý

- Auth/JWT/Admin (Giai đoạn 0) là nền tảng cho toàn bộ API phía sau — nếu chậm ở đây sẽ kéo lùi toàn bộ các giai đoạn khác, nên ưu tiên xong sớm và giữ đơn giản (không cần refresh token, không cần quên mật khẩu ở bản demo).
- Khoanh vùng (marker) trên Viewport (Ngày 9) là phần UI mới, dễ tốn thời gian hơn dự kiến do phải xử lý toạ độ chính xác theo tỉ lệ zoom/scroll của PDF — nên làm ở mức đơn giản nhất (rectangle cố định), không làm đa giác tự do.
- Tích hợp Elsa Workflow (Ngày 11) vẫn là điểm dễ lệch tiến độ nếu chưa từng dùng — giữ workflow đơn giản, ít nhánh ở lần triển khai đầu.
- Ngày 21 và Ngày 23 là buffer chủ động — nếu các giai đoạn trước đúng tiến độ, dùng buffer này để trau chuốt UI hoặc bổ sung test case.
- Trạng thái Inspection/Checklist nên luôn đọc từ field Status trên entity (đã đồng bộ từ Elsa), tránh gọi trực tiếp Elsa runtime trong Query danh sách để không ảnh hưởng hiệu năng.
