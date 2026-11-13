import { getSelectedProjectId } from '../../services/projectScope';
import {
  CheckCircleOutlined,
  CheckSquareOutlined,
  CloseCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  FileTextOutlined,
  HistoryOutlined,
  LockOutlined,
  PlusOutlined,
  SendOutlined,
  UnlockOutlined,
} from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Button,
  Card,
  Divider,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Progress,
  Space,
  Switch,
  Table,
  Tag,
  Tooltip,
  Typography,
  message,
} from 'antd';
import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useUnsavedChanges } from '../../contexts/UnsavedChangesContext';
import { checklistApi } from '../../services/checklistApi';
import { inspectionApi } from '../../services/inspectionApi';
import type {
  ChecklistDto,
  ChecklistItemDto,
  ChecklistStatus,
} from '../../types/checklist';
import type { FormIoSchema } from '../../types/inspection';
import { FormIoBuilderModal } from '../formio/FormIoBuilderModal';
import { QueryState } from '../ui/QueryState';
import { StatusBadge } from '../ui/StatusBadge';
import { ChecklistAuditTrailDrawer } from './ChecklistAuditTrailDrawer';
import { ItemInspectionModal } from './ItemInspectionModal';

const { Text, Title, Paragraph } = Typography;

interface ChecklistDetailModalProps {
  open: boolean;
  checklistId: string | null;
  onClose: () => void;
  onRefresh?: () => void;
}

