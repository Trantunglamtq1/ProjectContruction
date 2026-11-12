import {
  CheckSquareOutlined,
  DeleteOutlined,
  PlusOutlined,
  RightOutlined,
} from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Button,
  Card,
  Checkbox,
  Empty,
  Form,
  Input,
  message,
  Modal,
  Popconfirm,
  Progress,
  Space,
  Spin,
  Typography
} from 'antd';
import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useUnsavedChanges } from '../../contexts/UnsavedChangesContext';
import { checklistApi } from '../../services/checklistApi';
import type { ChecklistDto, ChecklistStatus, ChecklistSummaryDto } from '../../types/checklist';
import { StatusBadge } from '../ui/StatusBadge';
import { ChecklistDetailModal } from './ChecklistDetailModal';
import { ChecklistSyncTag } from './ChecklistSyncTag';

const { Text, Title, Paragraph } = Typography;

interface ObjectChecklistsModalProps {
  open: boolean;
  objectId: string | null;
  objectName?: string;
  objectCode?: string;
  onClose: () => void;
}

export const ObjectChecklistsModal: React.FC<ObjectChecklistsModalProps> = ({
  open,
  objectId,
  objectName,
  objectCode,
  onClose,
}) => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const currentRole = ((Array.isArray(user?.role) ? user?.role[0] : user?.role) as string) || '';
  const isSubmitter = currentRole === 'Submitter';

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createDirty, setCreateDirty] = useState(false);
  const confirmDiscard = useUnsavedChanges(open && createDirty);
  const [selectedChecklistId, setSelectedChecklistId] = useState<string | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [createForm] = Form.useForm();

  // Query tóm tắt Checklist theo Object
  const {
    data: summary,
    refetch: refetchSummary,
    isLoading: summaryLoading,
  } = useQuery<ChecklistSummaryDto>({
    queryKey: ['checklist-summary-object', objectId],
    queryFn: () => checklistApi.getChecklistSummaryByObject(objectId!),
    enabled: open && !!objectId,
  });

  // Query trực tiếp danh sách Checklist theo Object (đảm bảo không bị rỗng)
  const {
    data: rawChecklists = [],
    refetch: refetchList,
    isLoading: listLoading,
  } = useQuery<ChecklistDto[]>({
    queryKey: ['checklists-for-object', objectId],
    queryFn: () => checklistApi.getChecklists({ objectId: objectId! }),
    enabled: open && !!objectId,
  });

  const displayChecklists = (summary?.checklists && summary.checklists.length > 0)
    ? summary.checklists
    : rawChecklists;

  // Mutation: Tạo Checklist mới
  const createMutation = useMutation({
    mutationFn: (values: any) => {
      if (!objectId) {
        throw new Error('Không tìm thấy ID cấu kiện để tạo Checklist.');
      }
      return checklistApi.createChecklist({
        objectId: objectId,
        name: values.name?.trim(),
        description: values.description?.trim(),
        items: values.quickTemplates
          ? [
              { name: '1. Nghiệm thu công tác cốt thép', orderIndex: 1, isRequired: true },
              { name: '2. Nghiệm thu ván khuôn & cốp pha', orderIndex: 2, isRequired: true },
              { name: '3. Nghiệm thu công tác bê tông', orderIndex: 3, isRequired: true },
            ]
          : undefined,
      });
    },
    onSuccess: (data: ChecklistDto) => {
      message.success('Đã khởi tạo bản nháp Checklist thành công!');
      setCreateModalOpen(false);
      setCreateDirty(false);
      createForm.resetFields();
      refetchSummary();
      refetchList();
      queryClient.invalidateQueries({ queryKey: ['checklists'] });
      queryClient.invalidateQueries({ queryKey: ['checklist-summary-object'] });
      // Mở ngay chi tiết để Kỹ sư tiếp tục cấu hình schema biểu mẫu
      setSelectedChecklistId(data.id);
      setDetailModalOpen(true);
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || 'Lỗi khi tạo Checklist.';
      message.error(msg);
    },
  });

  // Mutation: Xóa bản nháp Checklist
  const deleteMutation = useMutation({
    mutationFn: (checklist: ChecklistDto) => checklistApi.deleteChecklist(checklist.id, checklist.rowVersion),
    onSuccess: () => {
      message.success('Đã xóa bản nháp Checklist thành công!');
      refetchSummary();
      refetchList();
      queryClient.invalidateQueries({ queryKey: ['checklists'] });
      queryClient.invalidateQueries({ queryKey: ['checklist-summary-object'] });
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || 'Lỗi khi xóa Checklist.';
      message.error(msg);
    },
  });

  const getStatusTag = (status: ChecklistStatus) => <StatusBadge domain="checklist" status={status} />;

  return (
    <>
      <Modal
        open={open && !detailModalOpen && !createModalOpen}
        onCancel={onClose}
        width={{ xs: 'calc(100vw - 24px)', md: 760 }}
        className="detail-modal"
        zIndex={1100}
        footer={null}
        title={
          <Space>
            <CheckSquareOutlined style={{ fontSize: 20, color: '#1D4ED8' }} />
            <div>
              <Title level={5} style={{ margin: 0 }}>
                Hồ Sơ Checklist Cấu Kiện: {objectCode || summary?.objectCode}
              </Title>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {objectName || summary?.objectName}
              </Text>
            </div>
          </Space>
        }
      >
        <Spin spinning={summaryLoading || listLoading}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Header Summary */}
          {summary && summary.totalChecklists > 0 && (
            <Card size="small" style={{ backgroundColor: '#f0f9ff', borderColor: '#bae0ff', borderRadius: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Space direction="vertical" size={2}>
                  <Text strong style={{ color: '#003a8c' }}>
                    Tiến độ hoàn thành cấu kiện: {summary.completedItems} / {summary.totalItems} tiêu chí đạt
                  </Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {summary.totalChecklists} danh mục checklist ({summary.approvedChecklists} đã phê duyệt)
                  </Text>
                </Space>
                <div style={{ width: 140, textAlign: 'right' }}>
                  <Progress
                    percent={summary.overallProgressPercentage}
                    size="small"
                    status={summary.overallProgressPercentage === 100 ? 'success' : 'active'}
                  />
                </div>
              </div>
            </Card>
          )}

          {/* Action: Lập checklist mới */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text strong style={{ fontSize: 14 }}>
              Danh sách Checklist ({displayChecklists.length})
            </Text>
            {isSubmitter && (
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => {
                  createForm.resetFields();
                  createForm.setFieldsValue({
                    name: `Checklist nghiệm thu ${objectName || summary?.objectName || ''}`,
                  });
                  setCreateModalOpen(true);
                }}
              >
                + Lập Checklist mới
              </Button>
            )}
          </div>

          {/* Danh sách các checklist */}
          {displayChecklists.length === 0 ? (
            <Empty
              description="Cấu kiện này chưa có Checklist kiểm tra nào."
              style={{ padding: '30px 0' }}
            >
              {isSubmitter && (
                <Button
                  type="dashed"
                  icon={<PlusOutlined />}
                  onClick={() => {
                    createForm.resetFields();
                    createForm.setFieldsValue({
                      name: `Checklist nghiệm thu ${objectName || summary?.objectName || ''}`.trim(),
                      quickTemplates: true,
                    });
                    setCreateModalOpen(true);
                  }}
                >
                  Khởi tạo Checklist đầu tiên
                </Button>
              )}
            </Empty>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {displayChecklists.map((chk) => (
                <Card
                  key={chk.id}
                  size="small"
                  hoverable
                  style={{
                    borderRadius: 8,
                    border: '1px solid #e2e8f0',
                    transition: 'all 0.2s ease',
                  }}
                  onClick={() => {
                    setSelectedChecklistId(chk.id);
                    setDetailModalOpen(true);
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1, paddingRight: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <Text strong style={{ fontSize: 14, color: '#0f172a' }}>
                          {chk.name}
                        </Text>
                        {getStatusTag(chk.status)}
                        <ChecklistSyncTag status={chk.workflowSyncStatus} />
                      </div>
                      {chk.description && (
                        <Paragraph
                          ellipsis={{ rows: 1 }}
                          type="secondary"
                          style={{ margin: 0, fontSize: 12 }}
                        >
                          {chk.description}
                        </Paragraph>
                      )}
                      <div style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: 12, color: '#64748b' }}>
                        <span>Người lập: {chk.createdBy}</span>
                        <span>•</span>
                        <span>Số tiêu chí: {chk.itemsCount}</span>
                        <span>•</span>
                        <span>Tiến độ: {(chk as any).doneItemsCount ?? chk.itemsCompletedCount ?? 0}/{chk.itemsCount} đạt</span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', minWidth: 140 }}>
                      <Progress
                        percent={chk.progressPercentage}
                        size="small"
                        style={{ width: 100, marginBottom: 6 }}
                        status={chk.status === 'Completed' ? 'success' : 'normal'}
                      />
                      <Space size={4}>
                        {isSubmitter && chk.workflowSyncStatus === 'Synchronized' && (chk.status === 'Draft' || chk.status === 'Rejected') && (
                          <Popconfirm
                            title="Xóa kế hoạch Checklist?"
                            description={`Bạn có chắc chắn muốn xóa bản nháp "${chk.name}" không?`}
                            okText="Xóa"
                            cancelText="Hủy"
                            okButtonProps={{ danger: true, loading: deleteMutation.isPending }}
                            onConfirm={(e) => {
                              e?.stopPropagation();
                              deleteMutation.mutate(chk);
                            }}
                            onCancel={(e) => e?.stopPropagation()}
                          >
                            <Button
                              type="text"
                              danger
                              size="small"
                              icon={<DeleteOutlined />}
                              onClick={(e) => e.stopPropagation()}
                            >
                              Xóa
                            </Button>
                          </Popconfirm>
                        )}
                        <Button
                          type="link"
                          size="small"
                          icon={<RightOutlined />}
                          style={{ padding: 0 }}
                        >
                          Chi tiết
                        </Button>
                      </Space>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
          </div>
        </Spin>
      </Modal>

      {/* Modal: Khởi tạo Checklist mới */}
      <Modal
        open={createModalOpen}
        onCancel={() => confirmDiscard(() => { setCreateDirty(false); setCreateModalOpen(false); })}
        title="Lập Checklist Nghiệm Thu Cấu Kiện"
        okText="Tạo bản nháp (Draft)"
        cancelText="Hủy"
        zIndex={1200}
        onOk={() => {
          createForm.validateFields()
            .then((values) => {
              createMutation.mutate(values);
            })
            .catch((err) => {
              console.warn('Form validation errors:', err);
            });
        }}
        confirmLoading={createMutation.isPending}
      >

        <Form
          form={createForm}
          onValuesChange={() => setCreateDirty(true)}
          layout="vertical"
          onFinish={(values) => createMutation.mutate(values)}
        >
          <Form.Item
            name="name"
            label="Tên danh mục Checklist"
            rules={[{ required: true, message: 'Vui lòng nhập tên Checklist!' }]}
          >
            <Input placeholder="Ví dụ: Nghiệm thu hoàn thiện Cột C1 - Tầng 2" />
          </Form.Item>

          <Form.Item name="description" label="Mô tả / Ghi chú kỹ thuật">
            <Input.TextArea rows={2} placeholder="Các yêu cầu kỹ thuật TCVN hoặc bản vẽ thi công..." />
          </Form.Item>

          <Form.Item
            name="quickTemplates"
            valuePropName="checked"
            initialValue={true}
          >
            <Checkbox defaultChecked>
              <span style={{ fontWeight: 600 }}>Tự động khởi tạo 3 tiêu chí cơ bản:</span>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                1. Cốt thép • 2. Cốp pha • 3. Bê tông (Có thể tùy chỉnh sau)
              </div>
            </Checkbox>
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal: Chi tiết Checklist & biểu mẫu Builder & Workflow Approval */}
      {selectedChecklistId && (
        <ChecklistDetailModal
          open={detailModalOpen}
          checklistId={selectedChecklistId}
          onClose={() => {
            setDetailModalOpen(false);
            setSelectedChecklistId(null);
            refetchSummary();
            refetchList();
          }}
          onRefresh={() => {
            refetchSummary();
            refetchList();
          }}
        />
      )}
    </>
  );
};
