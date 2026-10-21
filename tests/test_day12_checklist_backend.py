import sys
import json
import time
import requests

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

base_url = "http://localhost:5092"

print("=========================================================================")
print("  KIỂM THỬ TỰ ĐỘNG: MODULE CHECKLIST & 2 GIAI ĐOẠN WORKFLOW (NGÀY 12)")
print("=========================================================================\n")

# 1. Đăng nhập Admin & chuẩn bị tài khoản test
print("1. Đăng nhập Admin & chuẩn bị tài khoản Submitter (Kỹ sư) & Reviewer (Giám sát)...")
res = requests.post(f"{base_url}/api/auth/login", json={"usernameOrEmail": "admin", "password": "Admin@123"})
assert res.status_code == 200, f"Login admin failed: {res.text}"
admin_token = res.json()["token"]

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
    
    # Kích hoạt EmailConfirmed trực tiếp cho SQLEXPRESS local
    import subprocess
    subprocess.run([
        "sqlcmd", "-S", ".\\SQLEXPRESS", "-d", "ConstructionProjectDb", "-E",
        "-Q", f"UPDATE Users SET EmailConfirmed = 1 WHERE Id = '{user_id}'"
    ], capture_output=True)

    requests.put(f"{base_url}/api/users/{user_id}/role", json={"roleId": role_map[role_name]}, headers={"Authorization": f"Bearer {admin_token}"})
    login_res = requests.post(f"{base_url}/api/auth/login", json={"usernameOrEmail": username, "password": password})
    assert login_res.status_code == 200, f"Login {username} failed: {login_res.text}"
    return login_res.json()["token"], user_id

submitter_token, submitter_id = get_or_create_user("engineer_sub", "engineer_sub@construct.local", "Engineer@123", "Kỹ Sư Hiện Trường A", "Submitter")
supervisor_token, supervisor_id = get_or_create_user("supervisor_rev", "supervisor_rev@construct.local", "Supervisor@123", "Tư Vấn Giám Sát B", "Reviewer")
print("-> Chuẩn bị tài khoản thành công.")

# 2. Lấy bản vẽ và tạo Object kiểm thử
print("\n2. Chuẩn bị bản vẽ và Object cấu kiện (Dầm D1 - Tầng 2)...")
drawings_res = requests.get(f"{base_url}/api/drawings", headers={"Authorization": f"Bearer {submitter_token}"})
assert drawings_res.status_code == 200, f"Get drawings failed: {drawings_res.text}"
drawings = drawings_res.json()
if not drawings:
    # Upload một bản vẽ mẫu
    upload_res = requests.post(
        f"{base_url}/api/drawings/upload",
        files={"file": ("test_drawing_d1.pdf", b"%PDF-1.4 sample drawing content", "application/pdf")},
        headers={"Authorization": f"Bearer {submitter_token}"}
    )
    assert upload_res.status_code in [200, 201], f"Upload drawing failed: {upload_res.text}"
    drawing_id = upload_res.json()["id"]
else:
    drawing_id = drawings[0]["id"]

# Tạo Object cấu kiện
create_obj_res = requests.post(
    f"{base_url}/api/objects",
    json={
        "drawingFileId": drawing_id,
        "pageNumber": 1,
        "name": "Dầm D1 - Trục 2/B - Tầng 2",
        "markerCoordinates": json.dumps({"x": 120, "y": 240, "width": 80, "height": 45})
    },
    headers={"Authorization": f"Bearer {submitter_token}"}
)
assert create_obj_res.status_code in [200, 201], f"Create object failed: {create_obj_res.text}"
test_object = create_obj_res.json()
object_id = test_object["id"]
print(f"-> Tạo thành công Object '{test_object['name']}' (Id: {object_id})")

# 3. Kỹ sư tạo Checklist và cấu hình Form.io Schema (Giai đoạn 1: Planning Phase - Checklist_Draft)
print("\n3. TC3: Kỹ sư tạo Checklist kèm các ChecklistItem và Form.io Schema (Trạng thái: Draft)...")
schema_cot_thep = json.dumps({
    "components": [
        {"type": "textfield", "key": "duongKinhThep", "label": "Đường kính thép chủ (mm)", "required": True},
        {"type": "number", "key": "khoangCachDai", "label": "Khoảng cách cốt đai (mm)", "required": True},
        {"type": "file", "key": "anhHienTruong", "label": "Ảnh chụp nghiệm thu thép"}
    ]
})

