import {
  CheckSquareOutlined,
  FileTextOutlined,
  HistoryOutlined,
  PictureOutlined,
  SaveOutlined,
  SendOutlined,
  ToolOutlined
} from '@ant-design/icons';
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Drawer,
  message,
  Popconfirm,
  Space,
  Spin,
  Tabs,
  Tag,
  Timeline,
  Typography,
} from 'antd';
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { roleLabels } from '../../config/statuses';
import { useAuth } from '../../contexts/AuthContext';
import { useUnsavedChanges } from '../../contexts/UnsavedChangesContext';
import { inspectionApi } from '../../services/inspectionApi';
import type {
  FormIoSchema,
  InspectionAttachmentDto,
  InspectionAuditHistoryDto,
  InspectionDto,
  InspectionStatus,
} from '../../types/inspection';
import { DynamicFormIoRenderer } from '../formio/DynamicFormIoRenderer';
import { FormIoBuilderModal } from '../formio/FormIoBuilderModal';
import { QueryState } from '../ui/QueryState';
import { StatusBadge } from '../ui/StatusBadge';
import { InspectionImageGallery } from './InspectionImageGallery';

const { Text } = Typography;

interface InspectionDetailDrawerProps {
  visible: boolean;
  inspectionId: string | null;
  onClose: () => void;
  onUpdated: () => void;
  isSubmitterRole?: boolean;
}

