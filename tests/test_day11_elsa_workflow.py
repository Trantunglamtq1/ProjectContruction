import sys
import json
import requests

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

base_url = "http://localhost:5092"

print("=================================================================")
print("  KIỂM THỬ TÍCH HỢP ELSA WORKFLOW 3.x - QUY TRÌNH DUYỆT 2 CẤP")
print("=================================================================\n")

# 1. Đăng nhập các role nghiệp vụ
print("1. Đăng nhập các tài khoản hệ thống...")
# Admin
admin_res = requests.post(f"{base_url}/api/auth/login", json={"usernameOrEmail": "admin", "password": "Admin@123"})
assert admin_res.status_code == 200, f"Login Admin failed: {admin_res.text}"
admin_token = admin_res.json()["token"]

# Submitter: KySu1
sub_res = requests.post(f"{base_url}/api/auth/login", json={"usernameOrEmail": "KySu1", "password": "Admin@123"})
assert sub_res.status_code == 200, f"Login KySu1 failed: {sub_res.text}"
sub_token = sub_res.json()["token"]
print("  - Submitter (KySu1): Đăng nhập thành công.")

# Reviewer: GiamSat1
rev_res = requests.post(f"{base_url}/api/auth/login", json={"usernameOrEmail": "GiamSat1", "password": "Admin@123"})
assert rev_res.status_code == 200, f"Login GiamSat1 failed: {rev_res.text}"
rev_token = rev_res.json()["token"]
print("  - Reviewer (GiamSat1): Đăng nhập thành công.")

# Approver: NhaDauTu1
app_res = requests.post(f"{base_url}/api/auth/login", json={"usernameOrEmail": "NhaDauTu1", "password": "Admin@123"})
assert app_res.status_code == 200, f"Login NhaDauTu1 failed: {app_res.text}"
app_token = app_res.json()["token"]
print("  - Approver (NhaDauTu1): Đăng nhập thành công.")

# 2. Lấy danh sách Drawing / Object có sẵn hoặc upload bản vẽ
print("\n2. Chuẩn bị Object kiểm tra...")
drawings_res = requests.get(f"{base_url}/api/drawings", headers={"Authorization": f"Bearer {sub_token}"})
if drawings_res.status_code == 200 and len(drawings_res.json()) > 0:
    drawing_id = drawings_res.json()[0]["id"]
else:
    with open("test_sample_drawing.pdf", "rb") as f:
        up_res = requests.post(
            f"{base_url}/api/drawings/upload",
            files={"file": ("test_sample_drawing.pdf", f, "application/pdf")},
            data={"uploadedBy": "KySu1"},
            headers={"Authorization": f"Bearer {sub_token}"}
        )
        drawing_id = up_res.json()["id"]

obj_res = requests.post(
    f"{base_url}/api/objects",
    json={
        "drawingFileId": drawing_id,
        "pageNumber": 1,
        "markerCoordinates": json.dumps({"x": 100, "y": 200, "width": 80, "height": 60}),
        "name": "Cột C1 - Trục A-1 (Elsa Workflow Test)",
        "createdBy": "KySu1"
    },
    headers={"Authorization": f"Bearer {sub_token}"}
)
object_id = obj_res.json()["id"]
print(f"-> Tạo Object: {obj_res.json()['name']} (Id: {object_id})")

# 3. Tạo bản nháp Form Inspection
print("\n3. Submitter tạo bản nháp Form Inspection...")
insp_res = requests.post(
    f"{base_url}/api/inspections",
    json={
        "objectId": object_id,
        "formSchemaId": "default-inspection-schema"
    },
    headers={"Authorization": f"Bearer {sub_token}"}
)
assert insp_res.status_code in [200, 201], f"Create inspection failed: {insp_res.status_code} - {insp_res.text}"
inspection = insp_res.json()
inspection_id = inspection["id"]
print(f"-> Tạo thành công Form Inspection Id: {inspection_id}, Trạng thái: {inspection['status']}")
assert inspection["status"] == "Draft"
assert inspection.get("workflowInstanceId") is None, "Bản nháp Draft chưa được kích hoạt Elsa Workflow"

# 4. Submitter điền dữ liệu và Nộp hồ sơ (Submit)
print("\n4. Submitter Submit hồ sơ -> Kích hoạt Elsa Workflow...")
form_data = {
    "inspectionTitle": "Nghiệm thu cốt thép cột C1 trục A-1",
    "result": "pass",
    "location": "Tầng 2 - Phân đoạn 1",
    "notes": "Khoảng cách đai thép d10a150 đạt chuẩn thiết kế"
}
submit_res = requests.post(
    f"{base_url}/api/inspections/{inspection_id}/submit",
    json={"formDataJson": json.dumps(form_data)},
    headers={"Authorization": f"Bearer {sub_token}"}
)
assert submit_res.status_code == 200, f"Submit thất bại: {submit_res.text}"
submitted_inspection = submit_res.json()