export const ChecklistDetailModal: React.FC<ChecklistDetailModalProps> = ({
  open,
  checklistId,
  onClose,
  onRefresh,
}) => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const currentRole = ((Array.isArray(user?.role) ? user?.role[0] : user?.role) as string) || '';
  const isSubmitter = currentRole === 'Submitter';
  const isReviewer = currentRole === 'Reviewer';
  const isApprover = currentRole === 'Approver';

  // State quản lý Modals con
  const [expanded, setExpanded] = useState(false);
  const [auditDrawerOpen, setAuditDrawerOpen] = useState(false);
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ChecklistItemDto | null>(null);
  const [editingChecklistVersion, setEditingChecklistVersion] = useState('');
  const [hasConflict, setHasConflict] = useState(false);
  const [builderModalOpen, setBuilderModalOpen] = useState(false);
  const [builderTargetItem, setBuilderTargetItem] = useState<ChecklistItemDto | null>(null);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [inspectionModalOpen, setInspectionModalOpen] = useState(false);
  const [inspectionTargetItem, setInspectionTargetItem] = useState<ChecklistItemDto | null>(null);

  // State thẩm tra / phê duyệt phiếu nghiệm thu của từng tiêu chí bên trong Checklist
  const [itemRejectModalOpen, setItemRejectModalOpen] = useState(false);
  const [itemRejectTarget, setItemRejectTarget] = useState<ChecklistItemDto | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const [itemForm] = Form.useForm();
  const [rejectForm] = Form.useForm();
  const [itemRejectForm] = Form.useForm();
  const [formDirty, setFormDirty] = useState(false);
  const confirmDiscard = useUnsavedChanges(open && formDirty);
  const closeForm = (action: () => void) => confirmDiscard(() => { setFormDirty(false); action(); });

  // Query chi tiết Checklist
  const {
    data: checklist,
    refetch,
    error: loadError,
  } = useQuery<ChecklistDto>({
    queryKey: ['checklist', checklistId, getSelectedProjectId()],
    queryFn: () => checklistApi.getChecklistById(checklistId!),
    enabled: open && !!checklistId,
    refetchInterval: query => query.state.data?.workflowSyncStatus === 'Pending' || query.state.data?.workflowSyncStatus === 'Retrying' || query.state.data?.items.some(item =>
      item.linkedInspectionWorkflowSyncStatus === 'Pending' || item.linkedInspectionWorkflowSyncStatus === 'Retrying') ? 3000 : false,
  });

  const showChecklistError = (err: any, fallback: string) => {
    if (err.response?.status === 409) setHasConflict(true);
    message.error(err.response?.data?.message || fallback);
  };

  // Mutation: Thêm tiêu chí
  const addItemMutation = useMutation({
    mutationFn: (values: any) =>
      checklistApi.addItem(checklistId!, {
        checklistRowVersion: editingChecklistVersion,
        name: values.name,
        orderIndex: values.orderIndex ?? (checklist?.items.length ?? 0) + 1,
        isRequired: values.isRequired ?? true,
      }),
    onSuccess: () => {
      message.success('Đã thêm tiêu chí mới vào Checklist!');
      setFormDirty(false);
      setItemModalOpen(false);
      itemForm.resetFields();
      refetch();
      queryClient.invalidateQueries({ queryKey: ['checklists'] });
      onRefresh?.();
    },
    onError: (err: any) => {
      showChecklistError(err, 'Lỗi khi thêm tiêu chí.');
    },
  });

  // Mutation: Sửa tiêu chí
  const updateItemMutation = useMutation({
    mutationFn: ({ itemId, values }: { itemId: string; values: any }) =>
      checklistApi.updateItem(checklistId!, itemId, { ...values, checklistRowVersion: editingChecklistVersion, rowVersion: editingItem?.rowVersion ?? '' }),
    onSuccess: () => {
      message.success('Đã cập nhật tiêu chí thành công!');
      setFormDirty(false);
      setItemModalOpen(false);
      setEditingItem(null);
      itemForm.resetFields();
      refetch();
      queryClient.invalidateQueries({ queryKey: ['checklists'] });
      onRefresh?.();
    },
    onError: (err: any) => {
      showChecklistError(err, 'Lỗi khi cập nhật tiêu chí.');
    },
  });

  // Mutation: Xóa tiêu chí
  const deleteItemMutation = useMutation({
    mutationFn: (item: ChecklistItemDto) => checklistApi.deleteItem(checklistId!, item.id, checklist!.rowVersion, item.rowVersion),
    onSuccess: () => {
      message.success('Đã xóa tiêu chí khỏi Checklist!');
      refetch();
      queryClient.invalidateQueries({ queryKey: ['checklists'] });
      onRefresh?.();
    },
    onError: (err: any) => {
      showChecklistError(err, 'Không thể xóa tiêu chí này.');
    },
  });

  // Mutation: Kỹ sư nộp duyệt Checklist (Kích hoạt Elsa Workflow #1)
  const submitMutation = useMutation({
    mutationFn: () => checklistApi.submitForApproval(checklistId!, { rowVersion: checklist!.rowVersion }),
    onSuccess: () => {
      message.info('Đã ghi nhận kế hoạch; quy trình đang được đồng bộ.');
      refetch();
      queryClient.invalidateQueries({ queryKey: ['checklists'] });
      onRefresh?.();
    },
    onError: (err: any) => {
      showChecklistError(err, 'Lỗi khi gửi duyệt kế hoạch.');
    },
  });

  // Mutation: Giám sát phê duyệt
  const approveMutation = useMutation({
    mutationFn: () => checklistApi.supervisorApprove(checklistId!, { rowVersion: checklist!.rowVersion }),
    onSuccess: () => {
      message.info('Đã ghi nhận phê duyệt; quy trình đang được đồng bộ.');
      refetch();
      queryClient.invalidateQueries({ queryKey: ['checklists'] });
      onRefresh?.();
    },
    onError: (err: any) => {
      showChecklistError(err, 'Lỗi khi phê duyệt kế hoạch.');
    },
  });

  // Mutation: Giám sát từ chối
  const rejectMutation = useMutation({
    mutationFn: (reason: string) => checklistApi.supervisorReject(checklistId!, { reason, rowVersion: editingChecklistVersion }),
    onSuccess: () => {
      message.info('Đã ghi nhận từ chối; quy trình đang được đồng bộ.');
      setFormDirty(false);
      setRejectModalOpen(false);
      rejectForm.resetFields();
      refetch();
      queryClient.invalidateQueries({ queryKey: ['checklists'] });
      onRefresh?.();
    },
    onError: (err: any) => {
      showChecklistError(err, 'Lỗi khi từ chối kế hoạch.');
    },
  });

  // Mutation: Xóa toàn bộ Kế hoạch Checklist (khi còn là Draft hoặc Rejected)
  const deleteChecklistMutation = useMutation({
    mutationFn: () => checklistApi.deleteChecklist(checklistId!, checklist!.rowVersion),
    onSuccess: () => {
      message.success('Đã xóa bản nháp Checklist thành công!');
      queryClient.invalidateQueries({ queryKey: ['checklists'] });
      queryClient.invalidateQueries({ queryKey: ['checklist-summary-object'] });
      onRefresh?.();
      onClose();
    },
    onError: (err: any) => {
      showChecklistError(err, 'Lỗi khi xóa Checklist.');
    },
  });

  const handleReceiveItemInspection = async (item: ChecklistItemDto) => {
    if (!item.linkedInspectionId || !item.linkedInspectionRowVersion) {
      message.error('Không có phiên bản hồ sơ. Vui lòng tải lại dữ liệu.');
      return;
    }
    try {
      setActionLoadingId(item.id);
      await inspectionApi.receiveInspection(item.linkedInspectionId, item.linkedInspectionRowVersion);
      message.success(`Đã tiếp nhận hồ sơ tiêu chí "${item.name}" để thẩm tra.`);
      await refetch();
      queryClient.invalidateQueries({ queryKey: ['checklists'] });
      onRefresh?.();
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Lỗi khi tiếp nhận hồ sơ.');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Xử lý Reviewer phê duyệt Cấp 1 phiếu nghiệm thu của tiêu chí bên trong Checklist
  const handleReviewItemInspection = async (item: ChecklistItemDto) => {
    if (!item.linkedInspectionId || !item.linkedInspectionRowVersion) {
      message.error('Không có phiên bản hồ sơ. Vui lòng tải lại dữ liệu.');
      return;
    }
    try {
      setActionLoadingId(item.id);
      await inspectionApi.reviewInspection(item.linkedInspectionId, { rowVersion: item.linkedInspectionRowVersion });
      message.info(`Đã ghi nhận thẩm tra tiêu chí "${item.name}"; quy trình đang được đồng bộ.`);
      refetch();
      queryClient.invalidateQueries({ queryKey: ['checklists'] });
      onRefresh?.();
    } catch (err: any) {
      showChecklistError(err, 'Lỗi khi thẩm tra tiêu chí.');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Xử lý Approver phê duyệt Cấp 2 phiếu nghiệm thu của tiêu chí bên trong Checklist
  const handleApproveItemInspection = async (item: ChecklistItemDto) => {
    if (!item.linkedInspectionId || !item.linkedInspectionRowVersion) {
      message.error('Không có phiên bản hồ sơ. Vui lòng tải lại dữ liệu.');
      return;
    }
    try {
      setActionLoadingId(item.id);
      await inspectionApi.approveInspection(item.linkedInspectionId, { rowVersion: item.linkedInspectionRowVersion });
      message.info(`Đã ghi nhận phê duyệt tiêu chí "${item.name}"; quy trình đang được đồng bộ.`);
      refetch();
      queryClient.invalidateQueries({ queryKey: ['checklists'] });
      onRefresh?.();
    } catch (err: any) {
      showChecklistError(err, 'Lỗi khi phê duyệt tiêu chí.');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Xử lý Từ chối (Reviewer hoặc Approver) phiếu nghiệm thu kèm lý do
  const handleConfirmRejectItem = async () => {
    if (!itemRejectTarget?.linkedInspectionId || !itemRejectTarget.linkedInspectionRowVersion) {
      message.error('Không có phiên bản hồ sơ. Vui lòng tải lại dữ liệu.');
      return;
    }
    try {
      const values = await itemRejectForm.validateFields();
      setActionLoadingId(itemRejectTarget.id);
      await inspectionApi.rejectInspection(itemRejectTarget.linkedInspectionId, { reason: values.reason, rowVersion: itemRejectTarget.linkedInspectionRowVersion });
      message.info(`Đã ghi nhận yêu cầu sửa tiêu chí "${itemRejectTarget.name}"; quy trình đang được đồng bộ.`);
      setFormDirty(false);
      setItemRejectModalOpen(false);
      setItemRejectTarget(null);
      itemRejectForm.resetFields();
      refetch();
      queryClient.invalidateQueries({ queryKey: ['checklists'] });
      onRefresh?.();
    } catch (err: any) {
      if (err.errorFields) return;
      showChecklistError(err, 'Lỗi khi từ chối tiêu chí.');
    } finally {
      setActionLoadingId(null);
    }
  };

  if (!checklist) return <Modal open={open} onCancel={onClose} title="Kế hoạch kiểm tra" footer={<Button onClick={onClose}>Đóng</Button>}>
    {loadError ? <QueryState error={loadError} retry={() => refetch()} entity="kế hoạch kiểm tra" /> : <p>Đang tải kế hoạch kiểm tra…</p>}
  </Modal>;

  const workflowReady = checklist.workflowSyncStatus === 'Synchronized';
  const canEditStructure =
    workflowReady && (checklist.status === 'Draft' || checklist.status === 'Rejected') && isSubmitter;
  const canSupervisorModify = workflowReady && checklist.status === 'PendingSupervisor' && isReviewer;
  const canModifyItem = canEditStructure || canSupervisorModify;

  // Xử lý mở modal sửa tiêu chí
  const handleOpenEditItem = (item: ChecklistItemDto) => {
    setEditingChecklistVersion(checklist.rowVersion);
    setEditingItem(item);
    itemForm.setFieldsValue({
      name: item.name,
      orderIndex: item.orderIndex,
      isRequired: item.isRequired,
    });
    setItemModalOpen(true);
  };

  // Xử lý mở biểu mẫu Builder cho item
  const handleOpenFormBuilder = (item: ChecklistItemDto) => {
    setEditingChecklistVersion(checklist.rowVersion);
    setBuilderTargetItem(item);
    setBuilderModalOpen(true);
  };

  // Lưu schema từ biểu mẫu Builder vào item
  const handleSaveFormSchema = async (updatedSchema: FormIoSchema) => {
    if (!builderTargetItem) return;
    try {
      const schemaString = JSON.stringify(updatedSchema);
      await checklistApi.updateItem(checklistId!, builderTargetItem.id, {
        name: builderTargetItem.name,
        orderIndex: builderTargetItem.orderIndex,
        isRequired: builderTargetItem.isRequired,
        formSchemaJson: schemaString,
        checklistRowVersion: editingChecklistVersion,
        rowVersion: builderTargetItem.rowVersion,
      });
      message.success(`Đã lưu cấu trúc biểu mẫu cho tiêu chí "${builderTargetItem.name}"!`);
      setBuilderModalOpen(false);
      setBuilderTargetItem(null);
      refetch();
    } catch (err: any) {
      showChecklistError(err, 'Lỗi khi lưu biểu mẫu.');
    }
  };

  // Trạng thái badge
  const getStatusTag = (status: ChecklistStatus) => <StatusBadge domain="checklist" status={status} />;

  // Đếm components trong schema
  const getComponentCount = (schemaJson?: string) => {
    if (!schemaJson || schemaJson === '{}') return 0;
    try {
      const parsed = JSON.parse(schemaJson);
      return Array.isArray(parsed.components) ? parsed.components.length : 0;
    } catch {
      return 0;
    }
  };

  return (
    <>
      <Modal
        open={open && !inspectionModalOpen && !builderModalOpen}
        onCancel={() => closeForm(onClose)}
        keyboard={!itemModalOpen && !rejectModalOpen && !itemRejectModalOpen && !auditDrawerOpen}
        width={expanded ? 'calc(100vw - 32px)' : { xs: 'calc(100vw - 24px)', md: 960 }}
        className="detail-modal"
        style={{ top: 20 }}
        zIndex={1250}
        footer={<div className="detail-actions">
            <Space>
              <Button onClick={onClose}>Đóng</Button>
              {canEditStructure && (
                <Popconfirm
                  title="Xóa kế hoạch Checklist?"
                  description={`Bạn có chắc chắn muốn xóa bản nháp "${checklist.name}" không?`}
                  okText="Xóa"
                  cancelText="Hủy"
                  okButtonProps={{ danger: true, loading: deleteChecklistMutation.isPending }}
                  onConfirm={() => deleteChecklistMutation.mutate()}
                >
                  <Button danger icon={<DeleteOutlined />} loading={deleteChecklistMutation.isPending}>
                    Xóa Checklist
                  </Button>
                </Popconfirm>
              )}
            </Space>

            <Space>
              {/* Hành động của Kỹ sư (Submitter) khi Draft hoặc Rejected */}
              {canEditStructure && (
                <Button
                  type="primary"
                  icon={<SendOutlined />}
                  loading={submitMutation.isPending}
                  onClick={() => submitMutation.mutate()}
                  disabled={!checklist.items || checklist.items.length === 0}
                >
                  {checklist.status === 'Rejected' ? 'Gửi duyệt lại kế hoạch' : 'Nộp duyệt cho Giám sát'}
                </Button>
              )}

              {/* Hành động của Giám sát (Reviewer) khi PendingSupervisor */}
              {workflowReady && checklist.status === 'PendingSupervisor' && isReviewer && (
                <>
                  <Button
                    danger
                    icon={<CloseCircleOutlined />}
                    onClick={() => { setEditingChecklistVersion(checklist.rowVersion); setRejectModalOpen(true); }}
                  >
                    Từ chối kế hoạch
                  </Button>
                  <Button
                    type="primary"
                    style={{ backgroundColor: '#166534', borderColor: '#166534' }}
                    icon={<CheckCircleOutlined />}
                    loading={approveMutation.isPending}
                    onClick={() => approveMutation.mutate()}
                  >
                    Phê duyệt kế hoạch
                  </Button>
                </>
              )}
            </Space>
          </div>}
        destroyOnHidden
        title={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: 24, flexWrap: 'wrap', gap: 12 }}>
            <Space align="center">
              <CheckSquareOutlined style={{ fontSize: 20, color: '#1D4ED8' }} />
              <Title level={5} style={{ margin: 0 }}>
                {checklist.name}
              </Title>
              {getStatusTag(checklist.status)}
            </Space>
            <Space size={8} wrap><Button size="small" onClick={() => setExpanded(!expanded)}>{expanded ? 'Thu gọn' : 'Mở rộng'}</Button>
              <Button
                icon={<HistoryOutlined />}
                onClick={() => setAuditDrawerOpen(true)}
                size="small"
              >
                Nhật ký kiểm toán ({checklist.auditHistories?.length ?? 0})
              </Button>
            </Space>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {hasConflict && <Alert type="warning" showIcon message="Checklist đã thay đổi"
            description="Hãy tải lại và mở lại biểu mẫu trước khi thực hiện. Nội dung đang sửa sẽ không tự ghi đè dữ liệu mới."
            action={<Button size="small" onClick={async () => { await refetch(); setHasConflict(false); }}>Tải lại</Button>} />}
          {!workflowReady && <Alert type="warning" showIcon
            message={checklist.workflowSyncStatus === 'Pending' ? 'Quy trình checklist đang được đồng bộ' : checklist.workflowSyncStatus === 'Retrying' ? 'Đồng bộ gặp lỗi, hệ thống đang thử lại' : 'Quy trình cần được khôi phục'}
            description="Nếu tình trạng kéo dài, vui lòng liên hệ quản trị viên."
            action={<Button size="small" onClick={() => refetch()}>Tải lại</Button>} />}
          {/* Thông tin Cấu kiện & Tiến độ */}
          <Card size="small" style={{ backgroundColor: '#f8fafc', borderRadius: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>

              <div style={{ textAlign: 'right', minWidth: 200 }}>
                <Text strong style={{ fontSize: 13 }}>
                  Tiến độ nghiệm thu: {checklist.itemsCompletedCount} / {checklist.itemsCount} đạt
                </Text>
                <Progress
                  percent={checklist.progressPercentage}
                  status={checklist.status === 'Completed' ? 'success' : 'active'}
                  strokeColor={checklist.status === 'Completed' ? '#166534' : '#1D4ED8'}
                />
              </div>
            </div>

            {/* Banners cảnh báo theo trạng thái */}
            {checklist.status === 'Rejected' && (
              <Alert
                type="error"
                showIcon
                message="Kế hoạch bị Tư vấn giám sát từ chối"
                description={
                  <div>
                    <Paragraph style={{ margin: '4px 0', fontWeight: 500, color: '#cf1322' }}>
                      Lý do: {checklist.rejectReason}
                    </Paragraph>
                    {isSubmitter && (
                      <Text style={{ fontSize: 12 }}>
                        Vui lòng chỉnh sửa tiêu chí hoặc biểu mẫu bên dưới, sau đó bấm <b>"Gửi duyệt lại"</b>.
                      </Text>
                    )}
                  </div>
                }
                style={{ marginTop: 8 }}
              />
            )}

          </Card>

          {/* Bảng danh sách tiêu chí (Checklist Items) */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Space>
              <Text strong style={{ fontSize: 14 }}>
                Danh mục các tiêu chuẩn & Biểu mẫu nghiệm thu ({checklist.items?.length ?? 0})
              </Text>
              {checklist.status === 'Completed' ? (
                <Tag color="success" icon={<CheckCircleOutlined />}>Đã hoàn tất nghiệm thu</Tag>
              ) : checklist.canFillInspection ? (
                <Tag color="green" icon={<UnlockOutlined />}>
                  Đã mở khóa điền phiếu
                </Tag>
              ) : (
                <Tag color="orange" icon={<LockOutlined />}>
                  Khóa điền phiếu
                </Tag>
              )}
            </Space>

            {canModifyItem && (
              <Button
                type="dashed"
                icon={<PlusOutlined />}
                onClick={() => {
                  setEditingItem(null);
                  itemForm.resetFields();
                  itemForm.setFieldsValue({
                    orderIndex: (checklist.items?.length ?? 0) + 1,
                    isRequired: true,
                  });
                  setEditingChecklistVersion(checklist.rowVersion);
                  setItemModalOpen(true);
                }}
              >
                Thêm tiêu chí
              </Button>
            )}
          </div>

          <Table scroll={{ x: 1000 }}
            dataSource={checklist.items || []}
            rowKey="id"
            pagination={false}
            size="small"
            bordered
            columns={[
              {
                title: '#',
                dataIndex: 'orderIndex',
                width: 50,
                align: 'center',
              },
              {
                title: 'Tên tiêu chí / Hạng mục',
                dataIndex: 'name',
                render: (name: string, record: ChecklistItemDto) => (
                  <Space direction="vertical" size={2}>
                    <Text strong>{name}</Text>
                    {record.isRequired && (
                      <Tag color="volcano" style={{ fontSize: 12, padding: '0 4px', margin: 0 }}>
                        Bắt buộc
                      </Tag>
                    )}
                  </Space>
                ),
              },
              {
                title: 'Biểu mẫu',
                key: 'formSchema',
                render: (_: any, record: ChecklistItemDto) => {
                  const count = getComponentCount(record.formSchemaJson);
                  return (
                    <Space size={6}>
                      <Tag color={count > 0 ? 'blue' : 'default'} style={{ margin: 0 }}>
                        {count > 0 ? `${count} trường dữ liệu` : 'Chưa có mẫu'}
                      </Tag>
                      {canModifyItem ? (
                        <Button
                          size="small"
                          type="link"
                          icon={<EditOutlined />}
                          onClick={() => handleOpenFormBuilder(record)}
                        >
                          Thiết kế biểu mẫu
                        </Button>
                      ) : (
                        <Button
                          size="small"
                          type="link"
                          icon={<FileTextOutlined />}
                          onClick={() => handleOpenFormBuilder(record)}
                        >
                          Xem biểu mẫu
                        </Button>
                      )}
                    </Space>
                  );
                },
              },
              {
                title: 'Phiếu nghiệm thu hiện trường',
                key: 'inspection',
                render: (_: any, record: ChecklistItemDto) => {
                  if (record.linkedInspectionId || checklist.canFillInspection) {
                    if (record.linkedInspectionId) {
                      return (
                        <Space size={6}>
                          <StatusBadge domain="inspection" status={record.linkedInspectionStatus} />
                          <Button
                            size="small"
                            type="link"
                            icon={<FileTextOutlined />}
                            onClick={() => {
                              setInspectionTargetItem(record);
                              setInspectionModalOpen(true);
                            }}
                          >
                            {isSubmitter && checklist.canFillInspection && (record.linkedInspectionStatus === 'Draft' || record.linkedInspectionStatus === 'Rejected') ? 'Xem / Cập nhật' : 'Xem phiếu'}
                          </Button>
                        </Space>
                      );
                    }

                    if (isSubmitter) {
                      return (
                        <Button
                          size="small"
                          type="primary"
                          ghost
                          icon={<EditOutlined />}
                          onClick={() => {
                            setInspectionTargetItem(record);
                            setInspectionModalOpen(true);
                          }}
                        >
                          Điền phiếu nghiệm thu
                        </Button>
                      );
                    }

                    return <Text type="secondary" style={{ fontSize: 12 }}>Chưa có phiếu</Text>;
                  }

                  return (
                    <Tooltip title="Chỉ mở chức năng điền phiếu nghiệm thu sau khi Giám sát phê duyệt Kế hoạch Checklist.">
                      <Tag color="default" icon={<LockOutlined />}>
                        Khóa (Chờ duyệt kế hoạch)
                      </Tag>
                    </Tooltip>
                  );
                },
              },
              {
                title: 'Kết quả',
                dataIndex: 'status',
                width: 130,
                align: 'center',
                render: (status: string) => (
                  <Tag
                    color={status === 'Done' ? 'success' : 'default'}
                    icon={status === 'Done' ? <CheckCircleOutlined /> : undefined}
                    style={{ fontWeight: 600 }}
                  >
                    {status === 'Done' ? 'Đạt' : 'Chờ nghiệm thu'}
                  </Tag>
                ),
              },
              {
                title: 'Thao tác & Phê duyệt',
                key: 'actions',
                width: 210,
                align: 'center',
                render: (_: any, record: ChecklistItemDto) => {
                  // Giai đoạn nghiệm thu hiện trường: Giám sát và CĐT thẩm tra & phê duyệt trực tiếp trong Checklist
                  if (record.linkedInspectionId && record.linkedInspectionWorkflowSyncStatus && record.linkedInspectionWorkflowSyncStatus !== 'Synchronized') {
                    return <StatusBadge domain="sync" status={record.linkedInspectionWorkflowSyncStatus} />;
                  }
                  if (record.linkedInspectionStatus === 'Approved') {
                    return <Tag color="success" icon={<CheckCircleOutlined />}>Đã hoàn thành</Tag>;
                  }
                  if (checklist.canFillInspection && record.linkedInspectionId) {
                    // Reviewer tiếp nhận trước, sau đó thẩm tra cấp 1.
                    if (isReviewer && (record.linkedInspectionStatus === 'Submitted' || record.linkedInspectionStatus === 'UnderReview')) {
                      return (
                        <Space size={6}>
                          <Popconfirm
                            title={record.linkedInspectionStatus === 'Submitted' ? 'Tiếp nhận hồ sơ?' : 'Xác nhận thẩm tra ĐẠT?'}
                            description={record.linkedInspectionStatus === 'Submitted' ? `Tiếp nhận tiêu chí "${record.name}" để thẩm tra.` : `Phê duyệt Cấp 1 cho tiêu chí "${record.name}".`}
                            onConfirm={() => record.linkedInspectionStatus === 'Submitted' ? handleReceiveItemInspection(record) : handleReviewItemInspection(record)}
                            okText={record.linkedInspectionStatus === 'Submitted' ? 'Tiếp nhận' : 'Duyệt Đạt'}
                            cancelText="Hủy"
                            okButtonProps={{ loading: actionLoadingId === record.id }}
                          >
                            <Button
                              size="small"
                              type="primary"
                              style={{ backgroundColor: '#166534', borderColor: '#166534' }}
                              icon={<CheckCircleOutlined />}
                              loading={actionLoadingId === record.id}
                            >
                              {record.linkedInspectionStatus === 'Submitted' ? 'Tiếp nhận' : 'Duyệt Cấp 1'}
                            </Button>
                          </Popconfirm>
                          <Button
                            size="small"
                            danger
                            icon={<CloseCircleOutlined />}
                            onClick={() => {
                              setItemRejectTarget(record);
                              setItemRejectModalOpen(true);
                            }}
                          >
                            Yêu cầu sửa
                          </Button>
                        </Space>
                      );
                    }

                    // Approver phê duyệt Cấp 2 khi hồ sơ ở trạng thái Reviewed
                    if (isApprover && record.linkedInspectionStatus === 'Reviewed') {
                      return (
                        <Space size={6}>
                          <Popconfirm
                            title="Phê duyệt nghiệm thu chính thức?"
                            description={`Phê duyệt Cấp 2 cho tiêu chí "${record.name}" và chuyển sang ĐẠT.`}
                            onConfirm={() => handleApproveItemInspection(record)}
                            okText="Phê duyệt"
                            cancelText="Hủy"
                            okButtonProps={{ loading: actionLoadingId === record.id }}
                          >
                            <Button
                              size="small"
                              type="primary"
                              style={{ backgroundColor: '#166534', borderColor: '#166534' }}
                              icon={<CheckCircleOutlined />}
                              loading={actionLoadingId === record.id}
                            >
                              Duyệt Cấp 2
                            </Button>
                          </Popconfirm>
                          <Button
                            size="small"
                            danger
                            icon={<CloseCircleOutlined />}
                            onClick={() => {
                              setItemRejectTarget(record);
                              setItemRejectModalOpen(true);
                            }}
                          >
                            Từ chối
                          </Button>
                        </Space>
                      );
                    }

                    // Trạng thái đã duyệt xong hoặc đang chờ
                    if (isReviewer && record.linkedInspectionStatus === 'Reviewed') {
                      return <StatusBadge domain="inspection" status="Reviewed" />;
                    }
                    if (record.linkedInspectionStatus === 'Rejected') {
                      return <StatusBadge domain="inspection" status="Rejected" />;
                    }
                  }

                  // Giai đoạn lập kế hoạch (Draft/PendingSupervisor): Cho phép chỉnh sửa/xóa
                  if (canModifyItem) {
                    return (
                      <Space size={2}>
                        <Tooltip title="Chỉnh sửa tên & cấu hình">
                          <Button aria-label="Chỉnh sửa tên & cấu hình"
                            type="text"
                            size="small"
                            icon={<EditOutlined style={{ color: '#1D4ED8' }} />}
                            onClick={() => handleOpenEditItem(record)}
                          />
                        </Tooltip>
                        <Popconfirm
                          title="Xóa tiêu chí này?"
                          description="Hành động này sẽ xóa mềm tiêu chí khỏi checklist."
                          onConfirm={() => deleteItemMutation.mutate(record)}
                          okText="Xóa"
                          cancelText="Hủy"
                          okButtonProps={{ danger: true }}
                          disabled={!!record.linkedInspectionId}
                        >
                          <Tooltip title={record.linkedInspectionId ? 'Không thể xóa tiêu chí đã gắn phiếu' : 'Xóa tiêu chí'}>
                            <Button aria-label={record.linkedInspectionId ? 'Không thể xóa tiêu chí đã gắn phiếu' : 'Xóa tiêu chí'}
                              type="text"
                              size="small"
                              danger
                              disabled={!!record.linkedInspectionId}
                              icon={<DeleteOutlined />}
                            />
                          </Tooltip>
                        </Popconfirm>
                      </Space>
                    );
                  }

                  return <Text type="secondary" style={{ fontSize: 12 }}>-</Text>;
                },
              },
            ]}
          />

          <Divider style={{ margin: '8px 0' }} />

          {/* Thanh công cụ hành động phía dưới */}

        </div>
      </Modal>

      {/* Modal: Thêm / Sửa tiêu chí */}
      <Modal
        open={itemModalOpen}
        onCancel={() => closeForm(() => {
          setFormDirty(false);
      setItemModalOpen(false);
          setEditingItem(null);
        })}
        zIndex={1350}
        title={editingItem ? 'Chỉnh sửa tiêu chí' : 'Thêm tiêu chí mới'}
        onOk={() => {
          itemForm.validateFields()
            .then((values) => {
              if (editingItem) {
                updateItemMutation.mutate({
                  itemId: editingItem.id,
                  values: {
                    ...values,
                    formSchemaJson: editingItem.formSchemaJson,
                  },
                });
              } else {
                addItemMutation.mutate(values);
              }
            })
            .catch((err) => console.warn('Item form validation error:', err));
        }}
        confirmLoading={addItemMutation.isPending || updateItemMutation.isPending}
        okText={editingItem ? 'Cập nhật' : 'Thêm mới'}
        cancelText="Hủy"
      >
        <Form form={itemForm} layout="vertical" initialValues={{ isRequired: true, orderIndex: 1 }} onValuesChange={() => setFormDirty(true)}>
          <Form.Item
            name="name"
            label="Tên tiêu chí / Hạng mục kiểm tra"
            rules={[{ required: true, message: 'Vui lòng nhập tên tiêu chí!' }]}
          >
            <Input placeholder="Ví dụ: Nghiệm thu cốt thép dầm..." />
          </Form.Item>
          <div style={{ display: 'flex', gap: 16 }}>
            <Form.Item name="orderIndex" label="Thứ tự hiển thị" style={{ flex: 1 }}>
              <InputNumber min={1} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item
              name="isRequired"
              label="Bắt buộc đạt?"
              valuePropName="checked"
              style={{ flex: 1 }}
            >
              <Switch checkedChildren="Có" unCheckedChildren="Không" />
            </Form.Item>
          </div>
        </Form>
      </Modal>

      {/* Modal: Giám sát Từ chối kế hoạch */}
      <Modal
        open={rejectModalOpen}
        onCancel={() => closeForm(() => setRejectModalOpen(false))}
        zIndex={1350}
        title="Từ chối kế hoạch Checklist"
        okText="Xác nhận từ chối"
        cancelText="Hủy"
        okButtonProps={{ danger: true }}
        onOk={() => {
          rejectForm.validateFields()
            .then((values) => {
              rejectMutation.mutate(values.reason);
            })
            .catch((err) => console.warn('Reject form validation error:', err));
        }}
        confirmLoading={rejectMutation.isPending}
      >
        <Form form={rejectForm} layout="vertical" onValuesChange={() => setFormDirty(true)}>
          <Form.Item
            name="reason"
            label="Lý do từ chối (Gửi phản hồi cho Kỹ sư)"
            rules={[{ required: true, message: 'Vui lòng nhập lý do từ chối!' }]}
          >
            <Input.TextArea
              rows={4}
              placeholder="Ví dụ: Cần bổ sung biểu mẫu kiểm tra chứng chỉ thí nghiệm kéo uốn cốt thép..."
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal: Điền & Xem Phiếu Nghiệm Thu gắn trực tiếp với Checklist Item */}
      {inspectionTargetItem && checklist && (
        <ItemInspectionModal
          open={inspectionModalOpen}
          item={inspectionTargetItem}
          checklist={checklist}
          onClose={() => {
            setInspectionModalOpen(false);
            setInspectionTargetItem(null);
          }}
          onSuccess={() => {
            refetch();
            if (onRefresh) onRefresh();
          }}
        />
      )}

      {/* Visual biểu mẫu Builder Modal */}
      {builderTargetItem && (
        <FormIoBuilderModal
          visible={builderModalOpen}
          initialSchema={
            builderTargetItem.formSchemaJson && builderTargetItem.formSchemaJson !== '{}'
              ? JSON.parse(builderTargetItem.formSchemaJson)
              : null
          }
          onCancel={() => {
            setBuilderModalOpen(false);
            setBuilderTargetItem(null);
          }}
          onSave={handleSaveFormSchema}
        />
      )}

      {/* Modal: Giám sát / CĐT Từ chối tiêu chí nghiệm thu */}
      <Modal
        open={itemRejectModalOpen}
        onCancel={() => closeForm(() => { setItemRejectModalOpen(false); setItemRejectTarget(null); itemRejectForm.resetFields(); })}
        zIndex={1360}
        title={
          <Space>
            <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
            <span>
              {isReviewer
                ? `Yêu cầu sửa đổi tiêu chí: ${itemRejectTarget?.name || ''}`
                : `Từ chối phê duyệt tiêu chí: ${itemRejectTarget?.name || ''}`}
            </span>
          </Space>
        }
        okText="Xác nhận từ chối"
        cancelText="Hủy"
        okButtonProps={{ danger: true, loading: actionLoadingId !== null }}
        onOk={handleConfirmRejectItem}
      >
        <Form form={itemRejectForm} layout="vertical" onValuesChange={() => setFormDirty(true)}>
          <Form.Item
            name="reason"
            label={
              isReviewer
                ? 'Nội dung yêu cầu sửa đổi (Gửi phản hồi cho Kỹ sư hiện trường)'
                : 'Lý do từ chối phê duyệt nghiệm thu'
            }
            rules={[
              { required: true, message: 'Vui lòng nhập lý do từ chối!' },
              { min: 3, message: 'Lý do phải có ít nhất 3 ký tự!' },
            ]}
          >
            <Input.TextArea
              rows={4}
              placeholder={
                isReviewer
                  ? 'Ví dụ: Kích thước hình học chưa đạt, cần kiểm tra và khắc phục lại...'
                  : 'Ví dụ: Cần đối chiếu lại với bản vẽ hoàn công và nhật ký thi công...'
              }
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* Nhật ký kiểm toán Drawer */}
      <ChecklistAuditTrailDrawer
        open={auditDrawerOpen}
        onClose={() => setAuditDrawerOpen(false)}
        auditHistories={checklist.auditHistories || []}
        checklistName={checklist.name}
      />
    </>
  );
};
