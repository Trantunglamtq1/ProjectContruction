import sys
import json
import time
import subprocess
import requests

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

base_url = "http://localhost:5092"

print("=================================================================")
print("  KIỂM THỬ TỰ ĐỘNG: GIAI ĐOẠN 2 - NGÀY 11: WORKFLOW & PHÊ DUYỆT")
print("=================================================================\n")

# 1. Đăng nhập Admin
print("1. Đăng nhập Admin...")
res = requests.post(f"{base_url}/api/auth/login", json={"usernameOrEmail": "admin", "password": "Admin@123"})
assert res.status_code == 200, f"Login admin failed: {res.text}"
admin_token = res.json()["token"]
print("-> Đăng nhập Admin thành công.")

roles = requests.get(f"{base_url}/api/users/roles", headers={"Authorization": f"Bearer {admin_token}"}).json()
role_map = {r["name"]: r["id"] for r in roles}

def get_or_create_user(username, email, password, full_name, role_name):
    login_res = requests.post(f"{base_url}/api/auth/login", json={"usernameOrEmail": username, "password": password})
    if login_res.status_code == 200:
        token = login_res.json()["token"]
        user_info = login_res.json()["user"]
        if user_info.get("roleName") != role_name:
            requests.put(f"{base_url}/api/users/{user_info['id']}/role", json={"roleId": role_map[role_name]}, headers={"Authorization": f"Bearer {admin_token}"})
            token = requests.post(f"{base_url}/api/auth/login", json={"usernameOrEmail": username, "password": password}).json()["token"]
        return token, user_info["id"]

    reg_res = requests.post(f"{base_url}/api/auth/register", json={
        "username": username,
        "email": email,
        "password": password,
        "fullName": full_name
    })
    user_id = reg_res.json()["id"]
    
    # Tự động kích hoạt email xác nhận trực tiếp trong DB cho môi trường test
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

print("\n2. Chuẩn bị 3 tài khoản nghiệp vụ: Submitter, Reviewer, Approver...")
submitter_token, submitter_id = get_or_create_user("submitter_day11", "submitter11@test.com", "Password@123", "Kỹ Sư Hiện Trường Submitter", "Submitter")
reviewer_token, reviewer_id = get_or_create_user("reviewer_day11", "reviewer11@test.com", "Password@123", "Giám Sát Viên Reviewer", "Reviewer")
approver_token, approver_id = get_or_create_user("approver_day11", "approver11@test.com", "Password@123", "Chủ Đầu Tư Approver", "Approver")
print("-> Toàn bộ 3 tokens nghiệp vụ sẵn sàng.")

# 3. Chuẩn bị Bản vẽ & Object cho Submitter
print("\n3. Chuẩn bị Bản vẽ và Object...")
with open("test_sample_drawing.pdf", "rb") as f:
    upload_res = requests.post(
        f"{base_url}/api/drawings/upload",
        files={"file": ("test_sample_drawing.pdf", f, "application/pdf")},
        data={"uploadedBy": "Submitter Day 11"},
        headers={"Authorization": f"Bearer {submitter_token}"}
    )
drawing_id = upload_res.json()["id"]

obj_res = requests.post(
    f"{base_url}/api/objects",
    json={
        "drawingFileId": drawing_id,
        "pageNumber": 1,
        "markerCoordinates": json.dumps({"x": 150, "y": 250, "width": 80, "height": 60}),
        "name": "Dầm D10 - Tầng 2 (Workflow Test)",
        "createdBy": "Submitter Day 11"
    },
    headers={"Authorization": f"Bearer {submitter_token}"}
)
object_id = obj_res.json()["id"]
print(f"-> Tạo thành công Object: {obj_res.json()['name']} ({object_id})")

# 4. Tạo và nộp Form Inspection
print("\n4. Submitter tạo Form Inspection và nộp hồ sơ...")
insp_res = requests.post(
    f"{base_url}/api/inspections",
    json={"objectId": object_id, "formSchemaId": "concrete-inspection-schema"},
    headers={"Authorization": f"Bearer {submitter_token}"}
)
inspection_id = insp_res.json()["id"]

# Nộp hồ sơ
submit_payload = json.dumps({
    "inspectionTitle": "Nghiệm thu đổ bê tông Dầm D10",
    "concreteGrade": "B30 (M400)",
    "slumpValue": 12,
    "temperature": 31,
    "testSampleCount": 3,
    "result": "pass",
    "notes": "Xe bồn số 5 đạt độ sụt 12cm, tiến hành đổ"
})
submit_res = requests.post(
    f"{base_url}/api/inspections/{inspection_id}/submit",
    json={"formDataJson": submit_payload},
    headers={"Authorization": f"Bearer {submitter_token}"}
)
assert submit_res.status_code == 200
assert submit_res.json()["status"] == "Submitted"
print("-> Đã Submit thành công. Trạng thái: Submitted")