export const InspectionDetailDrawer: React.FC<InspectionDetailDrawerProps> = ({
  visible,
  inspectionId,
  onClose,
  onUpdated,
  isSubmitterRole = true,
}) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const currentRole = ((Array.isArray(user?.role) ? user?.role[0] : user?.role) as string) || '';
  const roleBase = currentRole.toLowerCase() === 'approver'
    ? '/approver'
    : currentRole.toLowerCase() === 'reviewer'
      ? '/reviewer'
      : '/submitter';

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [builderVisible, setBuilderVisible] = useState(false);

  const [inspection, setInspection] = useState<InspectionDto | null>(null);
  const [schema, setSchema] = useState<FormIoSchema | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [attachments, setAttachments] = useState<InspectionAttachmentDto[]>([]);
  const [history, setHistory] = useState<InspectionAuditHistoryDto[]>([]);
  const [activeTab, setActiveTab] = useState<string>('form');
  const [expanded, setExpanded] = useState(false);
  const [savedData, setSavedData] = useState('{}');
  const [loadError, setLoadError] = useState<unknown>(null);
  const [hasConflict, setHasConflict] = useState(false);

  useEffect(() => {
    if (visible && inspectionId) {
      loadInspectionDetails(inspectionId);
    } else {
      setInspection(null);
      setSchema(null);
      setFormData({});
      setAttachments([]);
      setHistory([]);
    }
  }, [visible, inspectionId]);

  const handleAttachmentsChange = (updated: InspectionAttachmentDto[]) => {
    setAttachments(updated);
    setFormData((prev) => ({
      ...prev,
      attachments: updated,
    }));
  };

  const loadInspectionDetails = async (id: string) => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await inspectionApi.getInspectionById(id);
      setInspection(data);

      // Parse form data JSON
      let parsedData: Record<string, any> = {};
      if (data.formDataJson) {
        try {
          parsedData = JSON.parse(data.formDataJson);
        } catch {
          parsedData = {};
        }
      }
      setFormData(parsedData);
      setSavedData(JSON.stringify(parsedData));
      setHasConflict(false);

      const atts: InspectionAttachmentDto[] = Array.isArray(parsedData.attachments)
        ? parsedData.attachments
        : (data.attachments || []);
      setAttachments(atts);

      // 1. Kiểm tra nếu có schema tùy biến được lưu trong formDataJson
      if (parsedData._customSchema && parsedData._customSchema.components?.length > 0) {
        setSchema(parsedData._customSchema);
      } else if (data.formSchemaJson && data.formSchemaJson !== '{}') {
        try {
          const linkedSchema: FormIoSchema = JSON.parse(data.formSchemaJson);
          setSchema(linkedSchema.components?.length ? linkedSchema : getDefaultFallbackSchema());
        } catch {
          setSchema(getDefaultFallbackSchema());
        }
      } else {
        // 2. Tải schema từ backend API
        try {
          const schemaId = data.formSchemaId || 'default-inspection-schema';
          const schemaData = await inspectionApi.getSchemaById(schemaId);
          if (schemaData && schemaData.components && schemaData.components.length > 0) {
            setSchema(schemaData);
          } else {
            setSchema(getDefaultFallbackSchema());
          }
        } catch {
          setSchema(getDefaultFallbackSchema());
        }
      }

      // Tải lịch sử
      const historyData = await inspectionApi.getInspectionHistory(id).catch(() => []);
      setHistory(historyData);
    } catch (error) {
      setLoadError(error);
    } finally {
      setLoading(false);
    }
  };

  const getDefaultFallbackSchema = (): FormIoSchema => ({
    display: 'form',
    title: 'Biểu mẫu Nghiệm thu Hiện trường',
    components: [
      {
        key: 'inspectionTitle',
        label: 'Tên hạng mục kiểm tra',
        type: 'textfield',
        validate: { required: true },
        placeholder: 'Nhập tên hạng mục',
      },
      {
        key: 'inspectionDate',
        label: 'Thời gian kiểm tra',
        type: 'datetime',
        validate: { required: true },
      },
      {
        key: 'doSut',
        label: 'Độ sụt bê tông',
        type: 'number',
        suffix: 'cm',
        placeholder: 'Ví dụ: 12',
        validate: { required: true, min: 0, max: 30 },
      },
      {
        key: 'nhietDo',
        label: 'Nhiệt độ hỗn hợp',
        type: 'number',
        suffix: '°C',
        placeholder: 'Ví dụ: 30',
      },
      {
        key: 'inspectionResult',
        label: 'Kết quả đánh giá nghiệm thu',
        type: 'radio',
        values: [
          { label: 'Đạt yêu cầu', value: 'Pass' },
          { label: 'Không đạt yêu cầu', value: 'Fail' },
        ],
        validate: { required: true },
      },
      {
        key: 'notes',
        label: 'Ghi chú hiện trường',
        type: 'textarea',
        placeholder: 'Nhập nhận xét hoặc kiến nghị khắc phục',
      },
    ],
  });

  const isEditable =
    isSubmitterRole &&
    inspection &&
    inspection.submittedById === user?.id &&
    inspection.workflowSyncStatus === 'Synchronized' &&
    (inspection.status === 'Draft' || inspection.status === 'Rejected');
  const confirmDiscard = useUnsavedChanges(Boolean(visible && isEditable && JSON.stringify(formData) !== savedData));
  const requestClose = () => confirmDiscard(onClose);

  const handleSaveDraft = async () => {
    if (!inspection) return;
    setSaving(true);
    try {
      const updated = await inspectionApi.updateInspectionDraft(inspection.id, {
        formDataJson: JSON.stringify(formData),
        rowVersion: inspection.rowVersion,
      });
      setInspection(updated);
      setSavedData(JSON.stringify(formData));
      setHasConflict(false);
      message.success('Đã lưu nội dung bản nháp thành công!');
      onUpdated();
    } catch (error: any) {
      if (error.response?.status === 409) setHasConflict(true);
      const msg = error.response?.data?.message || 'Có lỗi khi lưu bản nháp.';
      message.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    if (!inspection) return;
    setSubmitting(true);
    try {
      const updated = await inspectionApi.submitInspection(inspection.id, {
        formDataJson: JSON.stringify(formData),
        rowVersion: inspection.rowVersion,
      });
      setInspection(updated);
      setSavedData(JSON.stringify(formData));
      message.info('Đã ghi nhận hồ sơ; quy trình đang được đồng bộ. Vui lòng tải lại để xem kết quả.');
      onUpdated();
      const newHistory = await inspectionApi.getInspectionHistory(inspection.id).catch(() => []);
      setHistory(newHistory);
    } catch (error: any) {
      if (error.response?.status === 409) setHasConflict(true);
      const msg = error.response?.data?.message || 'Có lỗi khi nộp hồ sơ.';
      message.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveCustomSchema = async (newSchema: FormIoSchema) => {
    setSchema(newSchema);
    setBuilderVisible(false);

    const updatedData = { ...formData, _customSchema: newSchema };
    setFormData(updatedData);

    if (inspection) {
      try {
        const updated = await inspectionApi.updateInspectionDraft(inspection.id, {
          formDataJson: JSON.stringify(updatedData),
          rowVersion: inspection.rowVersion,
        });
        setInspection(updated);
        setSavedData(JSON.stringify(updatedData));
        message.success('Đã lưu cấu hình biểu mẫu tùy biến vào hồ sơ!');
        onUpdated();
      } catch (error: any) {
        if (error.response?.status === 409) {
          setHasConflict(true);
          message.error(error.response.data?.message || 'Dữ liệu đã thay đổi. Vui lòng tải lại hồ sơ.');
        } else {
          message.warning('Đã áp dụng biểu mẫu mới trên giao diện. Nhấn Lưu nháp để đồng bộ.');
        }
      }
    }
  };

  const renderStatusTag = (status?: InspectionStatus) => <StatusBadge domain="inspection" status={status} />;

  return (
    <Drawer
      title={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <Space wrap>
            <FileTextOutlined style={{ color: '#1D4ED8', fontSize: 20 }} />
            <Text strong style={{ fontSize: 16 }}>
              {formData.inspectionTitle || inspection?.objectName || 'Chi tiết Hồ sơ Nghiệm thu'}
            </Text>

          </Space>
          <div style={{ marginRight: 24 }}>{renderStatusTag(inspection?.status)}</div>
        </div>
      }
      open={visible}
      onClose={requestClose}
      size={expanded ? '100vw' : 'min(100vw, 1040px)'}
      className="detail-overlay"
      destroyOnHidden
      extra={
        <Space wrap>
        <Button size="small" onClick={() => setExpanded(!expanded)}>{expanded ? 'Thu gọn' : 'Mở rộng'}</Button>
        <Button aria-label="Mở kế hoạch kiểm tra"
          type="primary"
          ghost
          size="small"
          icon={<CheckSquareOutlined />}
          onClick={() => confirmDiscard(() => {
            onClose();
            const target = inspection?.checklistId
              ? `${roleBase}/checklists?checklistId=${inspection.checklistId}`
              : `${roleBase}/checklists`;
            navigate(target);
          })}
        >
          {inspection?.checklistId ? 'Mở Kế hoạch Checklist' : 'Quản lý Checklist'}
        </Button>
        </Space>
      }
      footer={
        isEditable ? (
          <div className="detail-actions">
            <Button onClick={requestClose}>Đóng</Button>
            <Space size={12}>
              <Button icon={<SaveOutlined />} onClick={handleSaveDraft} loading={saving}>
                Lưu nháp
              </Button>
              <Popconfirm
                title="Xác nhận nộp hồ sơ nghiệm thu?"
                description="Hồ sơ sẽ chuyển trạng thái sang Chờ thẩm tra (Submitted) và không thể tự ý sửa cho đến khi có phản hồi."
                onConfirm={handleSubmit}
                okText="Đồng ý nộp"
                cancelText="Hủy"
              >
                <Button type="primary" icon={<SendOutlined />} loading={submitting}>
                  Nộp hồ sơ thẩm tra
                </Button>
              </Popconfirm>
            </Space>
          </div>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button onClick={requestClose}>Đóng</Button>
          </div>
        )
      }
    >
      <Spin spinning={loading}>
        {loadError ? <QueryState error={loadError} retry={() => inspectionId && loadInspectionDetails(inspectionId)} entity="hồ sơ" /> : null}
        {inspection && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {hasConflict && <Alert type="warning" showIcon title="Hồ sơ đã thay đổi" description="Nội dung đang sửa được giữ lại. Chỉ tải lại khi bạn sẵn sàng bỏ thay đổi chưa lưu."
              action={<Button onClick={() => confirmDiscard(() => { void loadInspectionDetails(inspection.id); })}>Tải lại hồ sơ</Button>} />}
            {inspection.workflowSyncStatus && inspection.workflowSyncStatus !== 'Synchronized' && (
              <Alert
                type="warning"
                showIcon
                message={inspection.workflowSyncStatus === 'Pending' ? 'Quy trình đang được đồng bộ' : inspection.workflowSyncStatus === 'Retrying' ? 'Đồng bộ gặp lỗi, hệ thống đang thử lại' : 'Quy trình cần được khôi phục'}
                description="Vui lòng tải lại hồ sơ để xem kết quả; nếu trạng thái kéo dài, hãy liên hệ quản trị viên."
                action={
                  <Button size="small" loading={loading} onClick={() => loadInspectionDetails(inspection.id)}>
                    Tải lại hồ sơ
                  </Button>
                }
              />
            )}
            {/* Cảnh báo từ chối nếu có */}
            {inspection.status === 'Rejected' && inspection.rejectReason && (
              <Alert
                message="Hồ sơ đã bị từ chối kiểm tra"
                description={
                  <div>
                    <Text strong>Lý do từ chối: </Text>
                    <span>{inspection.rejectReason}</span>
                    <div style={{ marginTop: 6, fontSize: 13, color: '#DC2626' }}>
                      Vui lòng kiểm tra lại các chỉ tiêu kỹ thuật bên dưới, chỉnh sửa và bấm <b>"Nộp hồ sơ thẩm tra"</b> để gửi lại.
                    </div>
                  </div>
                }
                type="error"
                showIcon
                style={{ borderRadius: 6 }}
              />
            )}

            {/* Thông tin cấu kiện & Bản vẽ */}
            <Card size="small" style={{ borderRadius: 8, backgroundColor: '#F9FAFB' }}>
              <Descriptions size="small" column={{ xs: 1, sm: 2, md: 3 }} bordered={false}>
                <Descriptions.Item label={<Text type="secondary">Cấu kiện</Text>}>
                  <Text strong>{inspection.objectName}</Text>
                </Descriptions.Item>
                <Descriptions.Item label={<Text type="secondary">Bản vẽ CAD</Text>}>
                  <Text>{inspection.drawingFileName || '—'} (Trang {inspection.drawingPageNumber})</Text>
                </Descriptions.Item>
                <Descriptions.Item label={<Text type="secondary">Biểu mẫu Schema</Text>}>
                  <Tag color="geekblue">
                    {schema?.title || inspection.formSchemaId || 'Mẫu tiêu chuẩn'}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label={<Text type="secondary">Người tạo</Text>}>
                  <Text>{inspection.submittedBy || 'Kỹ sư hiện trường'}</Text>
                </Descriptions.Item>
                <Descriptions.Item label={<Text type="secondary">Ngày tạo</Text>}>
                  <Text>{new Date(inspection.createdAt).toLocaleString('vi-VN')}</Text>
                </Descriptions.Item>
                <Descriptions.Item label={<Text type="secondary">Kế hoạch Checklist</Text>}>
                  {inspection.checklistId ? (
                    <Space size={6} wrap>
                      <Button aria-label="Mở kế hoạch kiểm tra"
                        type="link"
                        size="small"
                        icon={<CheckSquareOutlined />}
                        style={{ padding: 0, height: 'auto', fontWeight: 600 }}
                        onClick={() => confirmDiscard(() => {
                          onClose();
                          navigate(`${roleBase}/checklists?checklistId=${inspection.checklistId}`);
                        })}
                      >
                        {inspection.checklistName || `Mã #${inspection.checklistId.substring(0, 8).toUpperCase()}`}
                      </Button>
                      <Tag color="cyan">{inspection.linkedChecklistItemsCount} tiêu chí</Tag>
                    </Space>
                  ) : (
                    <Button
                      type="link"
                      size="small"
                      icon={<CheckSquareOutlined />}
                      style={{ padding: 0, height: 'auto' }}
                      onClick={() => confirmDiscard(() => {
                        onClose();
                        navigate(`${roleBase}/checklists`);
                      })}
                    >
                      Đến danh sách Checklist
                    </Button>
                  )}
                </Descriptions.Item>

              </Descriptions>
            </Card>

            {/* Thanh điều hướng trực tiếp sang Kế hoạch Checklist */}

            <details className="technical-details"><summary>Thông tin kỹ thuật</summary><Text copyable>{inspection.id}</Text>{inspection.workflowInstanceId && <div>Mã quy trình: {inspection.workflowInstanceId}</div>}</details>
            {/* Tabs: Nội dung Biểu mẫu vs Lịch sử thẩm tra */}
            <Tabs
              activeKey={activeTab}
              onChange={setActiveTab}
              items={[
                {
                  key: 'form',
                  label: (
                    <Space>
                      <FileTextOutlined />
                      <span>Nội dung nghiệm thu</span>
                    </Space>
                  ),
                  children: (
                    <div style={{ paddingTop: 4 }}>
                      {/* Toolbar bổ sung Form Builder cho Submitter */}
                      {isEditable && (
                        <div className="detail-actions" style={{ marginBottom: 16 }}><Button icon={<ToolOutlined />} onClick={() => setBuilderVisible(true)}>Thiết kế biểu mẫu</Button></div>
                      )}

                      <DynamicFormIoRenderer
                        schema={schema}
                        initialData={formData}
                        readonly={!isEditable}
                        onChange={(newVals) => setFormData(newVals)}
                      />

                      {/* Khối Ảnh hiện trường tích hợp */}
                      <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px dashed #E8E8E8' }}>
                        <InspectionImageGallery
                          attachments={attachments}
                          onChange={handleAttachmentsChange}
                          readonly={!isEditable}
                        />
                      </div>
                    </div>
                  ),
                },
                {
                  key: 'gallery',
                  label: (
                    <Space>
                      <PictureOutlined />
                      <span>Ảnh hiện trường ({attachments.length})</span>
                    </Space>
                  ),
                  children: (
                    <div style={{ padding: '8px 0' }}>
                      <InspectionImageGallery
                        attachments={attachments}
                        onChange={handleAttachmentsChange}
                        readonly={!isEditable}
                      />
                    </div>
                  ),
                },
                {
                  key: 'history',
                  label: (
                    <Space>
                      <HistoryOutlined />
                      <span>Lịch sử thẩm tra & Kiểm toán ({history.length})</span>
                    </Space>
                  ),
                  children: (
                    <div style={{ padding: '16px 8px' }}>
                      {history.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '32px 0' }}>
                          <Text type="secondary">Chưa có lịch sử chuyển đổi trạng thái nào.</Text>
                        </div>
                      ) : (
                        <Timeline
                          items={history.map((h) => {
                            const isReject = h.action.toLowerCase().includes('reject');
                            const isApprove = h.action.toLowerCase().includes('approve');
                            const isSubmit = h.action.toLowerCase().includes('submit');

                            let dotColor = '#1D4ED8';
                            if (isReject) dotColor = '#FF4D4F';
                            else if (isApprove) dotColor = '#166534';
                            else if (isSubmit) dotColor = '#FAAD14';

                            return {
                              color: dotColor,
                              children: (
                                <div style={{ marginBottom: 16 }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <Text strong style={{ fontSize: 14 }}>
                                      {h.action}
                                    </Text>
                                    <Text type="secondary" style={{ fontSize: 12 }}>
                                      {new Date(h.createdAt).toLocaleString('vi-VN')}
                                    </Text>
                                  </div>
                                  <div style={{ marginTop: 2 }}>
                                    <Text type="secondary">Thực hiện bởi: </Text>
                                    <Text strong>{h.actorName || 'Hệ thống'}</Text>
                                    {h.actorRole && <Tag style={{ marginLeft: 6 }}>{roleLabels[h.actorRole] || h.actorRole}</Tag>}
                                  </div>
                                  <div style={{ marginTop: 4 }}>
                                    <StatusBadge status={h.fromStatus} /> → <StatusBadge status={h.toStatus} />
                                  </div>
                                  {h.comment && (
                                    <div
                                      style={{
                                        marginTop: 6,
                                        padding: '6px 10px',
                                        backgroundColor: isReject ? '#FFF1F0' : '#F6FFED',
                                        border: `1px solid ${isReject ? '#FFA39E' : '#B7EB8F'}`,
                                        borderRadius: 4,
                                        fontSize: 13,
                                      }}
                                    >
                                      <Text type={isReject ? 'danger' : undefined}>
                                        {isReject ? 'Lý do: ' : 'Ghi chú: '}
                                        {h.comment}
                                      </Text>
                                    </div>
                                  )}
                                </div>
                              ),
                            };
                          })}
                        />
                      )}
                    </div>
                  ),
                },
              ]}
            />
          </div>
        )}
      </Spin>

      {/* Modal FormIO Builder tương tác */}
      <FormIoBuilderModal
        visible={builderVisible}
        initialSchema={schema}
        onCancel={() => setBuilderVisible(false)}
        onSave={handleSaveCustomSchema}
      />
    </Drawer>
  );
};
