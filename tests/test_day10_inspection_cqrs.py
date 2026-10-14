import sys
import json
import time
import subprocess
import requests

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

base_url = "http://localhost:5092"

print("=================================================================")
print("  KIỂM THỬ TỰ ĐỘNG: GIAI ĐOẠN 2 - NGÀY 10: CQRS FORM INSPECTION")
print("=================================================================\n")

# 1. Đăng nhập Admin
print("1. Đăng nhập Admin...")
res = requests.post(f"{base_url}/api/auth/login", json={"usernameOrEmail": "admin", "password": "Admin@123"})
assert res.status_code == 200, f"Login admin failed: {res.text}"
admin_token = res.json()["token"]
print("-> Đăng nhập Admin thành công.")

# 2. Lấy danh sách Roles để chuẩn bị tài khoản test
roles = requests.get(f"{base_url}/api/users/roles", headers={"Authorization": f"Bearer {admin_token}"}).json()
role_map = {r["name"]: r["id"] for r in roles}

def get_or_create_user(username, email, password, full_name, role_name):
    # Thử đăng nhập trước
    login_res = requests.post(f"{base_url}/api/auth/login", json={"usernameOrEmail": username, "password": password})
    if login_res.status_code == 200:
        token = login_res.json()["token"]
        user_info = login_res.json()["user"]
        if user_info.get("roleName") != role_name:
            requests.put(f"{base_url}/api/users/{user_info['id']}/role", json={"roleId": role_map[role_name]}, headers={"Authorization": f"Bearer {admin_token}"})
            token = requests.post(f"{base_url}/api/auth/login", json={"usernameOrEmail": username, "password": password}).json()["token"]
        return token, user_info["id"]

    # Đăng ký mới nếu chưa có
    reg_res = requests.post(f"{base_url}/api/auth/register", json={
        "username": username,
        "email": email,
        "password": password,
        "fullName": full_name
    })
    user_id = reg_res.json()["id"]
    
    # Kích hoạt EmailConfirmed trực tiếp cho môi trường test
    subprocess.run([
        "docker", "exec", "construction_db", 
        "/opt/mssql-tools18/bin/sqlcmd", "-S", "localhost", "-U", "sa", "-P", "YourStrong@Passw0rd123!", 
        "-C", "-d", "ConstructionProjectDb", 
        "-Q", f"UPDATE Users SET EmailConfirmed = 1 WHERE Id = '{user_id}'"
    ], capture_output=True)

    requests.put(f"{base_url}/api/users/{user_id}/role", json={"roleId": role_map[role_name]}, headers={"Authorization": f"Bearer {admin_token}"})
    login_res = requests.post(f"{base_url}/api/auth/login", json={"usernameOrEmail": username, "password": password})
    assert login_res.status_code == 200, f"Login {username} failed: {login_res.text}"
    return login_res.json()["token"], user_id

print("\n2. Chuẩn bị tài khoản Submitter và Reviewer...")
submitter_token, submitter_id = get_or_create_user("submitter_day10", "submitter10@test.com", "Password@123", "Kỹ Sư Hiện Trường Submitter", "Submitter")
reviewer_token, reviewer_id = get_or_create_user("reviewer_day10", "reviewer10@test.com", "Password@123", "Giám Sát Viên Reviewer", "Reviewer")
print("-> Submitter & Reviewer tokens sẵn sàng.")

# 3. Chuẩn bị Bản vẽ & Object cho Submitter
print("\n3. Chuẩn bị Bản vẽ và Object kiểm tra...")
with open("test_sample_drawing.pdf", "rb") as f:
    upload_res = requests.post(
        f"{base_url}/api/drawings/upload",
        files={"file": ("test_sample_drawing.pdf", f, "application/pdf")},
        data={"uploadedBy": "Submitter Day 10"},
        headers={"Authorization": f"Bearer {submitter_token}"}
    )
assert upload_res.status_code in [200, 201], f"Upload drawing failed: {upload_res.text}"
drawing_id = upload_res.json()["id"]