# 5. TEST: State Guard - Approver không được duyệt thẳng khi chưa qua Reviewer
print("\n5. Test State Guard: Approver duyệt thẳng từ trạng thái 'Submitted' -> Phải bị chặn 400...")
premature_approve = requests.post(
    f"{base_url}/api/inspections/{inspection_id}/approve",
    json={"comment": "Duyệt nhanh"},
    headers={"Authorization": f"Bearer {approver_token}"}
)
print(f"Status (Mong đợi: 400 Bad Request): {premature_approve.status_code}")
assert premature_approve.status_code == 400

# 6. TEST: Reviewer tiếp nhận hồ sơ (Submitted -> UnderReview)
print("\n6. Test Reviewer tiếp nhận hồ sơ (Submitted -> UnderReview)...")
receive_res = requests.post(
    f"{base_url}/api/inspections/{inspection_id}/receive",
    json={"comment": "Giám sát tiếp nhận và kiểm tra kết quả thí nghiệm tại hiện trường."},
    headers={"Authorization": f"Bearer {reviewer_token}"}
)
print(f"Receive Status: {receive_res.status_code}")
assert receive_res.status_code == 200
assert receive_res.json()["status"] == "UnderReview"
print("-> Đã chuyển sang UnderReview thành công.")

# 7. TEST: Luồng từ chối (Reject) và Resubmit trên 1 hồ sơ khác
print("\n7. Test luồng Từ chối (Reject) kèm lý do và Nộp lại (Resubmit)...")
temp_insp = requests.post(
    f"{base_url}/api/inspections",
    json={"objectId": object_id},
    headers={"Authorization": f"Bearer {submitter_token}"}
).json()
temp_id = temp_insp["id"]
requests.post(
    f"{base_url}/api/inspections/{temp_id}/submit",
    json={"formDataJson": json.dumps({"inspectionTitle": "Test Reject", "result": "fail"})},
    headers={"Authorization": f"Bearer {submitter_token}"}
)
requests.post(f"{base_url}/api/inspections/{temp_id}/receive", headers={"Authorization": f"Bearer {reviewer_token}"})

# Reviewer từ chối
reject_res = requests.post(
    f"{base_url}/api/inspections/{temp_id}/reject",
    json={"reason": "Độ sụt không đạt thiết kế (đo được 18cm > tiêu chuẩn 12cm)"},
    headers={"Authorization": f"Bearer {reviewer_token}"}
)
assert reject_res.status_code == 200
rejected_data = reject_res.json()
assert rejected_data["status"] == "Rejected"
assert "Độ sụt không đạt" in rejected_data["rejectReason"]
print(f"-> Từ chối thành công, Lý do: {rejected_data['rejectReason']}")

# Submitter nộp lại (Resubmit)
resubmit_res = requests.post(
    f"{base_url}/api/inspections/{temp_id}/submit",
    json={"formDataJson": json.dumps({"inspectionTitle": "Test Reject (Khắc phục)", "result": "pass"})},
    headers={"Authorization": f"Bearer {submitter_token}"}
)
assert resubmit_res.status_code == 200
assert resubmit_res.json()["status"] == "Submitted"
assert resubmit_res.json().get("rejectReason") is None
print("-> Submitter đã Resubmit thành công. Lý do từ chối đã được xóa sạch.")

# 8. TEST: Reviewer thẩm tra Đạt - Phê duyệt Cấp 1 (UnderReview -> Reviewed)
print("\n8. Test Reviewer thẩm tra Đạt - Phê duyệt Cấp 1 (UnderReview -> Reviewed)...")
pass_res = requests.post(
    f"{base_url}/api/inspections/{inspection_id}/review-pass",
    json={"comment": "Các thông số kỹ thuật độ sụt, nhiệt độ hỗn hợp bê tông đều đạt TCVN 9345."},
    headers={"Authorization": f"Bearer {reviewer_token}"}
)
assert pass_res.status_code == 200
assert pass_res.json()["status"] == "Reviewed"
print("-> Phê duyệt Cấp 1 thành công. Trạng thái: Reviewed")