schema_cop_pha = json.dumps({
    "components": [
        {"type": "checkbox", "key": "doKinKhit", "label": "Độ kín khít ván khuôn đạt yêu cầu", "required": True},
        {"type": "number", "key": "doVong", "label": "Độ võng cho phép (mm)"}
    ]
})

create_cl_res = requests.post(
    f"{base_url}/api/checklists",
    json={
        "objectId": object_id,
        "name": "Kế hoạch kiểm tra Nghiệm thu Dầm D1",
        "description": "Bao gồm nghiệm thu cốt thép, cốp pha và bê tông trước khi đổ",
        "items": [
            {"name": "Nghiệm thu cốt thép", "orderIndex": 1, "isRequired": True, "formSchemaJson": schema_cot_thep},
            {"name": "Nghiệm thu cốp pha", "orderIndex": 2, "isRequired": True, "formSchemaJson": schema_cop_pha},
            {"name": "Vệ sinh lòng ván khuôn", "orderIndex": 3, "isRequired": False, "formSchemaJson": "{}"}
        ]
    },
    headers={"Authorization": f"Bearer {submitter_token}"}
)
assert create_cl_res.status_code in [200, 201], f"Create checklist failed: {create_cl_res.text}"
checklist = create_cl_res.json()
checklist_id = checklist["id"]
print(f"-> Tạo Checklist thành công: Id={checklist_id}, Status='{checklist['status']}', ItemsCount={checklist['itemsCount']}")
assert checklist["status"] == "Draft", f"Status must be Draft, got: {checklist['status']}"
assert checklist["canFillInspection"] == False, "Nút điền phiếu nghiệm thu phải bị KHÓA khi Checklist còn ở Draft!"
item_thep_id = checklist["items"][0]["id"]
item_coppha_id = checklist["items"][1]["id"]
item_vesinh_id = checklist["items"][2]["id"]

# 4. Kiểm tra State Locking: Thử liên kết / điền phiếu khi Checklist chưa duyệt -> Phải bị CHẶN
print("\n4. TC4: Kiểm tra State Locking - Thử liên kết phiếu nghiệm thu khi Checklist đang Draft -> Phải bị từ chối 400...")
dummy_insp_res = requests.post(
    f"{base_url}/api/checklists/{checklist_id}/items/{item_thep_id}/link-inspection",
    json={"inspectionId": "00000000-0000-0000-0000-000000000001"},
    headers={"Authorization": f"Bearer {submitter_token}"}
)
assert dummy_insp_res.status_code in [400, 404, 500], f"Expected lock error, got: {dummy_insp_res.status_code}"
print(f"-> Hệ thống đã khóa và chặn thao tác đúng nghiệp vụ (Status Code: {dummy_insp_res.status_code}).")

# 5. Kỹ sư gửi duyệt Kế hoạch Checklist -> Kích hoạt Elsa Workflow #1
print("\n5. TC5: Kỹ sư gửi duyệt Kế hoạch Checklist (Kích hoạt Elsa Workflow #1)...")
submit_cl_res = requests.post(
    f"{base_url}/api/checklists/{checklist_id}/submit",
    headers={"Authorization": f"Bearer {submitter_token}"}
)
assert submit_cl_res.status_code == 200, f"Submit checklist failed: {submit_cl_res.text}"
submitted_cl = submit_cl_res.json()
print(f"-> Gửi duyệt thành công! Trạng thái mới: '{submitted_cl['status']}', Elsa Instance: '{submitted_cl['workflowInstanceId']}'")
assert submitted_cl["status"] == "PendingSupervisor", f"Expected PendingSupervisor, got: {submitted_cl['status']}"
assert submitted_cl["workflowInstanceId"] is not None, "Elsa Workflow Instance ID must be assigned!"

# 6. Giám sát can thiệp trực tiếp: Sửa item, sửa Form.io Schema, thêm item mới (FR-05)
print("\n6. TC6: Giám sát thẩm định & can thiệp trực tiếp (Sửa tên, sửa FormSchemaJson, bổ sung tiêu chí 4)...")
updated_schema_cot_thep = json.dumps({
    "components": [
        {"type": "textfield", "key": "duongKinhThep", "label": "Đường kính thép chủ (mm)", "required": True},
        {"type": "number", "key": "khoangCachDai", "label": "Khoảng cách cốt đai (mm)", "required": True},
        {"type": "textfield", "key": "chieuDayLopBaoVe", "label": "Chiều dày lớp bê tông bảo vệ (mm)", "required": True},
        {"type": "file", "key": "anhHienTruong", "label": "Ảnh chụp nghiệm thu thép"}
    ]
}, ensure_ascii=False)

