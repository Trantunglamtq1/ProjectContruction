import React, { useState, useEffect } from 'react';
import {
  Drawer,
  Tabs,
  Space,
  Typography,
  Tag,
  Button,
  Alert,
  Spin,
  Timeline,
  Descriptions,
  message,
  Card,
  Popconfirm,
} from 'antd';
import {
  FileTextOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  SaveOutlined,
  SendOutlined,
  HistoryOutlined,
  EditOutlined,
  ToolOutlined,
  BranchesOutlined,
} from '@ant-design/icons';
import { inspectionApi } from '../../services/inspectionApi';
import { DynamicFormIoRenderer } from '../formio/DynamicFormIoRenderer';
import { FormIoBuilderModal } from '../formio/FormIoBuilderModal';
import type {
  InspectionDto,
  FormIoSchema,
  InspectionAuditHistoryDto,
  InspectionStatus,
} from '../../types/inspection';

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
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [builderVisible, setBuilderVisible] = useState(false);

  const [inspection, setInspection] = useState<InspectionDto | null>(null);
  const [schema, setSchema] = useState<FormIoSchema | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [history, setHistory] = useState<InspectionAuditHistoryDto[]>([]);
  const [activeTab, setActiveTab] = useState<string>('form');

  useEffect(() => {
    if (visible && inspectionId) {
      loadInspectionDetails(inspectionId);
    } else {
      setInspection(null);
      setSchema(null);
      setFormData({});
      setHistory([]);
    }
  }, [visible, inspectionId]);

  const loadInspectionDetails = async (id: string) => {
    setLoading(true);
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

      // 1. Kiểm tra nếu có schema tùy biến được lưu trong formDataJson
      if (parsedData._customSchema && parsedData._customSchema.components?.length > 0) {
        setSchema(parsedData._customSchema);
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
    } catch {
      message.error('Không thể tải chi tiết hồ sơ kiểm tra.');
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
    (inspection.status === 'Draft' || inspection.status === 'Rejected');

  const handleSaveDraft = async () => {
    if (!inspection) return;
    setSaving(true);
    try {
      const updated = await inspectionApi.updateInspectionDraft(inspection.id, {
        formDataJson: JSON.stringify(formData),
      });
      setInspection(updated);
      message.success('Đã lưu nội dung bản nháp thành công!');
      onUpdated();
    } catch (error: any) {
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
      });
      setInspection(updated);
      message.success('Hồ sơ đã được nộp thẩm tra chính thức! Trạng thái: Chờ thẩm tra (Submitted).');
      onUpdated();
      const newHistory = await inspectionApi.getInspectionHistory(inspection.id).catch(() => []);
      setHistory(newHistory);
    } catch (error: any) {
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
        });
        setInspection(updated);
        message.success('Đã lưu cấu hình biểu mẫu tùy biến vào hồ sơ!');
        onUpdated();
      } catch {
        message.warning('Đã áp dụng biểu mẫu mới trên giao diện. Nhấn Lưu nháp để đồng bộ.');
      }
    }
  };

  const renderStatusTag = (status?: InspectionStatus) => {
    switch (status) {
      case 'Approved':
        return <Tag color="success" icon={<CheckCircleOutlined />}>ĐÃ PHÊ DUYỆT (CẤP 2 CĐT)</Tag>;
      case 'Reviewed':
        return <Tag color="purple" icon={<CheckCircleOutlined />}>ĐẠT THẨM TRA (CẤP 1)</Tag>;
      case 'UnderReview':
        return <Tag color="processing" icon={<ClockCircleOutlined />}>ĐANG THẨM TRA</Tag>;
      case 'Submitted':
        return <Tag color="warning" icon={<ClockCircleOutlined />}>CHỜ THẨM TRA</Tag>;
      case 'Rejected':
        return <Tag color="error" icon={<CloseCircleOutlined />}>BỊ TỪ CHỐI / CẦN SỬA</Tag>;
      default:
        return <Tag color="default" icon={<EditOutlined />}>BẢN NHÁP (DRAFT)</Tag>;
    }
  };

  return (
    <Drawer
      title={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <Space wrap>
            <FileTextOutlined style={{ color: '#1677FF', fontSize: 20 }} />
            <Text strong style={{ fontSize: 16 }}>
              {formData.inspectionTitle || inspection?.objectName || 'Chi tiết Hồ sơ Nghiệm thu'}
            </Text>
            {inspection?.workflowInstanceId && (
              <Tag color="purple" icon={<BranchesOutlined />} style={{ fontFamily: 'monospace', fontWeight: 600 }}>
                {inspection.workflowInstanceId}
              </Tag>
            )}
          </Space>
          <div style={{ marginRight: 24 }}>{renderStatusTag(inspection?.status)}</div>
        </div>
      }
      open={visible}
      onClose={onClose}
      width={880}
      destroyOnClose
      footer={
        isEditable ? (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text type="secondary">
              Hồ sơ đang ở chế độ chỉnh sửa. Nhấn <b>Nộp hồ sơ</b> để gửi sang Tư vấn giám sát.
            </Text>
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
            <Button onClick={onClose}>Đóng</Button>
          </div>
        )
      }
    >
      <Spin spinning={loading}>
        {inspection && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Cảnh báo từ chối nếu có */}
            {inspection.status === 'Rejected' && inspection.rejectReason && (
              <Alert
                message="Hồ sơ đã bị từ chối kiểm tra"
                description={
                  <div>
                    <Text strong>Lý do từ chối: </Text>
                    <span>{inspection.rejectReason}</span>
                    <div style={{ marginTop: 6, fontSize: 13, color: '#DC2626' }}>
                      👉 Vui lòng kiểm tra lại các chỉ tiêu kỹ thuật bên dưới, chỉnh sửa và bấm <b>"Nộp hồ sơ thẩm tra"</b> để gửi lại.
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
                <Descriptions.Item label={<Text type="secondary">Cấu kiện (Object)</Text>}>
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
                <Descriptions.Item label={<Text type="secondary">Checklist liên kết</Text>}>
                  <Tag color="cyan">{inspection.linkedChecklistItemsCount} tiêu chí</Tag>
                </Descriptions.Item>
                {inspection.workflowInstanceId && (
                  <Descriptions.Item label={<Text type="secondary">Elsa Workflow ID</Text>}>
                    <Tag color="purple" icon={<BranchesOutlined />} style={{ fontFamily: 'monospace', fontWeight: 600 }}>
                      {inspection.workflowInstanceId}
                    </Tag>
                  </Descriptions.Item>
                )}
              </Descriptions>
            </Card>

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
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '10px 14px',
                            backgroundColor: '#F0F7FF',
                            borderRadius: 8,
                            marginBottom: 16,
                            border: '1px solid #BAE0FF',
                          }}
                        >
                          <div>
                            <Text strong style={{ color: '#0050B3' }}>
                              Cần bổ sung hoặc đổi tên các chỉ tiêu (độ sụt, cốt thép, số liệu...)?
                            </Text>
                            <div style={{ fontSize: 12, color: '#595959' }}>
                              Dùng Form Builder để thêm/bớt trường và tùy biến nhãn động không cần sửa code.
                            </div>
                          </div>
                          <Button
                            type="primary"
                            icon={<ToolOutlined />}
                            onClick={() => setBuilderVisible(true)}
                            style={{ backgroundColor: '#1677FF', fontWeight: 600 }}
                          >
                            Tùy biến biểu mẫu (Form Builder)
                          </Button>
                        </div>
                      )}

                      <DynamicFormIoRenderer
                        schema={schema}
                        initialData={formData}
                        readonly={!isEditable}
                        onChange={(newVals) => setFormData(newVals)}
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

                            let dotColor = '#1677FF';
                            if (isReject) dotColor = '#FF4D4F';
                            else if (isApprove) dotColor = '#52C41A';
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
                                    {h.actorRole && <Tag color="blue" style={{ marginLeft: 6 }}>{h.actorRole}</Tag>}
                                  </div>
                                  <div style={{ marginTop: 4 }}>
                                    <Tag>{h.fromStatus}</Tag> ➔ <Tag color="processing">{h.toStatus}</Tag>
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
