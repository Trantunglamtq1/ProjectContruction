import { CheckSquareOutlined, FileDoneOutlined, FilePdfOutlined, LogoutOutlined, MenuFoldOutlined, MenuOutlined, TeamOutlined, UserOutlined } from '@ant-design/icons';
import { Avatar, Button, Drawer, Dropdown, Grid, Layout, Menu, Select } from 'antd';
import { useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { roleLabels } from '../../config/statuses';
import { useAuth } from '../../contexts/AuthContext';
import { useConfirmExit } from '../../contexts/UnsavedChangesContext';
import { NotificationBell } from './NotificationBell';
import { ProjectBoundary, ProjectProvider, useProject } from '../../contexts/ProjectContext';

export const MasterLayout = () => <ProjectProvider><MasterLayoutContent /></ProjectProvider>;

const MasterLayoutContent = () => {
  const { projects, projectId, selectProject } = useProject();
  const { user, logout } = useAuth();
  const confirmExit = useConfirmExit();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const screens = Grid.useBreakpoint();
  const mobile = screens.md === false;
  const viewport = pathname.includes('/viewport');
  const [collapsed, setCollapsed] = useState(false);
  const [navigationOpen, setNavigationOpen] = useState(false);
  const role = (Array.isArray(user?.role) ? user.role[0] : user?.role) || '';
  const base = `/${role.toLowerCase()}`;
  const section = pathname.includes('/drawings') ? 'drawings' : pathname.includes('/checklists') ? 'checklists' : 'inspections';
  const items = [{ key: '/projects', icon: <TeamOutlined />, label: 'Dự án' }, ...(role === 'Admin' ? [{ key: '/admin/users', icon: <TeamOutlined />, label: 'Người dùng' }] : [
    { key: `${base}/drawings`, icon: <FilePdfOutlined />, label: 'Bản vẽ' },
    { key: `${base}/checklists`, icon: <CheckSquareOutlined />, label: 'Kế hoạch kiểm tra' },
    { key: `${base}/inspections`, icon: <FileDoneOutlined />, label: 'Hồ sơ nghiệm thu' },
  ])];
  const menu = <Menu mode="inline" selectedKeys={[pathname === '/projects' || role === 'Admin' ? pathname : `${base}/${section}`]} items={items} onClick={({ key }) => { navigate(key + (projectId && key !== '/projects' && key !== '/admin/users' ? `?projectId=${projectId}` : '')); setNavigationOpen(false); }} />;
  return <Layout className="app-shell">
    <Layout.Header className="app-header">
      <div className="app-header-left"><Button type="text" icon={mobile || viewport || collapsed ? <MenuOutlined /> : <MenuFoldOutlined />} aria-label={mobile || viewport ? 'Mở điều hướng' : collapsed ? 'Mở rộng điều hướng' : 'Thu gọn điều hướng'} onClick={() => mobile || viewport ? setNavigationOpen(true) : setCollapsed(!collapsed)} />
        <Link className="app-brand" to={items[0]?.key || '/'}><span className="brand-mark" aria-hidden="true">CI</span><span>ConstructInspect</span></Link><span className="app-context">Nghiệm thu công trình</span></div>
      <div className="app-header-actions">{role !== 'Admin' && <Select aria-label="Dự án hiện tại" placeholder="Chọn dự án" value={projectId ?? undefined} onChange={id => selectProject(id)} options={projects.map(p => ({ value: p.id, label: `${p.code} · ${p.name}` }))} style={{ width: 'min(260px, 30vw)' }} />}<NotificationBell /><Dropdown trigger={['click']} menu={{ items: [
        { key: 'identity', label: <div><strong>{user?.fullName || user?.username}</strong><div>{roleLabels[role] || 'Chưa gán quyền'}</div></div>, disabled: true },
        { type: 'divider' }, { key: 'logout', icon: <LogoutOutlined />, label: 'Đăng xuất', onClick: () => confirmExit(() => { logout(); navigate('/auth/login', { replace: true }); }) },
      ] }}><Button type="text" className="account-trigger" aria-label="Mở menu tài khoản"><Avatar size={28} icon={<UserOutlined />} /><span className="account-name">{user?.fullName || user?.username}</span></Button></Dropdown></div>
    </Layout.Header>
    <Layout className="app-body">{!mobile && !viewport && role && <Layout.Sider width={224} collapsedWidth={64} collapsed={collapsed} theme="light" className="app-sidebar">{menu}</Layout.Sider>}<Layout.Content className={viewport ? 'app-content drawing-content' : 'app-content'}>{pathname === '/projects' || pathname === '/admin/users' ? <Outlet /> : <ProjectBoundary><Outlet /></ProjectBoundary>}</Layout.Content></Layout>
    <Drawer title="Điều hướng" placement="left" size={280} open={navigationOpen} onClose={() => setNavigationOpen(false)} className="navigation-drawer" styles={{ body: { padding: '8px 0' } }}>{menu}</Drawer>
  </Layout>;
};
