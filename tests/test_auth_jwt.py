import sys
import json
import requests

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

base_url = "http://localhost:5092"

print("=== BẮT ĐẦU TEST TOÀN DIỆN AUTHENTICATION & JWT PHÂN QUYỀN ===\n")

# 1. Test Login Admin mặc định
print("1. Kiểm tra đăng nhập tài khoản Admin mặc định (admin / Admin@123)...")
login_admin_res = requests.post(f"{base_url}/api/auth/login", json={
    "usernameOrEmail": "admin",
    "password": "Admin@123"
})
print(f"Status: {login_admin_res.status_code}")
assert login_admin_res.status_code == 200, f"Login admin failed: {login_admin_res.text}"
admin_data = login_admin_res.json()
admin_token = admin_data["token"]
print(f"Admin Token sinh ra: {admin_token[:30]}... (Role: {admin_data['user']['roleName']})")

# 2. Test Gọi API không kèm Token -> 401 Unauthorized
print("\n2. Kiểm tra gọi API Drawings khi KHÔNG có Bearer Token...")
no_token_res = requests.get(f"{base_url}/api/drawings")
print(f"Status: {no_token_res.status_code} (Mong đợi: 401 Unauthorized)")
assert no_token_res.status_code == 401

# 3. Test Đăng ký tài khoản người dùng mới (chưa có Role)
print("\n3. Đăng ký tài khoản người dùng mới (kysu_hientruong)...")
register_res = requests.post(f"{base_url}/api/auth/register", json={
    "username": "kysu_hientruong",
    "email": "kysu@construction.local",
    "password": "Password@123",
    "fullName": "Kỹ Sư Hiện Trường Nguyễn Văn A"
})
print(f"Status: {register_res.status_code}")
if register_res.status_code == 201:
    user_data = register_res.json()
    new_user_id = user_data["id"]
    print(f"Tạo thành công User: {user_data['username']}, Role: {user_data.get('roleName')} (Phải là None/null theo quy tắc)")
    assert user_data.get("roleId") is None
else:
    # Nếu đã tồn tại từ lần test trước, lấy id qua admin
    users = requests.get(f"{base_url}/api/users", headers={"Authorization": f"Bearer {admin_token}"}).json()
    new_user = next(u for u in users if u["username"] == "kysu_hientruong")
    new_user_id = new_user["id"]
    print(f"User đã tồn tại, ID: {new_user_id}")

# 4. Đăng nhập user mới (chưa có Role)
print("\n4. Đăng nhập user mới vừa tạo...")
user_login_res = requests.post(f"{base_url}/api/auth/login", json={
    "usernameOrEmail": "kysu_hientruong",
    "password": "Password@123"
})
assert user_login_res.status_code == 200
user_token = user_login_res.json()["token"]
print(f"User Token: {user_token[:30]}... (Role: {user_login_res.json()['user'].get('roleName')})")

# 5. User chưa có quyền Admin gọi API quản lý người dùng -> 403 Forbidden
print("\n5. User thường gọi API Admin /api/users...")
forbidden_res = requests.get(f"{base_url}/api/users", headers={"Authorization": f"Bearer {user_token}"})
print(f"Status: {forbidden_res.status_code} (Mong đợi: 403 Forbidden)")
assert forbidden_res.status_code == 403

# 6. Admin lấy danh sách roles và users
print("\n6. Admin gọi lấy danh sách Roles và Users...")
roles_res = requests.get(f"{base_url}/api/users/roles", headers={"Authorization": f"Bearer {admin_token}"})
assert roles_res.status_code == 200
roles = roles_res.json()
print("Các Role trong hệ thống:")
for r in roles:
    print(f" - [{r['name']}]: {r['id']} ({r['description']})")

submitter_role = next(r for r in roles if r["name"] == "Submitter")

# 7. Admin gán Role Submitter cho User
print(f"\n7. Admin gán Role '{submitter_role['name']}' cho User ID: {new_user_id}...")
assign_res = requests.put(
    f"{base_url}/api/users/{new_user_id}/role",
    headers={"Authorization": f"Bearer {admin_token}"},
    json={"roleId": submitter_role["id"]}
)
print(f"Status: {assign_res.status_code}")
assert assign_res.status_code == 200
print(f"Kết quả sau khi gán: User {assign_res.json()['username']} đã có Role: {assign_res.json()['roleName']}")

# 8. User đăng nhập lại và kiểm tra claim Role mới
print("\n8. User đăng nhập lại để nhận token mới có chứa Role...")
relogin_res = requests.post(f"{base_url}/api/auth/login", json={
    "usernameOrEmail": "kysu_hientruong",
    "password": "Password@123"
})
assert relogin_res.status_code == 200
new_user_token = relogin_res.json()["token"]
print(f"Role trong token mới: {relogin_res.json()['user']['roleName']}")
assert relogin_res.json()["user"]["roleName"] == "Submitter"

# 9. Kiểm tra /api/auth/me với token mới
print("\n9. Kiểm tra endpoint /api/auth/me...")
me_res = requests.get(f"{base_url}/api/auth/me", headers={"Authorization": f"Bearer {new_user_token}"})
print(f"Status: {me_res.status_code}, User: {me_res.json()['fullName']}, Role: {me_res.json()['roleName']}")
assert me_res.status_code == 200

# 10. User Submitter gọi API Drawings với Bearer token hợp lệ
print("\n10. Kỹ sư Submitter gọi GET /api/drawings kèm Bearer Token...")
drawings_res = requests.get(f"{base_url}/api/drawings", headers={"Authorization": f"Bearer {new_user_token}"})
print(f"Status: {drawings_res.status_code}, Total drawings: {len(drawings_res.json())}")
assert drawings_res.status_code == 200

print("\n=== TẤT CẢ CÁC BƯỚC KIỂM THỬ XÁC THỰC VÀ PHÂN QUYỀN ĐÃ HOÀN TẤT THÀNH CÔNG 100%! ===")
