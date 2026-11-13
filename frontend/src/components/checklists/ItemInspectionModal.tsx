import { getSelectedProjectId } from '../../services/projectScope';
import {
  AppstoreOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  FileTextOutlined,
  PictureOutlined,
  SaveOutlined,
  SendOutlined,
  ToolOutlined
} from '@ant-design/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Button,
  Card,
  Form,
  Input,
  message,
  Modal,
  Space,
  Spin,
  Tag,
  Typography,
} from 'antd';
import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useUnsavedChanges } from '../../contexts/UnsavedChangesContext';
import { inspectionApi } from '../../services/inspectionApi';
import type { ChecklistDto, ChecklistItemDto } from '../../types/checklist';
import type {
  FormIoSchema,
  InspectionAttachmentDto,
  InspectionDto,
  InspectionStatus,
} from '../../types/inspection';
import { DynamicFormIoRenderer } from '../formio/DynamicFormIoRenderer';
import { FormIoBuilderModal } from '../formio/FormIoBuilderModal';
import { InspectionImageGallery } from '../inspections/InspectionImageGallery';
import { QueryState } from '../ui/QueryState';
import { StatusBadge } from '../ui/StatusBadge';

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
  const [dirty, setDirty] = useState(false);
  const [hasConflict, setHasConflict] = useState(false);
  const [editingVersion, setEditingVersion] = useState('');
  const confirmDiscard = useUnsavedChanges(open && dirty);

  // Lấy chi tiết phiếu nghiệm thu nếu item đã có linkedInspectionId
  const {
    data: inspection,
    isLoading: loadingInspection,
    error: loadError,
    refetch: reloadInspection,
  } = useQuery<InspectionDto>({
    queryKey: ['inspection-detail', item?.linkedInspectionId, getSelectedProjectId()],
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
    if (!open) { setDirty(false); setHasConflict(false); return; }
    if (dirty) return;
    if (open && item) {
      setEditingVersion(inspection?.rowVersion || '');
      setCustomSchema(null);
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
  }, [open, inspection, item, checklist, form, dirty]);

  // Quyền chỉnh sửa: Submitter khi chưa có phiếu, hoặc khi phiếu ở trạng thái Draft / Rejected
  const canEdit = useMemo(() => {
    if (!item) return false;
    if (!item.linkedInspectionId) return isSubmitter;
    if (!inspection) return false;
    return (inspection.status === 'Draft' || inspection.status === 'Rejected') && isSubmitter && inspection.submittedById === user?.id && inspection.workflowSyncStatus === 'Synchronized';
  }, [item, inspection, isSubmitter, user?.id]);

  // Trạng thái badge
  const renderStatusTag = (status?: InspectionStatus) => <StatusBadge domain="inspection" status={status} />;

  // Lưu tùy biến schema từ builder
  const handleSaveCustomSchema = (newSchema: FormIoSchema) => {
    setDirty(true);
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
            ? `Đã ghi nhận hồ sơ tiêu chí "${item.name}"; quy trình đang được đồng bộ.`
            : `Đã lưu bản nháp nghiệm thu tiêu chí "${item.name}"!`
        );
      } else {
        // Cập nhật phiếu nghiệm thu đang có (Draft hoặc Rejected)
        if (!inspection?.rowVersion) {
          throw new Error('Không có phiên bản hồ sơ. Vui lòng tải lại dữ liệu.');
        }
        const updatedInspection = await inspectionApi.updateInspectionDraft(item.linkedInspectionId, {
          formDataJson: jsonString,
          rowVersion: editingVersion || inspection.rowVersion,
        });
        queryClient.setQueryData(['inspection-detail', item.linkedInspectionId], updatedInspection);

        if (isSubmitImmediately) {
          await inspectionApi.submitInspection(item.linkedInspectionId, {
            formDataJson: jsonString,
            rowVersion: updatedInspection.rowVersion,
          });
          message.info(`Đã ghi nhận hồ sơ tiêu chí "${item.name}"; quy trình đang được đồng bộ.`);
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
      setDirty(false);
      onClose();
    } catch (err: any) {
      if (err.response?.status === 409) setHasConflict(true);
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
        open={open && !builderModalOpen}
        onCancel={() => confirmDiscard(onClose)}
        width={{ xs: 'calc(100vw - 24px)', md: 960 }}
        className="detail-modal"
        style={{ top: 20 }}
        zIndex={1300}
        destroyOnHidden
        title={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: 24, flexWrap: 'wrap', gap: 8 }}>
            <Space align="center">
              <FileTextOutlined style={{ fontSize: 20, color: '#1D4ED8' }} />
              <div>
                <Title level={4} style={{ margin: 0, fontSize: 16 }}>
                  Hồ sơ Nghiệm thu: {item.name}
                </Title>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Kế hoạch: <b>{checklist.name}</b> • Cấu kiện: <b>{checklist.objectCode || checklist.objectName}</b>
                </Text>
              </div>
            </Space>
            {renderStatusTag(inspection?.status)}
          </div>
        }
        footer={
          <div className="detail-actions">
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
            <Space wrap>
              <Button onClick={() => confirmDiscard(onClose)}>Đóng</Button>

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
                    style={{ backgroundColor: '#1D4ED8' }}
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
          {loadError && <QueryState error={loadError} retry={() => reloadInspection()} entity="hồ sơ" />}
          {hasConflict && <Alert type="warning" showIcon title="Hồ sơ đã thay đổi" description="Nội dung đang sửa được giữ lại. Tải lại sẽ bỏ các thay đổi chưa lưu."
            action={<Button onClick={() => confirmDiscard(() => { setDirty(false); setHasConflict(false); void reloadInspection(); })}>Tải lại hồ sơ</Button>} />}
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

          {loadingInspection ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <Spin tip="Đang tải dữ liệu hồ sơ nghiệm thu..." />
            </div>
          ) : (
            <Form form={form} name="item-inspection" component="div" layout="vertical" onValuesChange={() => setDirty(true)}>
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
                  prefix={<AppstoreOutlined style={{ color: '#667085' }} />}
                />
              </Form.Item>

              {/* 2. Biểu mẫu thông số kỹ thuật biểu mẫu */}
              <Card
                size="small"
                title={
                  <Space align="center" style={{ width: '100%', justifyContent: 'space-between' }}>
                    <Space>
                      <CheckCircleOutlined style={{ color: '#1D4ED8' }} />
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
                  onChange={(vals) => { setDirty(true); setFormData((prev) => ({ ...prev, ...vals })); }}
                />
              </Card>

              {/* 3. Tải lên ảnh hiện trường */}
              <Card
                size="small"
                title={
                  <Space>
                    <PictureOutlined style={{ color: '#166534' }} />
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
                  onChange={(values) => { setDirty(true); setAttachments(values); }}
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