# 9. Chuẩn bị ChecklistItem liên kết để test Side-Effect khi Approver duyệt
print("\n9. Chuẩn bị ChecklistItem liên kết trực tiếp với Inspection này...")
# Chèn 1 checklist và 1 checklist item liên kết bằng SQL để test tính năng đồng bộ tự động
item_id = "11111111-2222-3333-4444-555555555555"
chk_id = "66666666-7777-8888-9999-000000000000"
sql_script = f"""
IF NOT EXISTS (SELECT 1 FROM Checklists WHERE Id = '{chk_id}')
BEGIN
    INSERT INTO Checklists (Id, ObjectId, Name, Status, CreatedBy, CreatedAt)
    VALUES ('{chk_id}', '{object_id}', 'Checklist Nghiệm thu Bê tông', 'Open', 'Reviewer', GETUTCDATE());
END

DELETE FROM ChecklistItems WHERE Id = '{item_id}';
INSERT INTO ChecklistItems (Id, ChecklistId, Name, IsRequired, LinkedInspectionId, Status)
VALUES ('{item_id}', '{chk_id}', 'Tiêu chí 1: Độ sụt và chất lượng bê tông tươi', 1, '{inspection_id}', 'Pending');
"""
subprocess.run([
    "docker", "exec", "construction_db", 
    "/opt/mssql-tools18/bin/sqlcmd", "-S", "localhost", "-U", "sa", "-P", "YourStrong@Passw0rd123!", 
    "-C", "-d", "ConstructionProjectDb", 
    "-Q", sql_script
], capture_output=True)
print("-> Đã chuẩn bị ChecklistItem ở trạng thái: Pending")

# 10. TEST: Approver Phê duyệt Nghiệm thu Cấp 2 (Reviewed -> Approved)
print("\n10. Test Approver Phê duyệt Nghiệm thu Cấp 2 & Tự động đồng bộ ChecklistItem sang 'Done'...")
approve_res = requests.post(
    f"{base_url}/api/inspections/{inspection_id}/approve",
    json={"comment": "Chủ đầu tư đồng ý nghiệm thu hoàn thành công tác đổ bê tông Dầm D10."},
    headers={"Authorization": f"Bearer {approver_token}"}
)
assert approve_res.status_code == 200
assert approve_res.json()["status"] == "Approved"
print("-> Phê duyệt Cấp 2 hoàn tất! Trạng thái: Approved")

# Kiểm tra ChecklistItem liên kết có tự động chuyển 'Done' không
chk_check_cmd = f"SELECT Status FROM ChecklistItems WHERE Id = '{item_id}'"
chk_res_out = subprocess.run([
    "docker", "exec", "construction_db", 
    "/opt/mssql-tools18/bin/sqlcmd", "-S", "localhost", "-U", "sa", "-P", "YourStrong@Passw0rd123!", 
    "-C", "-d", "ConstructionProjectDb", 
    "-Q", chk_check_cmd
], capture_output=True, text=True).stdout
print(f"Trạng thái ChecklistItem trong DB sau khi Approve:\n{chk_res_out}")
assert "Done" in chk_res_out, "ChecklistItem KHÔNG chuyển sang Done sau khi Approve!"
print("-> XÁC NHẬN: ChecklistItem liên kết đã tự động chuyển sang 'Done'!")

# 11. TEST: Lấy toàn bộ lịch sử luồng duyệt (Audit Trail)
print("\n11. Test Lấy toàn bộ lịch sử luồng duyệt (Audit Trail)...")
history_res = requests.get(
    f"{base_url}/api/inspections/{inspection_id}/history",
    headers={"Authorization": f"Bearer {reviewer_token}"}
)
assert history_res.status_code == 200
histories = history_res.json()
print(f"Tổng số bước audit ghi nhận: {len(histories)}")
for h in histories:
    print(f"  - [{h['createdAt']}] Hành động: {h['action']} ({h['fromStatus']} -> {h['toStatus']}) | Người thực hiện: {h['actorName']} ({h['actorRole']})")
actions = [h["action"] for h in histories]
assert "CreateDraft" in actions
assert "Submit" in actions
assert "Receive" in actions
assert "ReviewPass" in actions
assert "Approve" in actions

# 12. TEST: Lấy danh sách mẫu FormIO schemas
print("\n12. Test Lấy danh mục các mẫu FormIO schemas...")
schemas_res = requests.get(f"{base_url}/api/inspections/schemas", headers={"Authorization": f"Bearer {submitter_token}"})
assert schemas_res.status_code == 200
schemas_list = schemas_res.json()
print(f"Số lượng mẫu biểu mẫu có sẵn: {len(schemas_list)}")
for s in schemas_list:
    print(f"  - [{s['id']}] {s['name']} (Nhóm: {s['category']}, {s['componentsCount']} trường)")
assert len(schemas_list) >= 3

print("\n=================================================================")
print("  TẤT CẢ KIỂM THỬ WORKFLOW & PHÊ DUYỆT (NGÀY 11) ĐÃ PASS 100%!")
print("=================================================================")