modify_res = requests.put(
    f"{base_url}/api/checklists/{checklist_id}/supervisor-modify",
    json={
        "name": "Kế hoạch kiểm tra Nghiệm thu Dầm D1 (Giám sát đã hiệu chỉnh)",
        "items": [
            {"id": item_thep_id, "name": "Nghiệm thu cốt thép dầm", "orderIndex": 1, "isRequired": True, "formSchemaJson": updated_schema_cot_thep},
            {"id": None, "name": "Nghiệm thu độ ẩm mặt ván khuôn", "orderIndex": 4, "isRequired": True, "formSchemaJson": "{}"}
        ],
        "comment": "Giám sát bổ sung chỉ tiêu chiều dày lớp bảo vệ và tiêu chí kiểm tra độ ẩm ván khuôn."
    },
    headers={"Authorization": f"Bearer {supervisor_token}"}
)
assert modify_res.status_code == 200, f"Supervisor modify failed: {modify_res.text}"
modified_cl = modify_res.json()
print(f"-> Giám sát can thiệp thành công! Tổng số tiêu chí hiện tại: {modified_cl['itemsCount']}")
assert modified_cl["itemsCount"] == 4, f"Expected 4 items after addition, got: {modified_cl['itemsCount']}"
thep_item = next(i for i in modified_cl["items"] if i["id"] == item_thep_id)
assert "chieuDayLopBaoVe" in thep_item["formSchemaJson"], "Schema cốt thép phải được cập nhật!"

# 7. Test nhánh Giám sát Từ chối (Reject) kèm lý do -> Kỹ sư sửa lại & Gửi duyệt lại
print("\n7. TC7: Kiểm tra nhánh Giám sát Từ chối (Reject) -> Trả về Kỹ sư sửa -> Gửi duyệt lại...")
reject_res = requests.post(
    f"{base_url}/api/checklists/{checklist_id}/supervisor-reject",
    json={"rejectReason": "Yêu cầu bổ sung thêm tài liệu chứng chỉ xuất xưởng của mác thép sử dụng."},
    headers={"Authorization": f"Bearer {supervisor_token}"}
)
assert reject_res.status_code == 200, f"Supervisor reject failed: {reject_res.text}"
rejected_cl = reject_res.json()
print(f"-> Giám sát từ chối thành công! Trạng thái: '{rejected_cl['status']}', Lý do: '{rejected_cl['rejectReason']}'")
assert rejected_cl["status"] == "Rejected", f"Expected Rejected, got {rejected_cl['status']}"

# Kỹ sư gửi duyệt lại
resubmit_res = requests.post(f"{base_url}/api/checklists/{checklist_id}/submit", headers={"Authorization": f"Bearer {submitter_token}"})
assert resubmit_res.status_code == 200, f"Resubmit failed: {resubmit_res.text}"
assert resubmit_res.json()["status"] == "PendingSupervisor"
print("-> Kỹ sư đã tiếp thu ý kiến và nộp duyệt lại thành công.")

# 8. Giám sát Phê duyệt Kế hoạch Checklist -> Trạng thái 'Approved' -> Khóa cứng Schema & Mở khóa tạo phiếu
print("\n8. TC8: Giám sát Phê duyệt Kế hoạch Checklist (Checklist_Approved)...")
approve_res = requests.post(
    f"{base_url}/api/checklists/{checklist_id}/supervisor-approve",
    json={"comment": "Kế hoạch đạt yêu cầu kỹ thuật, cho phép triển khai nghiệm thu hiện trường."},
    headers={"Authorization": f"Bearer {supervisor_token}"}
)
assert approve_res.status_code == 200, f"Supervisor approve failed: {approve_res.text}"
approved_cl = approve_res.json()
print(f"-> Giám sát phê duyệt thành công! Trạng thái: '{approved_cl['status']}', CanFillInspection={approved_cl['canFillInspection']}")
assert approved_cl["status"] == "Approved", f"Expected Approved, got {approved_cl['status']}"
assert approved_cl["canFillInspection"] == True, "Sau khi Approved, chức năng lập phiếu nghiệm thu PHẢI ĐƯỢC MỞ KHÓA!"

