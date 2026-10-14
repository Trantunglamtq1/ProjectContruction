import sys
import json
import requests

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

base_url = "http://localhost:5092"
print("Testing Rejection Flow with Elsa Workflow...")

sub_res = requests.post(f"{base_url}/api/auth/login", json={"usernameOrEmail": "KySu1", "password": "Admin@123"})
sub_token = sub_res.json()["token"]

rev_res = requests.post(f"{base_url}/api/auth/login", json={"usernameOrEmail": "GiamSat1", "password": "Admin@123"})
rev_token = rev_res.json()["token"]

drawings_res = requests.get(f"{base_url}/api/drawings", headers={"Authorization": f"Bearer {sub_token}"})
drawing_id = drawings_res.json()[0]["id"]

# Create object
obj_res = requests.post(
    f"{base_url}/api/objects",
    json={
        "drawingFileId": drawing_id,
        "pageNumber": 1,
        "markerCoordinates": json.dumps({"x": 50, "y": 50, "width": 50, "height": 50}),
        "name": "Dầm D1 - Trục B (Test Reject Flow)",
        "createdBy": "KySu1"
    },
    headers={"Authorization": f"Bearer {sub_token}"}
)
assert obj_res.status_code in [200, 201], f"Create object failed: {obj_res.text}"
object_id = obj_res.json()["id"]

# Create draft
insp_res = requests.post(
    f"{base_url}/api/inspections",
    json={"objectId": object_id, "formSchemaId": "default-inspection-schema"},
    headers={"Authorization": f"Bearer {sub_token}"}
)
assert insp_res.status_code in [200, 201], f"Create inspection failed: {insp_res.text}"
inspection_id = insp_res.json()["id"]

# Submit
submit_res = requests.post(
    f"{base_url}/api/inspections/{inspection_id}/submit",
    json={"formDataJson": json.dumps({"inspectionTitle": "Nghiệm thu dầm D1", "result": "pass", "location": "Trục B", "notes": "Cần kiểm tra lại thép"})},
    headers={"Authorization": f"Bearer {sub_token}"}
)
assert submit_res.status_code == 200, f"Submit failed: {submit_res.status_code} - {submit_res.text}"
wf_id = submit_res.json()["workflowInstanceId"]
print(f"Submitted. Elsa WF: {wf_id}")

# Receive
recv_res = requests.post(
    f"{base_url}/api/inspections/{inspection_id}/receive",
    json={"comment": "Tiếp nhận kiểm tra"},
    headers={"Authorization": f"Bearer {rev_token}"}
)

# Reject
rej_res = requests.post(
    f"{base_url}/api/inspections/{inspection_id}/reject",
    json={"reason": "Cốt thép không đúng chủng loại thiết kế CB400V, yêu cầu chỉnh sửa."},
    headers={"Authorization": f"Bearer {rev_token}"}
)
assert rej_res.status_code == 200, f"Reject failed: {rej_res.text}"
rejected = rej_res.json()
print(f"Rejected successfully. Status: {rejected['status']}, Reason: {rejected['rejectReason']}, WF ID: {rejected['workflowInstanceId']}")
assert rejected["status"] == "Rejected"
assert rejected["workflowInstanceId"] == wf_id

# Verify Audit Trail
hist_res = requests.get(f"{base_url}/api/inspections/{inspection_id}/history", headers={"Authorization": f"Bearer {sub_token}"})
assert hist_res.status_code == 200
print(f"Audit Trail steps: {len(hist_res.json())}")
for h in hist_res.json():
    print(f" - [{h['action']}] {h['fromStatus']} -> {h['toStatus']} by {h['actorName']}: {h['comment']}")

print("\nREJECTION FLOW TEST PASSED 100%!")
