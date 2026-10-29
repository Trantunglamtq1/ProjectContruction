import React, { useState, useEffect, useMemo } from 'react';
import {
  Modal,
  Button,
  Space,
  Typography,
  Tag,
  Alert,
  Spin,
  Form,
  Input,
  Card,
  message,
} from 'antd';
import {
  FileTextOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  SaveOutlined,
  SendOutlined,
  ToolOutlined,
  PictureOutlined,
  InfoCircleOutlined,
  AppstoreOutlined,
} from '@ant-design/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { inspectionApi } from '../../services/inspectionApi';
import type { ChecklistDto, ChecklistItemDto } from '../../types/checklist';
import type {
  FormIoSchema,
  InspectionDto,
  InspectionStatus,
  InspectionAttachmentDto,
} from '../../types/inspection';
import { DynamicFormIoRenderer } from '../formio/DynamicFormIoRenderer';
import { FormIoBuilderModal } from '../formio/FormIoBuilderModal';
import { InspectionImageGallery } from '../inspections/InspectionImageGallery';
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
  const isReviewer = currentRole === 'Reviewer';
  const isApprover = currentRole === 'Approver';

  const [form] = Form.useForm();
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [attachments, setAttachments] = useState<InspectionAttachmentDto[]>([]);
  const [customSchema, setCustomSchema] = useState<FormIoSchema | null>(null);
  const [builderModalOpen, setBuilderModalOpen] = useState(false);
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

  // Parse schema JSON mặc định của item
  const parsedItemSchema: FormIoSchema = useMemo(() => {
    if (!item?.formSchemaJson || item.formSchemaJson === '{}') {
      return {
        display: 'form',
        components: [
          {
            type: 'textfield',
            key: 'inspectionTitle',
            label: 'Nội dung kiểm tra / Hạng mục',
            placeholder: `Nghiệm thu: ${item?.name || ''}`,
            validate: { required: true },
          },
          {
            type: 'radio',
            key: 'result',
            label: 'Kết luận đánh giá hiện trường',
            validate: { required: true },
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
            placeholder: 'Nhập số liệu đo đạc...',
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
            validate: { required: true },
          },
          {
            type: 'radio',
            key: 'result',
            label: 'Kết luận đánh giá',
            validate: { required: true },
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

  const activeSchema = customSchema || parsedItemSchema;

  // Cập nhật dữ liệu form và attachments khi mở modal
  useEffect(() => {
    if (open && item) {
      if (inspection?.formDataJson) {
        try {
          const parsed = JSON.parse(inspection.formDataJson);
          setFormData(parsed);
          form.setFieldsValue(parsed);

          const atts: InspectionAttachmentDto[] = Array.isArray(parsed.attachments)
            ? parsed.attachments
            : (inspection.attachments || []);
          setAttachments(atts);

          if (parsed._customSchema && parsed._customSchema.components?.length > 0) {
            setCustomSchema(parsed._customSchema);
          }
        } catch {
          setFormData({});
          setAttachments([]);
          form.resetFields();
        }
      } else {
        const defaultTitle = `Nghiệm thu: ${item.name} - ${checklist.objectCode || checklist.objectName}`;
        const defaultInit = {
          inspectionTitle: defaultTitle,
          result: 'pass',
        };
        setFormData(defaultInit);
        form.setFieldsValue(defaultInit);
        setAttachments([]);
        setCustomSchema(null);
      }
    }
  }, [open, inspection, item, checklist, form]);

  // Quyền chỉnh sửa: Submitter khi chưa có phiếu, hoặc khi phiếu ở trạng thái Draft / Rejected
  const canEdit = useMemo(() => {
    if (!item) return false;
    if (!item.linkedInspectionId) return isSubmitter;
    if (!inspection) return false;
    return (inspection.status === 'Draft' || inspection.status === 'Rejected') && isSubmitter;
  }, [item, inspection, isSubmitter]);


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

  // Lưu tùy biến schema từ builder
  const handleSaveCustomSchema = (newSchema: FormIoSchema) => {
    setCustomSchema(newSchema);
    setBuilderModalOpen(false);
    message.success(`Đã cập nhật biểu mẫu đo đạc với ${newSchema.components.length} chỉ tiêu!`);
  };

  // Submit / Lưu nháp
  const handleSaveOrSubmit = async (isSubmitImmediately: boolean) => {
    if (!item) return;

    try {
      const formValues = await form.validateFields();
      const payloadData: Record<string, any> = {
        ...formData,
        ...formValues,
        inspectionTitle: formValues.inspectionTitle?.trim() || `Nghiệm thu: ${item.name}`,
        attachments: attachments,
      };

      if (customSchema) {
        payloadData._customSchema = customSchema;
      }

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
    <>
      <Modal
        open={open}
        onCancel={onClose}
        width={850}
        zIndex={1300}
        destroyOnClose
        title={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: 24 }}>
            <Space align="center">
              <FileTextOutlined style={{ fontSize: 20, color: '#1677ff' }} />
              <div>
                <Title level={4} style={{ margin: 0, fontSize: 16 }}>
                  Hồ sơ Nghiệm thu: {item.name}
                </Title>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Checklist: <b>{checklist.name}</b> • Cấu kiện: <b>{checklist.objectCode || checklist.objectName}</b>
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
                  <CheckCircleOutlined /> Tiêu chí này đã được phê duyệt nghiệm thu ĐẠT
                </Tag>
              )}
              {inspection?.status === 'Submitted' && isReviewer && (
                <Tag color="processing">
                  <ClockCircleOutlined /> Đang chờ thẩm tra — Thực hiện phê duyệt tại danh mục Checklist
                </Tag>
              )}
              {inspection?.status === 'Reviewed' && isApprover && (
                <Tag color="blue">
                  <ClockCircleOutlined /> Đã qua thẩm tra — Thực hiện phê duyệt tại danh mục Checklist
                </Tag>
              )}
            </div>
            <Space>
              <Button onClick={onClose}>Đóng</Button>

              {/* Nút hành động Submitter */}
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
                    style={{ backgroundColor: '#1677ff' }}
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
        <div style={{ maxHeight: 'calc(80vh - 150px)', overflowY: 'auto', paddingRight: 8 }}>
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
                    Vui lòng điều chỉnh thông số hoặc bổ sung ảnh minh chứng bên dưới, sau đó bấm <b>"Gửi nghiệm thu"</b> để nộp lại.
                  </Text>
                </div>
              }
              style={{ marginBottom: 16, borderRadius: 8 }}
            />
          )}

          {/* Ngữ cảnh Checklist */}
          <Alert
            message="Quy trình nghiệm thu 2 giai đoạn"
            description={
              <span>
                Hồ sơ nghiệm thu gắn liền với tiêu chí <b>{item.orderIndex}. {item.name}</b>{' '}
                {item.isRequired && <Tag color="volcano" style={{ fontSize: 10 }}>Bắt buộc</Tag>} thuộc Checklist của cấu kiện. Bạn có thể lưu nháp nhiều lần trước khi nộp chính thức gửi Giám sát thẩm tra.
              </span>
            }
            type="info"
            showIcon
            icon={<InfoCircleOutlined />}
            style={{ marginBottom: 16, borderRadius: 8 }}
          />

          {loadingInspection ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <Spin tip="Đang tải dữ liệu hồ sơ nghiệm thu..." />
            </div>
          ) : (
            <Form form={form} layout="vertical">
              {/* 1. Tiêu đề hồ sơ nghiệm thu */}
              <Form.Item
                name="inspectionTitle"
                label={<Text strong>1. Tiêu đề hồ sơ nghiệm thu</Text>}
                rules={[{ required: true, message: 'Vui lòng nhập tiêu đề hồ sơ' }]}
              >
                <Input
                  size="middle"
                  disabled={!canEdit}
                  placeholder="VD: Nghiệm thu cốt thép đài móng - Cột C12"
                  prefix={<AppstoreOutlined style={{ color: '#BFBFBF' }} />}
                />
              </Form.Item>

              {/* 2. Biểu mẫu thông số kỹ thuật Form.io */}
              <Card
                size="small"
                title={
                  <Space align="center" style={{ width: '100%', justifyContent: 'space-between' }}>
                    <Space>
                      <CheckCircleOutlined style={{ color: '#1677ff' }} />
                      <Text strong>2. Biểu mẫu thông số kiểm tra kỹ thuật ({activeSchema.components.length} chỉ tiêu)</Text>
                      {customSchema && <Tag color="success">Đã tùy biến</Tag>}
                    </Space>
                    {canEdit && (
                      <Button
                        size="small"
                        type="primary"
                        ghost
                        icon={<ToolOutlined />}
                        onClick={() => setBuilderModalOpen(true)}
                      >
                        Tùy biến trường
                      </Button>
                    )}
                  </Space>
                }
                style={{
                  marginBottom: 16,
                  borderRadius: 8,
                  backgroundColor: '#FAFCFF',
                  border: '1px solid #E1EDFA',
                }}
              >
                <DynamicFormIoRenderer
                  schema={activeSchema}
                  initialData={formData}
                  readonly={!canEdit}
                  form={form}
                  onChange={(vals) => setFormData((prev) => ({ ...prev, ...vals }))}
                />
              </Card>

              {/* 3. Tải lên ảnh hiện trường */}
              <Card
                size="small"
                title={
                  <Space>
                    <PictureOutlined style={{ color: '#52c41a' }} />
                    <Text strong>3. Ảnh chụp & Tài liệu minh chứng hiện trường ({attachments.length} tệp)</Text>
                  </Space>
                }
                style={{
                  marginBottom: 16,
                  borderRadius: 8,
                  backgroundColor: '#FAFAFA',
                  border: '1px solid #F0F0F0',
                }}
              >
                <InspectionImageGallery
                  attachments={attachments}
                  onChange={setAttachments}
                  readonly={!canEdit}
                />
              </Card>
            </Form>
          )}
        </div>
      </Modal>

      {/* Modal Form Builder để kéo thả tùy biến trường nếu cần */}
      <FormIoBuilderModal
        visible={builderModalOpen}
        initialSchema={activeSchema}
        onCancel={() => setBuilderModalOpen(false)}
        onSave={handleSaveCustomSchema}
      />


    </>
  );
};