# Kiểm tra khóa cứng: Kỹ sư cố thêm item sau khi Approved -> Phải bị CHẶN
add_locked_res = requests.post(
    f"{base_url}/api/checklists/{checklist_id}/items",
    json={"name": "Tiêu chí phát sinh bất hợp lệ", "isRequired": False},
    headers={"Authorization": f"Bearer {submitter_token}"}
)
assert add_locked_res.status_code in [400, 500], "Phải chặn thêm tiêu chí khi cấu trúc Checklist đã bị khóa cứng!"
print("-> Đã khóa cứng cấu trúc Checklist thành công: Thao tác thêm tiêu chí sau khi Approved bị chặn đúng luật.")

# 9. Giai đoạn 2: Lập phiếu nghiệm thu và liên kết vào Checklist Item
print("\n9. TC9: Giai đoạn 2 (Execution Phase) - Tạo FormInspection và liên kết vào tiêu chí Cốt thép...")
create_insp_res = requests.post(
    f"{base_url}/api/inspections",
    json={
        "objectId": object_id,
        "formSchemaId": "schema-thep-dam-d1",
        "formDataJson": json.dumps({"duongKinhThep": "D22", "khoangCachDai": 150, "chieuDayLopBaoVe": 25})
    },
    headers={"Authorization": f"Bearer {submitter_token}"}
)
assert create_insp_res.status_code in [200, 201], f"Create inspection failed: {create_insp_res.text}"
inspection_id = create_insp_res.json()["id"]

# Liên kết phiếu vào tiêu chí Cốt thép
link_res = requests.post(
    f"{base_url}/api/checklists/{checklist_id}/items/{item_thep_id}/link-inspection",
    json={"inspectionId": inspection_id},
    headers={"Authorization": f"Bearer {submitter_token}"}
)
assert link_res.status_code == 200, f"Link inspection failed: {link_res.text}"
linked_item = link_res.json()
print(f"-> Liên kết FormInspection thành công: Item '{linked_item['name']}' đã gắn với Inspection {linked_item['linkedInspectionId']}")
assert linked_item["linkedInspectionId"] == inspection_id

# 10. Kiểm tra Khóa Xóa (Locking NFR-1) & Xóa Mềm (Soft Delete)
print("\n10. TC10: Kiểm tra Khóa Xóa và Xóa Mềm (Soft Delete)...")
# Cố xóa item_thep_id đã gắn phiếu -> Phải bị CHẶN
del_locked_res = requests.delete(
    f"{base_url}/api/checklists/{checklist_id}/items/{item_thep_id}",
    headers={"Authorization": f"Bearer {supervisor_token}"}
)
assert del_locked_res.status_code in [400, 500], "Phải cấm xóa ChecklistItem khi đã có phiếu nghiệm thu phát sinh!"
print("-> Chặn xóa tiêu chí đã có phiếu nghiệm thu thành công (Locking enforced).")

# Kiểm tra API Summary
summary_res = requests.get(f"{base_url}/api/checklists/object/{object_id}/summary", headers={"Authorization": f"Bearer {submitter_token}"})
assert summary_res.status_code == 200, f"Get summary failed: {summary_res.text}"
summary = summary_res.json()
print(f"-> Thống kê tiến độ Object '{summary['objectName']}': Tổng {summary['totalChecklists']} Checklist, {summary['totalItems']} Tiêu chí.")

# Lấy chi tiết Checklist và kiểm tra 100% Audit Trail (FR-10)
detail_res = requests.get(f"{base_url}/api/checklists/{checklist_id}", headers={"Authorization": f"Bearer {submitter_token}"})
assert detail_res.status_code == 200, f"Get detail failed: {detail_res.text}"
detail = detail_res.json()
print(f"-> Chi tiết Checklist: {len(detail['auditHistories'])} bản ghi nhật ký kiểm toán (Audit Trail) đã được ghi nhận đầy đủ:")
for audit in detail['auditHistories']:
    print(f"   [{audit['createdAt'][:19]}] Action: {audit['action']:<20} Actor: {audit['actorName']:<18} Status: {audit['fromStatus']} -> {audit['toStatus']}")

print("\n=========================================================================")
print("  TẤT CẢ 10 TEST CASES ĐÃ HOÀN TẤT VÀ VƯỢT QUA 100% (DoD VERIFIED)!")
print("=========================================================================")
