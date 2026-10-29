import React, { useState } from 'react';
import {
  Modal,
  Space,
  Typography,
  Tag,
  Button,
  Table,
  Progress,
  Alert,
  Tooltip,
  Popconfirm,
  message,
  Form,
  Input,
  InputNumber,
  Switch,
  Card,
  Divider,
} from 'antd';
import {
  CheckSquareOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SendOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  FileTextOutlined,
  HistoryOutlined,
  LockOutlined,
  UnlockOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { checklistApi } from '../../services/checklistApi';
import { inspectionApi } from '../../services/inspectionApi';
import type {
  ChecklistDto,
  ChecklistItemDto,
  ChecklistStatus,
} from '../../types/checklist';
import type { FormIoSchema } from '../../types/inspection';
import { FormIoBuilderModal } from '../formio/FormIoBuilderModal';
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
  const [auditDrawerOpen, setAuditDrawerOpen] = useState(false);
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ChecklistItemDto | null>(null);
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

  // Query chi tiết Checklist
  const {
    data: checklist,
    refetch,
  } = useQuery<ChecklistDto>({
    queryKey: ['checklist', checklistId],
    queryFn: () => checklistApi.getChecklistById(checklistId!),
    enabled: open && !!checklistId,
  });

  // Mutation: Thêm tiêu chí
  const addItemMutation = useMutation({
    mutationFn: (values: any) =>
      checklistApi.addItem(checklistId!, {
        name: values.name,
        orderIndex: values.orderIndex ?? (checklist?.items.length ?? 0) + 1,
        isRequired: values.isRequired ?? true,
      }),
    onSuccess: () => {
      message.success('Đã thêm tiêu chí mới vào Checklist!');
      setItemModalOpen(false);
      itemForm.resetFields();
      refetch();
      queryClient.invalidateQueries({ queryKey: ['checklists'] });
      onRefresh?.();
    },
    onError: (err: any) => {
      message.error(err.response?.data?.message || 'Lỗi khi thêm tiêu chí.');
    },
  });

  // Mutation: Sửa tiêu chí
  const updateItemMutation = useMutation({
    mutationFn: ({ itemId, values }: { itemId: string; values: any }) =>
      checklistApi.updateItem(checklistId!, itemId, values),
    onSuccess: () => {
      message.success('Đã cập nhật tiêu chí thành công!');
      setItemModalOpen(false);
      setEditingItem(null);
      itemForm.resetFields();
      refetch();
      queryClient.invalidateQueries({ queryKey: ['checklists'] });
      onRefresh?.();
    },
    onError: (err: any) => {
      message.error(err.response?.data?.message || 'Lỗi khi cập nhật tiêu chí.');
    },
  });

  // Mutation: Xóa tiêu chí
  const deleteItemMutation = useMutation({
    mutationFn: (itemId: string) => checklistApi.deleteItem(checklistId!, itemId),
    onSuccess: () => {
      message.success('Đã xóa tiêu chí khỏi Checklist!');
      refetch();
      queryClient.invalidateQueries({ queryKey: ['checklists'] });
      onRefresh?.();
    },
    onError: (err: any) => {
      message.error(err.response?.data?.message || 'Không thể xóa tiêu chí này.');
    },
  });

  // Mutation: Kỹ sư nộp duyệt Checklist (Kích hoạt Elsa Workflow #1)
  const submitMutation = useMutation({
    mutationFn: () => checklistApi.submitForApproval(checklistId!),
    onSuccess: () => {
      message.success('Đã gửi kế hoạch Checklist cho Tư vấn giám sát phê duyệt!');
      refetch();
      queryClient.invalidateQueries({ queryKey: ['checklists'] });
      onRefresh?.();
    },
    onError: (err: any) => {
      message.error(err.response?.data?.message || 'Lỗi khi gửi duyệt kế hoạch.');
    },
  });

  // Mutation: Giám sát phê duyệt
  const approveMutation = useMutation({
    mutationFn: () => checklistApi.supervisorApprove(checklistId!),
    onSuccess: () => {
      message.success('Đã phê duyệt kế hoạch Checklist! Cấu trúc đã được khóa cứng.');
      refetch();
      queryClient.invalidateQueries({ queryKey: ['checklists'] });
      onRefresh?.();
    },
    onError: (err: any) => {
      message.error(err.response?.data?.message || 'Lỗi khi phê duyệt kế hoạch.');
    },
  });

  // Mutation: Giám sát từ chối
  const rejectMutation = useMutation({
    mutationFn: (reason: string) => checklistApi.supervisorReject(checklistId!, { reason }),
    onSuccess: () => {
      message.warning('Đã từ chối kế hoạch Checklist và gửi phản hồi cho Kỹ sư!');
      setRejectModalOpen(false);
      rejectForm.resetFields();
      refetch();
      queryClient.invalidateQueries({ queryKey: ['checklists'] });
      onRefresh?.();
    },
    onError: (err: any) => {
      message.error(err.response?.data?.message || 'Lỗi khi từ chối kế hoạch.');
    },
  });

  // Mutation: Xóa toàn bộ Kế hoạch Checklist (khi còn là Draft hoặc Rejected)
  const deleteChecklistMutation = useMutation({
    mutationFn: () => checklistApi.deleteChecklist(checklistId!),
    onSuccess: () => {
      message.success('Đã xóa bản nháp Checklist thành công!');
      queryClient.invalidateQueries({ queryKey: ['checklists'] });
      queryClient.invalidateQueries({ queryKey: ['checklist-summary-object'] });
      onRefresh?.();
      onClose();
    },
    onError: (err: any) => {
      message.error(err.response?.data?.message || 'Lỗi khi xóa Checklist.');
    },
  });

  // Xử lý Reviewer phê duyệt Cấp 1 phiếu nghiệm thu của tiêu chí bên trong Checklist
  const handleReviewItemInspection = async (item: ChecklistItemDto) => {
    if (!item.linkedInspectionId) return;
    try {
      setActionLoadingId(item.id);
      await inspectionApi.reviewInspection(item.linkedInspectionId);
      message.success(`Đã thẩm tra đạt tiêu chuẩn kỹ thuật tiêu chí "${item.name}"!`);
      refetch();
      queryClient.invalidateQueries({ queryKey: ['checklists'] });
      onRefresh?.();
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Lỗi khi thẩm tra tiêu chí.');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Xử lý Approver phê duyệt Cấp 2 phiếu nghiệm thu của tiêu chí bên trong Checklist
  const handleApproveItemInspection = async (item: ChecklistItemDto) => {
    if (!item.linkedInspectionId) return;
    try {
      setActionLoadingId(item.id);
      await inspectionApi.approveInspection(item.linkedInspectionId);
      message.success(`Đã phê duyệt chính thức tiêu chí "${item.name}" sang ĐẠT!`);
      refetch();
      queryClient.invalidateQueries({ queryKey: ['checklists'] });
      onRefresh?.();
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Lỗi khi phê duyệt tiêu chí.');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Xử lý Từ chối (Reviewer hoặc Approver) phiếu nghiệm thu kèm lý do
  const handleConfirmRejectItem = async () => {
    if (!itemRejectTarget || !itemRejectTarget.linkedInspectionId) return;
    try {
      const values = await itemRejectForm.validateFields();
      setActionLoadingId(itemRejectTarget.id);
      await inspectionApi.rejectInspection(itemRejectTarget.linkedInspectionId, { reason: values.reason });
      message.warning(`Đã từ chối tiêu chí "${itemRejectTarget.name}" và gửi yêu cầu sửa đổi cho Kỹ sư!`);
      setItemRejectModalOpen(false);
      setItemRejectTarget(null);
      itemRejectForm.resetFields();
      refetch();
      queryClient.invalidateQueries({ queryKey: ['checklists'] });
      onRefresh?.();
    } catch (err: any) {
      if (err.errorFields) return;
      message.error(err.response?.data?.message || 'Lỗi khi từ chối tiêu chí.');
    } finally {
      setActionLoadingId(null);
    }
  };

  if (!checklist) return null;

  const canEditStructure =
    (checklist.status === 'Draft' || checklist.status === 'Rejected') && isSubmitter;
  const canSupervisorModify = checklist.status === 'PendingSupervisor' && isReviewer;
  const canModifyItem = canEditStructure || canSupervisorModify;

  // Xử lý mở modal sửa tiêu chí
  const handleOpenEditItem = (item: ChecklistItemDto) => {
    setEditingItem(item);
    itemForm.setFieldsValue({
      name: item.name,
      orderIndex: item.orderIndex,
      isRequired: item.isRequired,
    });
    setItemModalOpen(true);
  };

  // Xử lý mở Form.io Builder cho item
  const handleOpenFormBuilder = (item: ChecklistItemDto) => {
    setBuilderTargetItem(item);
    setBuilderModalOpen(true);
  };

  // Lưu schema từ Form.io Builder vào item
  const handleSaveFormSchema = async (updatedSchema: FormIoSchema) => {
    if (!builderTargetItem) return;
    try {
      const schemaString = JSON.stringify(updatedSchema);
      await checklistApi.updateItem(checklistId!, builderTargetItem.id, {
        name: builderTargetItem.name,
        orderIndex: builderTargetItem.orderIndex,
        isRequired: builderTargetItem.isRequired,
        formSchemaJson: schemaString,
      });
      message.success(`Đã lưu cấu trúc Form.io cho tiêu chí "${builderTargetItem.name}"!`);
      setBuilderModalOpen(false);
      setBuilderTargetItem(null);
      refetch();
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Lỗi khi lưu biểu mẫu Form.io.');
    }
  };

  // Trạng thái badge
  const getStatusTag = (status: ChecklistStatus) => {
    switch (status) {
      case 'Draft':
        return <Tag color="default">Bản nháp (Draft)</Tag>;
      case 'PendingSupervisor':
        return <Tag color="processing">Chờ Giám Sát duyệt</Tag>;
      case 'Approved':
        return <Tag color="cyan">Đã duyệt (Khóa cấu trúc)</Tag>;
      case 'Rejected':
        return <Tag color="error">Từ chối (Cần sửa đổi)</Tag>;
      case 'InProgress':
        return <Tag color="warning">Đang nghiệm thu</Tag>;
      case 'Completed':
        return <Tag color="success">Hoàn thành (Đạt 100%)</Tag>;
      default:
        return <Tag>{status}</Tag>;
    }
  };

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
        open={open}
        onCancel={onClose}
        width={960}
        zIndex={1250}
        footer={null}
        destroyOnClose
        title={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: 24 }}>
            <Space align="center">
              <CheckSquareOutlined style={{ fontSize: 20, color: '#1677ff' }} />
              <Title level={5} style={{ margin: 0 }}>
                {checklist.name}
              </Title>
              {getStatusTag(checklist.status)}
            </Space>
            <Space size={8}>
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
          {/* Thông tin Cấu kiện & Tiến độ */}
          <Card size="small" style={{ backgroundColor: '#f8fafc', borderRadius: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Space direction="vertical" size={2}>
                <Space>
                  <Text strong>Cấu kiện liên kết:</Text>
                  <Tag color="geekblue" style={{ fontWeight: 600 }}>
                    {checklist.objectCode}
                  </Tag>
                  <Text>{checklist.objectName}</Text>
                </Space>
                {checklist.description && (
                  <Text type="secondary" style={{ fontSize: 13 }}>
                    {checklist.description}
                  </Text>
                )}
                {checklist.workflowInstanceId && (
                  <Space size={4}>
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      Elsa Workflow Instance:
                    </Text>
                    <Tag style={{ fontSize: 10 }}>{checklist.workflowInstanceId}</Tag>
                  </Space>
                )}
              </Space>

              <div style={{ textAlign: 'right', minWidth: 200 }}>
                <Text strong style={{ fontSize: 13 }}>
                  Tiến độ nghiệm thu: {checklist.itemsCompletedCount} / {checklist.itemsCount} đạt
                </Text>
                <Progress
                  percent={checklist.progressPercentage}
                  status={checklist.status === 'Completed' ? 'success' : 'active'}
                  strokeColor={checklist.status === 'Completed' ? '#52c41a' : '#1677ff'}
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
                        Vui lòng chỉnh sửa tiêu chí hoặc biểu mẫu Form.io bên dưới, sau đó bấm <b>"Gửi duyệt lại"</b>.
                      </Text>
                    )}
                  </div>
                }
                style={{ marginTop: 8 }}
              />
            )}

            {checklist.status === 'PendingSupervisor' && (
              <Alert
                type="info"
                showIcon
                message="Kế hoạch đang chờ thẩm tra"
                description={
                  isReviewer
                    ? 'Bạn có quyền can thiệp chỉnh sửa trực tiếp tiêu chí, biểu mẫu Form.io trước khi Phê duyệt hoặc Từ chối.'
                    : 'Kế hoạch đã nộp cho Tư vấn giám sát. Đang chờ phê duyệt cấu trúc biểu mẫu.'
                }
                style={{ marginTop: 8 }}
              />
            )}

            {(checklist.status === 'Approved' || checklist.status === 'InProgress') && (
              <Alert
                type="success"
                showIcon
                message={
                  <Space>
                    <LockOutlined />
                    <span>Cấu trúc Checklist đã được phê duyệt và khóa cứng</span>
                  </Space>
                }
                description="Tiến trình đang ở Giai đoạn 2 (Thi công & Nghiệm thu). Kỹ sư có thể tạo phiếu nghiệm thu và liên kết vào từng tiêu chí."
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
              {checklist.canFillInspection ? (
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
                  setItemModalOpen(true);
                }}
              >
                Thêm tiêu chí
              </Button>
            )}
          </div>

          <Table
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
                      <Tag color="volcano" style={{ fontSize: 10, padding: '0 4px', margin: 0 }}>
                        Bắt buộc
                      </Tag>
                    )}
                  </Space>
                ),
              },
              {
                title: 'Biểu mẫu Form.io',
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
                          Thiết kế Form
                        </Button>
                      ) : (
                        <Button
                          size="small"
                          type="link"
                          icon={<FileTextOutlined />}
                          onClick={() => handleOpenFormBuilder(record)}
                        >
                          Xem Form
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
                  if (checklist.canFillInspection) {
                    if (record.linkedInspectionId) {
                      return (
                        <Space size={6}>
                          <Tag
                            color={
                              record.linkedInspectionStatus === 'Approved'
                                ? 'success'
                                : record.linkedInspectionStatus === 'Reviewed'
                                  ? 'blue'
                                  : record.linkedInspectionStatus === 'Submitted'
                                    ? 'processing'
                                    : record.linkedInspectionStatus === 'Rejected'
                                      ? 'error'
                                      : 'default'
                            }
                          >
                            {record.linkedInspectionStatus === 'Approved'
                              ? 'Đã duyệt'
                              : record.linkedInspectionStatus === 'Reviewed'
                                ? 'Đã thẩm tra'
                                : record.linkedInspectionStatus === 'Submitted'
                                  ? 'Chờ duyệt'
                                  : record.linkedInspectionStatus === 'Rejected'
                                    ? 'Cần sửa đổi'
                                    : 'Bản nháp'}
                          </Tag>
                          <Button
                            size="small"
                            type="link"
                            icon={<FileTextOutlined />}
                            onClick={() => {
                              setInspectionTargetItem(record);
                              setInspectionModalOpen(true);
                            }}
                          >
                            {isSubmitter ? 'Xem / Cập nhật' : 'Xem phiếu'}
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
                    {status === 'Done' ? 'ĐẠT (Done)' : 'Chờ nghiệm thu'}
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
                  if (checklist.canFillInspection && record.linkedInspectionId) {
                    // Reviewer thẩm tra Cấp 1 khi hồ sơ ở trạng thái Submitted
                    if (isReviewer && record.linkedInspectionStatus === 'Submitted') {
                      return (
                        <Space size={6}>
                          <Popconfirm
                            title="Xác nhận thẩm tra ĐẠT?"
                            description={`Phê duyệt Cấp 1 cho tiêu chí "${record.name}".`}
                            onConfirm={() => handleReviewItemInspection(record)}
                            okText="Duyệt Đạt"
                            cancelText="Hủy"
                            okButtonProps={{ loading: actionLoadingId === record.id }}
                          >
                            <Button
                              size="small"
                              type="primary"
                              style={{ backgroundColor: '#52c41a', borderColor: '#52c41a' }}
                              icon={<CheckCircleOutlined />}
                              loading={actionLoadingId === record.id}
                            >
                              Duyệt Cấp 1
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
                              style={{ backgroundColor: '#52c41a', borderColor: '#52c41a' }}
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
                    if (record.linkedInspectionStatus === 'Approved') {
                      return <Tag color="success" icon={<CheckCircleOutlined />}>Đã hoàn thành</Tag>;
                    }
                    if (isReviewer && record.linkedInspectionStatus === 'Reviewed') {
                      return <Tag color="blue" icon={<ClockCircleOutlined />}>Đã duyệt C1 (Chờ CĐT)</Tag>;
                    }
                    if (record.linkedInspectionStatus === 'Rejected') {
                      return <Tag color="error" icon={<CloseCircleOutlined />}>Đã từ chối</Tag>;
                    }
                  }

                  // Giai đoạn lập kế hoạch (Draft/PendingSupervisor): Cho phép chỉnh sửa/xóa
                  if (canModifyItem) {
                    return (
                      <Space size={2}>
                        <Tooltip title="Chỉnh sửa tên & cấu hình">
                          <Button
                            type="text"
                            size="small"
                            icon={<EditOutlined style={{ color: '#1677ff' }} />}
                            onClick={() => handleOpenEditItem(record)}
                          />
                        </Tooltip>
                        <Popconfirm
                          title="Xóa tiêu chí này?"
                          description="Hành động này sẽ xóa mềm tiêu chí khỏi checklist."
                          onConfirm={() => deleteItemMutation.mutate(record.id)}
                          okText="Xóa"
                          cancelText="Hủy"
                          okButtonProps={{ danger: true }}
                          disabled={!!record.linkedInspectionId}
                        >
                          <Tooltip title={record.linkedInspectionId ? 'Không thể xóa tiêu chí đã gắn phiếu' : 'Xóa tiêu chí'}>
                            <Button
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
              {checklist.status === 'PendingSupervisor' && isReviewer && (
                <>
                  <Button
                    danger
                    icon={<CloseCircleOutlined />}
                    onClick={() => setRejectModalOpen(true)}
                  >
                    Từ chối kế hoạch
                  </Button>
                  <Button
                    type="primary"
                    style={{ backgroundColor: '#52c41a', borderColor: '#52c41a' }}
                    icon={<CheckCircleOutlined />}
                    loading={approveMutation.isPending}
                    onClick={() => approveMutation.mutate()}
                  >
                    Phê duyệt kế hoạch
                  </Button>
                </>
              )}
            </Space>
          </div>
        </div>
      </Modal>

      {/* Modal: Thêm / Sửa tiêu chí */}
      <Modal
        open={itemModalOpen}
        onCancel={() => {
          setItemModalOpen(false);
          setEditingItem(null);
        }}
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
        <Form form={itemForm} layout="vertical" initialValues={{ isRequired: true, orderIndex: 1 }}>
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
        onCancel={() => setRejectModalOpen(false)}
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
        <Form form={rejectForm} layout="vertical">
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

      {/* Visual Form.io Builder Modal */}
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
        onCancel={() => {
          setItemRejectModalOpen(false);
          setItemRejectTarget(null);
          itemRejectForm.resetFields();
        }}
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
        <Form form={itemRejectForm} layout="vertical">
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