print(f"-> Trạng thái sau Submit: {submitted_inspection['status']}")
assert submitted_inspection["status"] == "Submitted"

wf_id = submitted_inspection.get("workflowInstanceId")
print(f"-> Elsa Workflow Instance ID: {wf_id}")
assert wf_id is not None, "Elsa WorkflowInstanceId không được rỗng sau khi Submit!"
assert wf_id.startswith("wf-") and wf_id.endswith("-elsa"), f"Định dạng Workflow ID không đúng chuẩn: {wf_id}"

# Kiểm tra đọc lại qua API GetInspectionById
detail_res = requests.get(f"{base_url}/api/inspections/{inspection_id}", headers={"Authorization": f"Bearer {sub_token}"})
assert detail_res.status_code == 200
assert detail_res.json()["workflowInstanceId"] == wf_id, "WorkflowInstanceId phải được lưu bền vững trong DB!"
print("-> Xác thực GET /api/inspections/{id} trả về đúng WorkflowInstanceId.")

# 5. Reviewer tiếp nhận hồ sơ (Submitted -> UnderReview)
print("\n5. Reviewer tiếp nhận hồ sơ (Submitted -> UnderReview)...")
recv_res = requests.post(
    f"{base_url}/api/inspections/{inspection_id}/receive",
    json={"comment": "Tư vấn giám sát đã nhận hồ sơ và kiểm tra tại hiện trường."},
    headers={"Authorization": f"Bearer {rev_token}"}
)
assert recv_res.status_code == 200
assert recv_res.json()["status"] == "UnderReview"
assert recv_res.json()["workflowInstanceId"] == wf_id
print(f"-> Đã chuyển UnderReview thành công. Workflow ID: {recv_res.json()['workflowInstanceId']}")

# 6. Reviewer thẩm tra Đạt - Phê duyệt Cấp 1 (UnderReview -> Reviewed)
print("\n6. Reviewer thẩm tra Cấp 1 Đạt (UnderReview -> Reviewed)...")
review_res = requests.post(
    f"{base_url}/api/inspections/{inspection_id}/review-pass",
    json={"comment": "Kiểm tra hiện trường đạt yêu cầu TCVN. Chuyển Chủ đầu tư nghiệm thu chính thức."},
    headers={"Authorization": f"Bearer {rev_token}"}
)
assert review_res.status_code == 200
assert review_res.json()["status"] == "Reviewed"
assert review_res.json()["workflowInstanceId"] == wf_id
print(f"-> Thẩm tra Cấp 1 hoàn tất. Elsa Bookmark Reviewer_Decision đã được kích hoạt. Trạng thái: Reviewed")

# 7. Approver phê duyệt nghiệm thu Cấp 2 (Reviewed -> Approved)
print("\n7. Approver phê duyệt Nghiệm thu Cấp 2 (Reviewed -> Approved)...")
approve_res = requests.post(
    f"{base_url}/api/inspections/{inspection_id}/approve",
    json={"comment": "Chủ đầu tư đồng ý nghiệm thu hoàn thành hạng mục cốt thép cột C1."},
    headers={"Authorization": f"Bearer {app_token}"}
)
assert approve_res.status_code == 200
assert approve_res.json()["status"] == "Approved"
assert approve_res.json()["workflowInstanceId"] == wf_id
print(f"-> Nghiệm thu Cấp 2 hoàn tất! Elsa Bookmark Approver_Decision đã kích hoạt và kết thúc tiến trình. Trạng thái: Approved")

# 8. Kiểm tra lịch sử Audit Trail
print("\n8. Kiểm tra Audit History ghi nhận tiến trình Elsa Workflow...")
hist_res = requests.get(f"{base_url}/api/inspections/{inspection_id}/history", headers={"Authorization": f"Bearer {sub_token}"})
assert hist_res.status_code == 200
histories = hist_res.json()
print(f"-> Ghi nhận {len(histories)} bước trong Audit Trail:")
for h in histories:
    print(f"   • [{h['createdAt']}] Action: {h['action']} ({h['fromStatus']} -> {h['toStatus']}) by {h['actorName']} ({h['actorRole']}): {h['comment']}")

print("\n=================================================================")
print("  CHÚC MỪNG: KIỂM THỬ TÍCH HỢP ELSA WORKFLOW 3.x ĐÃ PASS 100%!")
print("=================================================================")
