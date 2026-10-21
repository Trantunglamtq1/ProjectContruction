import React, { useState, useEffect } from 'react';
import {
  Modal,
  Button,
  Space,
  Typography,
  Tag,
  Alert,
  Spin,
  Form,
  message,
} from 'antd';
import {
  FileTextOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  SaveOutlined,
  SendOutlined,
} from '@ant-design/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { inspectionApi } from '../../services/inspectionApi';
import type { ChecklistDto, ChecklistItemDto } from '../../types/checklist';
import type { FormIoSchema, InspectionDto, InspectionStatus } from '../../types/inspection';
import { DynamicFormIoRenderer } from '../formio/DynamicFormIoRenderer';
import { useAuth } from '../../contexts/AuthContext';

const { Text, Title, Paragraph } = Typography;

interface ItemInspectionModalProps {
  open: boolean;
  onClose: () => void;
  item: ChecklistItemDto | null;
  checklist: ChecklistDto;
  onSuccess: () => void;
}

export const ItemInspectionModal: React.FC<ItemInspectionModalProps> = ({
  open,
  onClose,
  item,
  checklist,
  onSuccess,
}) => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const currentRole = ((Array.isArray(user?.role) ? user?.role[0] : user?.role) as string) || '';
  const isSubmitter = currentRole === 'Submitter';
  const isAdmin = currentRole === 'Admin';

  const [form] = Form.useForm();
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [submittingAction, setSubmittingAction] = useState<'draft' | 'submit' | null>(null);

  // Lấy chi tiết phiếu nghiệm thu nếu item đã có linkedInspectionId
  const {
    data: inspection,
    isLoading: loadingInspection,
  } = useQuery<InspectionDto>({
    queryKey: ['inspection-detail', item?.linkedInspectionId],
    queryFn: () => inspectionApi.getInspectionById(item!.linkedInspectionId!),
    enabled: open && !!item?.linkedInspectionId,
  });

  // Parse schema JSON của item
  const parsedSchema: FormIoSchema = React.useMemo(() => {
    if (!item?.formSchemaJson || item.formSchemaJson === '{}') {
      return {
        display: 'form',
        components: [
          {
            type: 'textfield',
            key: 'inspectionTitle',
            label: 'Nội dung kiểm tra / Hạng mục',
            placeholder: `Nghiệm thu: ${item?.name || ''}`,
            required: true,
          },
          {
            type: 'radio',
            key: 'result',
            label: 'Kết luận đánh giá hiện trường',
            required: true,
            values: [
              { label: 'Đạt yêu cầu (Pass)', value: 'pass' },
              { label: 'Không đạt (Fail)', value: 'fail' },
              { label: 'Chờ khắc phục xử lý (Pending Fix)', value: 'pending_fix' },
            ],
          },
          {
            type: 'number',
            key: 'measuredValue',
            label: 'Thông số đo đạc thực tế (nếu có)',
            placeholder: 'Nhập giá trị đo đạc...',
          },
          {
            type: 'textarea',
            key: 'notes',
            label: 'Ghi chú kỹ thuật & Nhật ký hiện trường',
            placeholder: 'Mô tả chi tiết tình trạng thi công thực tế...',
          },
        ],
      };
    }

    try {
      const parsed = JSON.parse(item.formSchemaJson);
      if (parsed.components && Array.isArray(parsed.components) && parsed.components.length > 0) {
        return parsed;
      }
      return {
        display: 'form',
        components: [
          {
            type: 'textfield',
            key: 'inspectionTitle',
            label: 'Nội dung kiểm tra',
            placeholder: `Nghiệm thu: ${item.name}`,
            required: true,
          },
          {
            type: 'radio',
            key: 'result',
            label: 'Kết luận đánh giá',
            required: true,
            values: [
              { label: 'Đạt yêu cầu (Pass)', value: 'pass' },
              { label: 'Không đạt (Fail)', value: 'fail' },
              { label: 'Chờ khắc phục', value: 'pending_fix' },
            ],
          },
          {
            type: 'textarea',
            key: 'notes',
            label: 'Ghi chú hiện trường',
          },
        ],
      };
    } catch {
      return { display: 'form', components: [] };
    }
  }, [item]);

  // Cập nhật formData từ inspection nếu có
  useEffect(() => {
    if (open) {
      if (inspection?.formDataJson) {
        try {
          const parsed = JSON.parse(inspection.formDataJson);
          setFormData(parsed);
          form.setFieldsValue(parsed);
        } catch {
          setFormData({});
          form.resetFields();
        }
      } else {
        const defaultInit = {
          inspectionTitle: `Nghiệm thu: ${item?.name || ''}`,
          result: 'pass',
        };
        setFormData(defaultInit);
        form.setFieldsValue(defaultInit);
      }
    }
  }, [open, inspection, item, form]);

  // Kiểm tra quyền chỉnh sửa
  const canEdit = React.useMemo(() => {
    if (!item) return false;
    if (!item.linkedInspectionId) return isSubmitter || isAdmin;
    if (!inspection) return false;
    return (inspection.status === 'Draft' || inspection.status === 'Rejected') && (isSubmitter || isAdmin);
  }, [item, inspection, isSubmitter, isAdmin]);

  // Trạng thái badge
  const renderStatusTag = (status?: InspectionStatus) => {
    switch (status) {
      case 'Draft':
        return <Tag color="default" icon={<ClockCircleOutlined />}>Bản nháp (Draft)</Tag>;
      case 'Submitted':
        return <Tag color="processing" icon={<ClockCircleOutlined />}>Đã nộp (Chờ Giám sát)</Tag>;
      case 'UnderReview':
        return <Tag color="warning" icon={<ClockCircleOutlined />}>Đang thẩm tra</Tag>;
      case 'Reviewed':
        return <Tag color="blue" icon={<ClockCircleOutlined />}>Đã thẩm tra (Chờ Duyệt)</Tag>;
      case 'Approved':
        return <Tag color="success" icon={<CheckCircleOutlined />}>Đã phê duyệt (Approved)</Tag>;
      case 'Rejected':
        return <Tag color="error" icon={<CloseCircleOutlined />}>Bị từ chối (Rejected)</Tag>;
      default:
        return <Tag color="default">Chưa khởi tạo</Tag>;
    }
  };

  // Submit / Lưu nháp
  const handleSaveOrSubmit = async (isSubmitImmediately: boolean) => {
    if (!item) return;

    try {
      const formValues = await form.validateFields();
      const payloadData = { ...formData, ...formValues };
      const jsonString = JSON.stringify(payloadData);

      setSubmittingAction(isSubmitImmediately ? 'submit' : 'draft');

      if (!item.linkedInspectionId) {
        // Tạo mới phiếu nghiệm thu trực tiếp cho ChecklistItem này
        await inspectionApi.createInspection({
          checklistId: checklist.id,
          checklistItemId: item.id,
          objectId: checklist.objectId,
          formDataJson: jsonString,
          submitImmediately: isSubmitImmediately,
        });

        message.success(
          isSubmitImmediately
            ? `Đã gửi duyệt hồ sơ nghiệm thu tiêu chí "${item.name}"!`
            : `Đã lưu bản nháp nghiệm thu tiêu chí "${item.name}"!`
        );
      } else {
        // Cập nhật phiếu nghiệm thu đang có (Draft hoặc Rejected)
        await inspectionApi.updateInspectionDraft(item.linkedInspectionId, {
          formDataJson: jsonString,
        });

        if (isSubmitImmediately) {
          await inspectionApi.submitInspection(item.linkedInspectionId, {
            formDataJson: jsonString,
          });
          message.success(`Đã nộp hồ sơ nghiệm thu tiêu chí "${item.name}" lên Giám sát!`);
        } else {
          message.success('Đã lưu bản nháp thành công!');
        }
      }

      queryClient.invalidateQueries({ queryKey: ['checklist', checklist.id] });
      queryClient.invalidateQueries({ queryKey: ['checklists'] });
      queryClient.invalidateQueries({ queryKey: ['checklists-for-object'] });
      queryClient.invalidateQueries({ queryKey: ['checklist-summary-object'] });
      queryClient.invalidateQueries({ queryKey: ['inspections'] });

      onSuccess();
      onClose();
    } catch (err: any) {
      if (err.errorFields) {
        message.warning('Vui lòng điền đủ các thông tin bắt buộc trên biểu mẫu.');
        return;
      }
      const errMsg = err.response?.data?.message || err.message || 'Lỗi khi lưu phiếu nghiệm thu.';
      message.error(errMsg);
    } finally {
      setSubmittingAction(null);
    }
  };

  if (!item) return null;

  return (
    <Modal
      open={open}
      onCancel={onClose}
      width={800}
      zIndex={1300}
      destroyOnClose
      title={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: 24 }}>
          <Space>
            <FileTextOutlined style={{ fontSize: 18, color: '#1677ff' }} />
            <div>
              <Title level={5} style={{ margin: 0 }}>
                Phiếu Nghiệm Thu: {item.name}
              </Title>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Checklist: {checklist.name} • Cấu kiện: {checklist.objectCode || checklist.objectName}
              </Text>
            </div>
          </Space>
          {renderStatusTag(inspection?.status)}
        </div>
      }
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            {inspection?.status === 'Approved' && (
              <Tag color="success">
                <CheckCircleOutlined /> Tiêu chí này đã được nghiệm thu ĐẠT
              </Tag>
            )}
          </div>
          <Space>
            <Button onClick={onClose}>Đóng</Button>
            {canEdit && (
              <>
                <Button
                  icon={<SaveOutlined />}
                  loading={submittingAction === 'draft'}
                  onClick={() => handleSaveOrSubmit(false)}
                >
                  Lưu nháp (Draft)
                </Button>
                <Button
                  type="primary"
                  icon={<SendOutlined />}
                  loading={submittingAction === 'submit'}
                  onClick={() => handleSaveOrSubmit(true)}
                >
                  Gửi nghiệm thu (Submit)
                </Button>
              </>
            )}
          </Space>
        </div>
      }
    >
      <div style={{ maxHeight: 'calc(80vh - 160px)', overflowY: 'auto', paddingRight: 8 }}>
        {/* Banner cảnh báo nếu bị từ chối */}
        {inspection?.status === 'Rejected' && inspection.rejectReason && (
          <Alert
            type="error"
            showIcon
            message="Hồ sơ bị Tư vấn giám sát yêu cầu sửa đổi"
            description={
              <div>
                <Paragraph style={{ margin: '4px 0', color: '#cf1322', fontWeight: 500 }}>
                  Lý do: {inspection.rejectReason}
                </Paragraph>
                <Text style={{ fontSize: 12 }}>
                  Vui lòng điều chỉnh các thông số hoặc bổ sung hình ảnh bên dưới, sau đó bấm <b>"Gửi nghiệm thu"</b> để nộp lại.
                </Text>
              </div>
            }
            style={{ marginBottom: 16 }}
          />
        )}

        {/* Thông tin ngữ cảnh Checklist */}
        <div
          style={{
            backgroundColor: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            padding: '10px 14px',
            marginBottom: 16,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Space direction="vertical" size={2}>
            <Text style={{ fontSize: 12, color: '#64748b' }}>
              Phiếu kiểm tra này thuộc Checklist cố định: <b>{checklist.name}</b>
            </Text>
            <Text style={{ fontSize: 12, color: '#64748b' }}>
              Mục kiểm tra thứ {item.orderIndex}: <b>{item.name}</b> {item.isRequired && <Tag color="volcano" style={{ fontSize: 10 }}>Bắt buộc</Tag>}
            </Text>
          </Space>
          {checklist.canFillInspection ? (
            <Tag color="cyan">Giai đoạn 2: Nghiệm thu hiện trường</Tag>
          ) : (
            <Tag color="orange">Giai đoạn 1: Lập kế hoạch</Tag>
          )}
        </div>

        {loadingInspection ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <Spin tip="Đang tải dữ liệu biểu mẫu nghiệm thu..." />
          </div>
        ) : (
          <DynamicFormIoRenderer
            schema={parsedSchema}
            initialData={formData}
            readonly={!canEdit}
            form={form}
            onChange={(vals) => setFormData(vals)}
          />
        )}
      </div>
    </Modal>
  );
};
