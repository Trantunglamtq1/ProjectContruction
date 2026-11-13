# Phân quyền theo dự án

Mỗi bản vẽ thuộc một dự án. Cấu kiện, checklist, tiêu chí, inspection và lịch sử kế thừa dự án từ bản vẽ. Kỹ sư chỉ truy cập được dự án đang được phân công; vai trò Submitter, Reviewer và Approver cùng các điều kiện sở hữu, trạng thái và rowversion vẫn áp dụng. Admin quản lý dự án/thành viên theo quyền quản trị hiện có, không được thêm quyền thực hiện các bước duyệt nghiệp vụ.

## Quản lý và sử dụng

1. Admin vào **Dự án**, tạo mã/tên dự án rồi mở **Thành viên**.
2. Chọn tài khoản đang hoạt động có vai trò nghiệp vụ để phân công. Có thể phân công một người vào nhiều dự án.
3. Người dùng mở dự án được phân công; danh sách bản vẽ, checklist, inspection và các upload dùng phạm vi dự án đang chọn.
4. **Thu hồi** xóa phân công, giữ nguyên hồ sơ và lịch sử. Các yêu cầu bắt đầu sau khi API thu hồi thành công bị từ chối ngay với JWT cũ. Các yêu cầu đã được cấp quyền trước thời điểm đó có thể hoàn tất; tệp đã tải xuống thiết bị không thể thu hồi.

Giao diện giữ phiên đăng nhập khi gặp lỗi quyền dự án, đóng nội dung bị giới hạn và cho phép quay về danh sách dự án. Thông báo thay đổi quyền và việc nạp lại danh sách giúp cập nhật giao diện; backend luôn kiểm tra database, không dựa vào trạng thái của trình duyệt.

## API

| API | Quyền/phạm vi |
| --- | --- |
| `GET /api/projects` | Danh sách được phân công; Admin xem toàn bộ; không có phân công trả `[]` |
| `GET /api/projects/{id}` | Quyền dự án thực tế |
| `POST /api/projects` | Admin hiện tại; mã tối đa 50 ký tự, tên tối đa 200; mã duy nhất, được trim và viết hoa |
| `GET /api/projects/{id}/members` | Admin hiện tại |
| `PUT /api/projects/{id}/members/{userId}` | Admin phân công; gọi lại không tạo bản ghi trùng |
| `DELETE /api/projects/{id}/members/{userId}` | Admin thu hồi; gọi lại vẫn thành công, trả 204 |
| Danh sách `/api/drawings`, `/objects`, `/checklists`, `/inspections` | Có thể thêm `projectId`; bỏ tham số thì chỉ trả hợp các dự án được phép |
| `POST /api/drawings/upload`, `/api/inspections/upload-attachment` | Multipart bắt buộc `projectId`, cùng quyền upload hiện có |
| `GET /api/drawings/files/{fileName}` | JWT và metadata bản vẽ được phép; hỗ trợ range |
| `GET /api/inspections/attachments/files/{fileName}` | JWT và metadata attachment được phép |

Thay ID trong URL/body/query không thay đổi quyền: backend tìm dự án theo chuỗi quan hệ thực tế, kiểm tra mọi ID liên quan và từ chối liên kết khác dự án, kể cả khi người dùng là thành viên cả hai. Mã không tồn tại trả 404; thiếu quyền dự án trả 403 với `code: "project_access_denied"`. Quyền role nghiệp vụ hiện có vẫn có thể trả 403 theo cơ chế cũ.

## Thiết kế bảo vệ

