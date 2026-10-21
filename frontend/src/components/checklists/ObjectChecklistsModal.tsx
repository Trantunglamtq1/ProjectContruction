import React, { useState } from 'react';
import {
  Modal,
  Space,
  Typography,
  Tag,
  Button,
  Card,
  Progress,
  Empty,
  Form,
  Input,
  Checkbox,
  message,
  Alert,
  Spin,
} from 'antd';
import {
  CheckSquareOutlined,
  PlusOutlined,
  RightOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { checklistApi } from '../../services/checklistApi';
import type { ChecklistDto, ChecklistSummaryDto } from '../../types/checklist';
import { ChecklistDetailModal } from './ChecklistDetailModal';

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
  const isAdmin = currentRole === 'Admin';

  const [createModalOpen, setCreateModalOpen] = useState(false);
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
      createForm.resetFields();
      refetchSummary();
      refetchList();
      queryClient.invalidateQueries({ queryKey: ['checklists'] });
      queryClient.invalidateQueries({ queryKey: ['checklist-summary-object'] });
      // Mở ngay chi tiết để Kỹ sư tiếp tục cấu hình schema Form.io
      setSelectedChecklistId(data.id);
      setDetailModalOpen(true);
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || 'Lỗi khi tạo Checklist.';
      message.error(msg);
    },
  });

  const getStatusTag = (status: string) => {
    switch (status) {
      case 'Draft':
        return <Tag color="default">Bản nháp</Tag>;
      case 'PendingSupervisor':
        return <Tag color="processing">Chờ Giám sát duyệt</Tag>;
      case 'Approved':
        return <Tag color="cyan">Đã duyệt (Khóa cấu trúc)</Tag>;
      case 'Rejected':
        return <Tag color="error">Cần sửa đổi</Tag>;
      case 'InProgress':
        return <Tag color="warning">Đang nghiệm thu</Tag>;
      case 'Completed':
        return <Tag color="success">Hoàn thành</Tag>;
      default:
        return <Tag>{status}</Tag>;
    }
  };

  return (
    <>
      <Modal
        open={open}
        onCancel={onClose}
        width={720}
        zIndex={1100}
        footer={null}
        title={
          <Space>
            <CheckSquareOutlined style={{ fontSize: 20, color: '#1677ff' }} />
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
            {(isSubmitter || isAdmin) && (
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
              {(isSubmitter || isAdmin) && (
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
                      <div style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: 11, color: '#64748b' }}>
                        <span>Người lập: {chk.createdBy}</span>
                        <span>•</span>
                        <span>Số tiêu chí: {chk.itemsCount}</span>
                        <span>•</span>
                        <span>Tiến độ: {(chk as any).doneItemsCount ?? chk.itemsCompletedCount ?? 0}/{chk.itemsCount} đạt</span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', minWidth: 120 }}>
                      <Progress
                        percent={chk.progressPercentage}
                        size="small"
                        style={{ width: 100, marginBottom: 6 }}
                        status={chk.status === 'Completed' ? 'success' : 'normal'}
                      />
                      <Button
                        type="link"
                        size="small"
                        icon={<RightOutlined />}
                        style={{ padding: 0 }}
                      >
                        Chi tiết
                      </Button>
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
        onCancel={() => setCreateModalOpen(false)}
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
        <Alert
          type="info"
          showIcon
          message="Giai đoạn 1: Lập kế hoạch & Thiết kế Form.io"
          description="Sau khi tạo bản nháp, Kỹ sư sẽ thiết kế cấu trúc biểu mẫu Form.io cho từng tiêu chí trước khi gửi duyệt cho Tư vấn giám sát."
          style={{ marginBottom: 16 }}
        />

        <Form
          form={createForm}
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

      {/* Modal: Chi tiết Checklist & Form.io Builder & Workflow Approval */}
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
