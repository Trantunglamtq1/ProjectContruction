import sys
import json
import requests
import io

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

base_url = "http://localhost:5092"

print("=================================================================")
print("  KIỂM THỬ TÍNH NĂNG UPLOAD ẢNH HIỆN TRƯỜNG CHO FORM INSPECTION")
print("=================================================================\n")

# 1. Đăng nhập Submitter
print("1. Đăng nhập tài khoản Submitter (KySu1)...")
sub_res = requests.post(f"{base_url}/api/auth/login", json={"usernameOrEmail": "KySu1", "password": "Admin@123"})
assert sub_res.status_code == 200, f"Login failed: {sub_res.text}"
sub_token = sub_res.json()["token"]
print("-> Đăng nhập thành công.")

# 2. Upload file ảnh hiện trường
print("\n2. Kiểm thử API Upload ảnh hiện trường (POST /api/inspections/upload-attachment)...")
# Tạo một buffer ảnh giả lập (1x1 PNG giả lập hoặc dummy bytes)
fake_image_bytes = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4\x00\x00\x00\rIDATx\x9cc\xf8\xff\xff?\x00\x05\xfe\x02\xfe\xa76\x814\x00\x00\x00\x00IEND\xaeB`\x82"
files = {
    "file": ("cot_thep_dam_d1.png", io.BytesIO(fake_image_bytes), "image/png")
}
upload_res = requests.post(
    f"{base_url}/api/inspections/upload-attachment",
    files=files,
    headers={"Authorization": f"Bearer {sub_token}"}
)
assert upload_res.status_code == 200, f"Upload failed: {upload_res.status_code} - {upload_res.text}"
att_data = upload_res.json()
print("-> Upload thành công!")
print(f"   • Tên tệp gốc:     {att_data.get('originalName')}")
print(f"   • StoredFileName: {att_data.get('storedFileName')}")
print(f"   • FileUrl:        {att_data.get('fileUrl')}")
print(f"   • Dung lượng:     {att_data.get('size')} bytes")
print(f"   • ContentType:    {att_data.get('contentType')}")

assert att_data["originalName"] == "cot_thep_dam_d1.png"
assert att_data["storedFileName"] is not None
assert att_data["fileUrl"].startswith("/api/inspections/attachments/files/")

# 3. Xem / Tải tệp qua endpoint streaming
print("\n3. Kiểm thử endpoint streaming ảnh (GET /api/inspections/attachments/files/{fileName})...")
stored_name = att_data["storedFileName"]
view_res = requests.get(f"{base_url}/api/inspections/attachments/files/{stored_name}")
assert view_res.status_code == 200, f"Get file failed: {view_res.status_code}"
assert view_res.headers.get("Content-Type") == "image/png"
assert len(view_res.content) == len(fake_image_bytes)
print(f"-> Truy cập xem ảnh thành công (Status: {view_res.status_code}, Length: {len(view_res.content)} bytes).")

# 4. Lấy Object có sẵn trên bản vẽ
print("\n4. Chuẩn bị Object kiểm tra...")
drawings = requests.get(f"{base_url}/api/drawings", headers={"Authorization": f"Bearer {sub_token}"}).json()
drawing_id = drawings[0]["id"]
objs = requests.get(f"{base_url}/api/objects?drawingFileId={drawing_id}", headers={"Authorization": f"Bearer {sub_token}"}).json()
if len(objs) > 0:
    object_id = objs[0]["id"]
else:
    new_obj = requests.post(
        f"{base_url}/api/objects",
        json={
            "drawingFileId": drawing_id,
            "pageNumber": 1,
            "markerCoordinates": json.dumps({"x": 100, "y": 100, "width": 50, "height": 50}),
            "name": "Dầm D5 - Ảnh hiện trường",
            "createdBy": "KySu1"
        },
        headers={"Authorization": f"Bearer {sub_token}"}
    ).json()
    object_id = new_obj["id"]

# 5. Khởi tạo bản nháp Form Inspection kèm ảnh trong FormDataJson
print("\n5. Tạo Form Inspection Draft kèm danh sách ảnh hiện trường trong FormDataJson...")
form_payload = {
    "inspectionTitle": "Nghiệm thu dầm D5 kèm minh chứng ảnh",
    "result": "pass",
    "doSut": 14,
    "attachments": [att_data]
}

create_res = requests.post(
    f"{base_url}/api/inspections",
    json={
        "objectId": object_id,
        "formSchemaId": "default-inspection-schema",
        "formDataJson": json.dumps(form_payload)
    },
    headers={"Authorization": f"Bearer {sub_token}"}
)
assert create_res.status_code in [200, 201], f"Create inspection failed: {create_res.text}"
inspection = create_res.json()
inspection_id = inspection["id"]
print(f"-> Khởi tạo Form Inspection Id: {inspection_id}, Status: {inspection['status']}")

# 6. Đọc lại chi tiết hồ sơ (GET /api/inspections/{id})
print("\n6. Đọc lại chi tiết qua GET /api/inspections/{id}...")
detail_res = requests.get(f"{base_url}/api/inspections/{inspection_id}", headers={"Authorization": f"Bearer {sub_token}"})
assert detail_res.status_code == 200
detail_data = detail_res.json()

# Kiểm tra trường Attachments tự động parse từ FormDataJson
attachments_list = detail_data.get("attachments", [])
print(f"-> Số lượng ảnh trong hồ sơ: {len(attachments_list)}")
assert len(attachments_list) == 1, f"Không tìm thấy attachments trong InspectionDto: {detail_data}"
assert attachments_list[0]["originalName"] == "cot_thep_dam_d1.png"
assert attachments_list[0]["storedFileName"] == stored_name
print(f"   • Ảnh 1: {attachments_list[0]['originalName']} -> URL: {attachments_list[0]['fileUrl']}")

# 7. Submitter Submit hồ sơ
print("\n7. Submitter gửi duyệt hồ sơ (Draft -> Submitted)...")
sub_submit_res = requests.post(
    f"{base_url}/api/inspections/{inspection_id}/submit",
    json={"formDataJson": json.dumps(form_payload)},
    headers={"Authorization": f"Bearer {sub_token}"}
)
assert sub_submit_res.status_code == 200
submitted_data = sub_submit_res.json()
print(f"-> Đã nộp duyệt thành công. Status: {submitted_data['status']}, Elsa WF: {submitted_data['workflowInstanceId']}")
assert submitted_data["status"] == "Submitted"
assert len(submitted_data.get("attachments", [])) == 1

# 8. Reviewer đăng nhập và xem ảnh trong chi tiết hồ sơ
print("\n8. Reviewer (GiamSat1) đăng nhập kiểm tra ảnh trước khi duyệt...")
rev_res = requests.post(f"{base_url}/api/auth/login", json={"usernameOrEmail": "GiamSat1", "password": "Admin@123"})
assert rev_res.status_code == 200
rev_token = rev_res.json()["token"]

rev_view_res = requests.get(f"{base_url}/api/inspections/{inspection_id}", headers={"Authorization": f"Bearer {rev_token}"})
assert rev_view_res.status_code == 200
rev_view_data = rev_view_res.json()
assert len(rev_view_data.get("attachments", [])) == 1
print(f"-> Reviewer xem đầy đủ {len(rev_view_data['attachments'])} ảnh minh chứng hiện trường.")

print("\n=================================================================")
print("  CHÚC MỪNG: TÍNH NĂNG UPLOAD & QUẢN LÝ ẢNH HIỆN TRƯỜNG PASS 100%!")
print("=================================================================")