- `IProjectAccessService` dùng user đang hoạt động, role hiện tại trong database và bảng `ProjectMembers`. JWT không chứa danh sách dự án. Không có cache membership giữa các request.
- MediatR behavior kiểm tra các request tài nguyên trước validator/handler, với danh sách request được phân loại rõ ràng. Request mới trong nhóm tài nguyên chưa được phân loại bị từ chối. Truy vấn danh sách lọc quyền trong SQL trước đếm/phân trang. Các API quản trị user cũng xác minh Admin hiện tại, tránh dùng JWT của Admin đã bị hạ quyền để tự khôi phục quyền.
- Tệp được kiểm tra metadata trước khi đọc storage, dùng chính xác stored name, không tìm file theo hậu tố. Attachment JSON được kiểm tra dự án và chuẩn hóa từ metadata tin cậy khi tạo/sửa/nộp inspection. File URL bên ngoài hoặc tham chiếu khác dự án bị từ chối.
- Stream cần JWT, trả `Cache-Control: private, no-store`, `X-Content-Type-Options: nosniff` và MIME từ allowlist. React tải blob qua API và hủy object URL khi đóng/chuyển phạm vi. Không đưa token vào URL tệp hay gửi Bearer tới URL tùy ý.
- Schema chỉ cho phép các mẫu hệ thống cố định hoặc GUID tiêu chí đã được kiểm tra quyền; không ghép đường dẫn tùy ý.
- SignalR chỉ tham gia nhóm user đã xác minh, không cung cấp phương thức client tự join dự án. Thông báo nghiệp vụ giải quyết dự án từ Inspection/Checklist thực tế, chọn lại người nhận đang hoạt động theo role/membership và gửi từng user. Không dùng nhóm role hoặc `Clients.All` cho dữ liệu dự án. Tham chiếu không xác định bị bỏ qua. Kết nối đang mở không giữ quyền dự án cũ.
- Thông báo lưu riêng từng người nhận. Danh sách, số chưa đọc, đánh dấu và xóa đều dùng cùng phạm vi người nhận/dự án. Thu hồi quyền cũng ẩn lịch sử dự án đó.

## Chuyển dữ liệu cũ

Migration `20261112181110_AddProjectAuthorization` tạo dự án **LEGACY / Dữ liệu chuyển đổi**, ID `aaaaaaaa-0000-0000-0000-000000000001`.

- Toàn bộ bản vẽ hiện có chuyển vào LEGACY; con, ID, rowversion, lịch sử và workflow được giữ nguyên. Không di chuyển tệp vật lý.
- Metadata attachment được backfill từ các tham chiếu JSON hợp lệ. File không có metadata xác định được bị từ chối; cần đối soát và bổ sung metadata đúng dự án trước khi phục hồi truy cập, không bật lại đường tải công khai.
- Thông báo cũ thuộc LEGACY. Các hàng dùng chung được giữ làm lịch sử và tạo bản sao theo người nhận hiện có để đọc/xóa độc lập; không tự gán membership cho ai.
- **Admin phải phân công rõ ràng vào LEGACY trước khi các kỹ sư tiếp tục công việc cũ.** Việc người dùng từng upload/tạo hồ sơ không tự cấp quyền dự án.

## Triển khai và khôi phục

1. Sao lưu database và storage, kiểm tra khả năng khôi phục. Rà soát policy bucket MinIO hiện có: phải private, không có anonymous GET hoặc đường proxy bỏ qua API.
2. Kiểm tra migration trên bản sao database và xác nhận danh sách thành viên LEGACY dự kiến. Triển khai backend và frontend tương thích trong cùng đợt bảo trì; cơ chế tự migrate khi khởi động hiện có vẫn áp dụng.
3. Nếu migration thất bại, dừng rollout, xem log và migration history; EF áp dụng migration trong transaction. Sửa nguyên nhân trên bản sao/khôi phục backup trước khi thử lại, không chỉnh dở schema bằng tay trên hệ thống đang ghi dữ liệu.
4. Sau khi thành công, Admin phân công LEGACY và kiểm tra upload/download, workflow duyệt, thu hồi bằng JWT đang còn hiệu lực và thông báo trên kết nối cũ.

Không tự chạy migration `Down` sau khi đã có dữ liệu/phân công mới: thao tác đó xóa metadata phân quyền. Nếu cần quay về phiên bản không hỗ trợ project, dừng ghi và khôi phục đồng bộ database/storage từ backup đã xác minh, tránh mở lại dữ liệu không còn được cô lập.

## Kiểm chứng khi phát triển

SQL tests dùng biến `CONSTRUCTION_TEST_SQL` trỏ tới server kiểm thử có quyền tạo database; mỗi test tạo database `ConstructionProject_Test_*` riêng. Không trỏ vào database ứng dụng.

```powershell
dotnet test tests/ConstructionProject.UnitTests/ConstructionProject.UnitTests.csproj
dotnet test tests/ConstructionProject.IntegrationTests/ConstructionProject.IntegrationTests.csproj
cd frontend
npm.cmd test
npm.cmd run lint
npm.cmd run build
```

Bản triển khai này được kiểm tra với 62 unit test backend, 68 integration test (bao gồm SQL Server, migration mới/cũ, workflow và concurrency), 38 test frontend; Docker build backend/frontend và kiểm tra HTTP/WebSocket trên stack SQL/MinIO riêng. Kiểm tra trực tiếp xác nhận tải file ẩn danh 401, chéo dự án/đã thu hồi 403 và MinIO anonymous GET 403. Không triển khai hay migrate database ứng dụng trong quá trình phát triển.