# Tạo Object trên bản vẽ
coords = json.dumps({"x": 100, "y": 200, "width": 50, "height": 50})
obj_res = requests.post(
    f"{base_url}/api/objects",
    json={
        "drawingFileId": drawing_id,
        "pageNumber": 1,
        "markerCoordinates": coords,
        "name": "Cột B01 - Nghiệm thu Cốt thép",
        "createdBy": "Submitter Day 10"
    },
    headers={"Authorization": f"Bearer {submitter_token}"}
)
assert obj_res.status_code in [200, 201], f"Create object failed: {obj_res.text}"
object_id = obj_res.json()["id"]
print(f"-> Đã tạo Object: {obj_res.json()['name']} (Id: {object_id})")

# 4. TEST: CreateInspectionCommand (Draft)
print("\n4. Test CreateInspectionCommand (Tạo bản ghi Draft)...")
create_insp_res = requests.post(
    f"{base_url}/api/inspections",
    json={
        "objectId": object_id,
        "formSchemaId": "default-inspection-schema",
        "formDataJson": "{}"
    },
    headers={"Authorization": f"Bearer {submitter_token}"}
)
print(f"Create Status: {create_insp_res.status_code}")
assert create_insp_res.status_code == 201, f"Tạo inspection thất bại: {create_insp_res.text}"
inspection = create_insp_res.json()
inspection_id = inspection["id"]
print(f"-> Tạo thành công Inspection ID: {inspection_id}")
print(f"-> Trạng thái ban đầu: {inspection['status']} (Kỳ vọng: Draft)")
assert inspection["status"] == "Draft"
assert inspection["objectId"] == object_id

# 5. TEST: Chặn tạo Inspection với ObjectId không tồn tại
print("\n5. Test chặn tạo Inspection khi ObjectId không tồn tại...")
invalid_insp_res = requests.post(
    f"{base_url}/api/inspections",
    json={"objectId": "00000000-0000-0000-0000-000000000000"},
    headers={"Authorization": f"Bearer {submitter_token}"}
)
print(f"Status mong đợi (404/400): {invalid_insp_res.status_code}")
assert invalid_insp_res.status_code in [400, 404]

# 6. TEST: UpdateInspectionDraftCommand
print("\n6. Test UpdateInspectionDraftCommand (Lưu nháp dữ liệu form)...")
draft_data = json.dumps({
    "inspectionTitle": "Kiểm tra cao độ và tim trục cốt thép",
    "notes": "Đang đo đạc thực địa"
})
update_res = requests.put(
    f"{base_url}/api/inspections/{inspection_id}",
    json={"formDataJson": draft_data},
    headers={"Authorization": f"Bearer {submitter_token}"}
)
print(f"Update Status: {update_res.status_code}")
assert update_res.status_code == 200
print(f"-> Dữ liệu nháp đã lưu: {update_res.json()['formDataJson']}")

# 7. TEST: SubmitInspectionCommand - Validate Schema khi gửi duyệt
print("\n7. Test SubmitInspectionCommand - Chặn submit khi thiếu trường bắt buộc...")
submit_invalid_res = requests.post(
    f"{base_url}/api/inspections/{inspection_id}/submit",
    json={"formDataJson": json.dumps({"inspectionTitle": "Chưa có kết quả"})},
    headers={"Authorization": f"Bearer {submitter_token}"}
)
print(f"Status mong đợi (400 Bad Request): {submit_invalid_res.status_code}")
assert submit_invalid_res.status_code == 400
print(f"Lỗi phản hồi: {submit_invalid_res.json().get('message') or submit_invalid_res.json()}")

print("\n8. Test SubmitInspectionCommand - Submit thành công với dữ liệu hợp lệ...")
valid_form_data = json.dumps({
    "inspectionTitle": "Nghiệm thu cốt thép cột B01",
    "inspectionDate": "2026-10-08 10:30 AM",
    "result": "pass",
    "technicalDetails": "Sai số khoảng cách đai thép trong giới hạn cho phép +/- 5mm",
    "notes": "Đạt yêu cầu chuyển bước thi công đổ bê tông"
})
submit_valid_res = requests.post(
    f"{base_url}/api/inspections/{inspection_id}/submit",
    json={"formDataJson": valid_form_data},
    headers={"Authorization": f"Bearer {submitter_token}"}
)
print(f"Submit Status: {submit_valid_res.status_code}")
assert submit_valid_res.status_code == 200
submitted_insp = submit_valid_res.json()
print(f"-> Trạng thái mới: {submitted_insp['status']} (Kỳ vọng: Submitted)")
assert submitted_insp["status"] == "Submitted"
assert submitted_insp["submittedAt"] is not None

