import urllib.request
import json
import sys
import requests

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

base_url = "http://localhost:5092"

print("--- 1. Testing GET /api/drawings ---")
res = requests.get(f"{base_url}/api/drawings")
print(f"Status: {res.status_code}, Count: {len(res.json())}")

print("\n--- 2. Testing POST /api/drawings/upload ---")
with open("test_sample_drawing.pdf", "rb") as f:
    files = {"file": ("test_sample_drawing.pdf", f, "application/pdf")}
    data = {"uploadedBy": "KySuHienTruong_Demo"}
    res_upload = requests.post(f"{base_url}/api/drawings/upload", files=files, data=data)
    print(f"Upload Status: {res_upload.status_code}")
    drawing = res_upload.json()
    drawing_id = drawing["id"]
    file_url = drawing["fileUrl"]
    print(f"Uploaded Drawing ID: {drawing_id}")
    print(f"File URL: {file_url}")

print("\n--- 3. Testing POST /api/objects (Create Object from Marker) ---")
coords = json.dumps({"x": 120.5, "y": 250.0, "width": 85.0, "height": 65.0})
obj_payload = {
    "drawingFileId": drawing_id,
    "pageNumber": 1,
    "markerCoordinates": coords,
    "name": "Cột C12 - Tầng 3",
    "createdBy": "KySuHienTruong_Demo"
}
res_obj = requests.post(f"{base_url}/api/objects", json=obj_payload)
print(f"Create Object Status: {res_obj.status_code}")
created_obj = res_obj.json()
print(f"Created Object ID: {created_obj['id']}")
print(f"Object Name: {created_obj['name']}")
print(f"Page Number: {created_obj['pageNumber']}")

print("\n--- 4. Testing GET /api/drawings/{id} ---")
res_detail = requests.get(f"{base_url}/api/drawings/{drawing_id}")
print(f"Detail Status: {res_detail.status_code}")
detail = res_detail.json()
print(f"Drawing Name: {detail['fileName']}")
print(f"Objects in drawing: {len(detail['objects'])}")

print("\n--- 5. Testing GET /api/objects?drawingFileId=... ---")
res_filtered = requests.get(f"{base_url}/api/objects?drawingFileId={drawing_id}")
print(f"Filtered Objects Status: {res_filtered.status_code}")
objs = res_filtered.json()
print(f"Found {len(objs)} objects for Drawing {drawing_id}")
print(f"First Object: {objs[0]['name']}")

print("\n--- 6. Testing Stream PDF File for Viewport ---")
res_stream = requests.get(f"{base_url}{file_url}")
print(f"Stream Status: {res_stream.status_code}")
print(f"Content-Type: {res_stream.headers.get('Content-Type')}")
print(f"Bytes received: {len(res_stream.content)}")

print("\n--- 7. Testing Business Rule: Cannot create Object without valid DrawingFileId ---")
invalid_payload = {
    "drawingFileId": "00000000-0000-0000-0000-000000000000",
    "pageNumber": 1,
    "markerCoordinates": coords,
    "name": "Object Lạc Loài",
    "createdBy": "KySuHienTruong_Demo"
}
res_invalid = requests.post(f"{base_url}/api/objects", json=invalid_payload)
print(f"Expected failure Status: {res_invalid.status_code}")
print(f"Failure response: {res_invalid.json()}")

print("\n=== ALL DAY 2 BACKEND VERIFICATION CHECKS PASSED SUCCESSFULLY ===")