# 9. TEST: Business Rule - Không được sửa sau khi đã Submitted
print("\n9. Test Business Rule - Chặn sửa sau khi hồ sơ đã Submitted...")
modify_after_submit = requests.put(
    f"{base_url}/api/inspections/{inspection_id}",
    json={"formDataJson": "{}"},
    headers={"Authorization": f"Bearer {submitter_token}"}
)
print(f"Status mong đợi (400 Bad Request): {modify_after_submit.status_code}")
assert modify_after_submit.status_code == 400

# 10. TEST: GetInspectionsQuery (Bộ lọc & Phân trang)
print("\n10. Test GetInspectionsQuery (Lọc theo Object, Status, Phân trang)...")
# Lọc theo ObjectId
get_by_obj = requests.get(
    f"{base_url}/api/inspections?objectId={object_id}",
    headers={"Authorization": f"Bearer {submitter_token}"}
).json()
print(f"Tổng số hồ sơ cho Object: {get_by_obj['totalCount']}")
assert get_by_obj['totalCount'] >= 1

# Lọc theo Status Submitted
get_by_status = requests.get(
    f"{base_url}/api/inspections?status=Submitted",
    headers={"Authorization": f"Bearer {reviewer_token}"}
).json()
print(f"Hồ sơ ở trạng thái Submitted: {get_by_status['totalCount']}")
assert any(i["id"] == inspection_id for i in get_by_status["items"])

# 11. TEST: GetInspectionByIdQuery
print("\n11. Test GetInspectionByIdQuery (Lấy chi tiết hồ sơ)...")
detail_res = requests.get(
    f"{base_url}/api/inspections/{inspection_id}",
    headers={"Authorization": f"Bearer {reviewer_token}"}
)
assert detail_res.status_code == 200
detail = detail_res.json()
print(f"Chi tiết: ID={detail['id']}, Object={detail['objectName']}, Status={detail['status']}, SubmittedBy={detail['submittedBy']}")
assert detail["objectName"] == "Cột B01 - Nghiệm thu Cốt thép"
assert detail["drawingFileName"] == "test_sample_drawing.pdf"

# 12. TEST: Get FormIO Schema
print("\n12. Test Lấy schema FormIO JSON qua API...")
schema_res = requests.get(
    f"{base_url}/api/inspections/schema",
    headers={"Authorization": f"Bearer {submitter_token}"}
)
assert schema_res.status_code == 200
schema_data = schema_res.json()
print(f"Schema display: {schema_data.get('display')}, Số components: {len(schema_data.get('components', []))}")
assert "components" in schema_data

# 13. TEST: Delete Draft Inspection
print("\n13. Test Xóa bản nháp Draft...")
# Tạo 1 draft tạm thời
temp_draft = requests.post(
    f"{base_url}/api/inspections",
    json={"objectId": object_id},
    headers={"Authorization": f"Bearer {submitter_token}"}
).json()
temp_id = temp_draft["id"]

# Xóa draft
del_res = requests.delete(
    f"{base_url}/api/inspections/{temp_id}",
    headers={"Authorization": f"Bearer {submitter_token}"}
)
print(f"Delete Status (204): {del_res.status_code}")
assert del_res.status_code == 204

# Thử xóa hồ sơ đã Submitted -> phải bị chặn 400
del_submitted_res = requests.delete(
    f"{base_url}/api/inspections/{inspection_id}",
    headers={"Authorization": f"Bearer {submitter_token}"}
)
print(f"Delete Submitted Status (Mong đợi 400): {del_submitted_res.status_code}")
assert del_submitted_res.status_code == 400

# 14. TEST: Phân quyền - Reviewer không được tạo Inspection
print("\n14. Test Phân quyền: Reviewer tạo Inspection -> Phải bị chặn 403 Forbidden...")
reviewer_forbidden_res = requests.post(
    f"{base_url}/api/inspections",
    json={"objectId": object_id},
    headers={"Authorization": f"Bearer {reviewer_token}"}
)
print(f"Status (Mong đợi: 403 Forbidden): {reviewer_forbidden_res.status_code}")
assert reviewer_forbidden_res.status_code == 403

print("\n=================================================================")
print("  TẤT CẢ CÁC KIỂM THỬ GIAI ĐOẠN 2 - NGÀY 10 ĐÃ PASS 100%!")
print("=================================================================")
