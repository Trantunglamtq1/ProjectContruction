import React, { useState, useEffect } from 'react';
import {
  Modal,
  Form,
  Select,
  Input,
  Radio,
  Typography,
  Space,
  Tag,
  Alert,
  Spin,
  message,
  Card,
  Button,
} from 'antd';
import {
  FileTextOutlined,
  AppstoreOutlined,
  InfoCircleOutlined,
  ToolOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import { inspectionApi } from '../../services/inspectionApi';
import { FormIoBuilderModal } from '../formio/FormIoBuilderModal';
import type {
  InspectionDto,
  ConstructionObjectDto,
  FormSchemaItemDto,
  FormIoSchema,
} from '../../types/inspection';

const { Text, Title } = Typography;

interface CreateInspectionModalProps {
  visible: boolean;
  onCancel: () => void;
  onSuccess: (newInspection: InspectionDto) => void;
  preselectedObjectId?: string;
}

export const CreateInspectionModal: React.FC<CreateInspectionModalProps> = ({
  visible,
  onCancel,
  onSuccess,
  preselectedObjectId,
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [objects, setObjects] = useState<ConstructionObjectDto[]>([]);
  const [schemas, setSchemas] = useState<FormSchemaItemDto[]>([]);
  const [selectedSchema, setSelectedSchema] = useState<string>('rebar-inspection-schema');

  // Schema tùy biến & Modal Form Builder
  const [activeSchemaObj, setActiveSchemaObj] = useState<FormIoSchema | null>(null);
  const [isCustomized, setIsCustomized] = useState(false);
  const [builderOpen, setBuilderOpen] = useState(false);

  useEffect(() => {
    if (visible) {
      loadInitialData();
    }
  }, [visible]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const [objsData, schemasData] = await Promise.all([
        inspectionApi.getObjects(),
        inspectionApi.getSchemas(),
      ]);
      setObjects(objsData);
      setSchemas(schemasData);

      const defaultSchema = schemasData[0]?.id || 'rebar-inspection-schema';
      setSelectedSchema(defaultSchema);

      form.setFieldsValue({
        objectId: preselectedObjectId || (objsData.length > 0 ? objsData[0].id : undefined),
        formSchemaId: defaultSchema,
      });

      updateSuggestedTitle(
        preselectedObjectId || (objsData.length > 0 ? objsData[0].id : ''),
        defaultSchema,
        objsData,
        schemasData
      );

      // Tải chi tiết schema mặc định
      fetchSchemaDetail(defaultSchema);
    } catch {
      message.error('Không thể tải danh sách Object hoặc Schema.');
    } finally {
      setLoading(false);
    }
  };

  const fetchSchemaDetail = async (schemaId: string) => {
    try {
      const detail = await inspectionApi.getSchemaById(schemaId);
      setActiveSchemaObj(detail);
      setIsCustomized(false);
    } catch {
      // ignore
    }
  };

  const updateSuggestedTitle = (
    objId: string,
    schemaId: string,
    objsList = objects,
    schemasList = schemas
  ) => {
    const obj = objsList.find((o) => o.id === objId);
    const schema = schemasList.find((s) => s.id === schemaId);
    if (obj && schema) {
      const prefix = schema.id.includes('rebar')
        ? 'Nghiệm thu cốt thép'
        : schema.id.includes('concrete')
        ? 'Nghiệm thu đổ bê tông'
        : 'Biên bản nghiệm thu';
      form.setFieldsValue({
        title: `${prefix} - ${obj.name}`,
      });
    }
  };

  const handleObjectChange = (objId: string) => {
    const currentSchema = form.getFieldValue('formSchemaId') || selectedSchema;
    updateSuggestedTitle(objId, currentSchema);
  };

  const handleSchemaChange = (schemaId: string) => {
    setSelectedSchema(schemaId);
    fetchSchemaDetail(schemaId);
    const currentObjId = form.getFieldValue('objectId');
    if (currentObjId) {
      updateSuggestedTitle(currentObjId, schemaId);
    }
  };

  const handleSaveCustomSchema = (newSchema: FormIoSchema) => {
    setActiveSchemaObj(newSchema);
    setIsCustomized(true);
    setBuilderOpen(false);
    message.success(`Đã cập nhật biểu mẫu tùy biến với ${newSchema.components.length} chỉ tiêu!`);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);

      const formDataPayload: Record<string, any> = {
        inspectionTitle: values.title,
      };

      if (isCustomized && activeSchemaObj) {
        formDataPayload._customSchema = activeSchemaObj;
      }

      const newInspection = await inspectionApi.createInspection({
        objectId: values.objectId,
        formSchemaId: values.formSchemaId,
        formDataJson: JSON.stringify(formDataPayload),
      });

      message.success('Khởi tạo hồ sơ nghiệm thu thành công! Trạng thái: Bản nháp (Draft).');
      form.resetFields();
      setIsCustomized(false);
      onSuccess(newInspection);
    } catch (error: any) {
      const errorMsg =
        error.response?.data?.message ||
        error.response?.data?.detail ||
        'Có lỗi xảy ra khi tạo hồ sơ nghiệm thu.';
      message.error(errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Modal
        title={
          <Space align="center">
            <FileTextOutlined style={{ color: '#1677FF', fontSize: 20 }} />
            <Title level={4} style={{ margin: 0 }}>
              Khởi tạo Hồ sơ Nghiệm thu mới (Inspection)
            </Title>
          </Space>
        }
        open={visible}
        onCancel={onCancel}
        onOk={handleSubmit}
        okText="Khởi tạo hồ sơ (Draft)"
        cancelText="Hủy bỏ"
        confirmLoading={submitting}
        width={720}
        destroyOnClose
      >
        <Spin spinning={loading}>
          <Alert
            message="Ghi chú quy trình"
            description="Hồ sơ mới được tạo sẽ ở trạng thái 'Bản nháp' (Draft). Bạn có thể chọn mẫu có sẵn hoặc tùy biến/sắp xếp lại các chỉ tiêu kỹ thuật trước khi nộp."
            type="info"
            showIcon
            icon={<InfoCircleOutlined />}
            style={{ marginBottom: 20, borderRadius: 6 }}
          />

          <Form form={form} layout="vertical" requiredMark="optional">
            {/* 1. Chọn Cấu kiện (Object) */}
            <Form.Item
              name="objectId"
              label={<Text strong>1. Chọn Cấu kiện / Hạng mục kiểm tra (Object từ bản vẽ CAD)</Text>}
              rules={[{ required: true, message: 'Vui lòng chọn cấu kiện kiểm tra' }]}
            >
              <Select
                placeholder="Chọn cấu kiện đã khoanh vùng trên bản vẽ..."
                size="large"
                onChange={handleObjectChange}
                showSearch
                filterOption={(input, option) =>
                  (option?.label ?? '').toString().toLowerCase().includes(input.toLowerCase())
                }
                options={objects.map((obj) => ({
                  value: obj.id,
                  label: `${obj.name} (Bản vẽ trang ${obj.pageNumber})`,
                }))}
                notFoundContent={
                  <div style={{ padding: 12, textAlign: 'center' }}>
                    <Text type="secondary">
                      Chưa có cấu kiện nào được tạo. Vui lòng vào màn "Bản vẽ & Object" để khoanh vùng trước.
                    </Text>
                  </div>
                }
              />
            </Form.Item>

            {/* 2. Chọn Mẫu FormIO Schema */}
            <Form.Item
              name="formSchemaId"
              label={<Text strong>2. Chọn Mẫu biểu kiểm tra cơ sở</Text>}
              rules={[{ required: true, message: 'Vui lòng chọn mẫu biểu nghiệm thu' }]}
            >
              <Radio.Group
                style={{ width: '100%' }}
                onChange={(e) => handleSchemaChange(e.target.value)}
                value={selectedSchema}
              >
                <Space direction="vertical" style={{ width: '100%' }} size={10}>
                  {schemas.map((schema) => (
                    <Card
                      key={schema.id}
                      size="small"
                      hoverable
                      style={{
                        border:
                          selectedSchema === schema.id
                            ? '2px solid #1677FF'
                            : '1px solid #E5E7EB',
                        backgroundColor:
                          selectedSchema === schema.id ? '#F0F7FF' : '#FFFFFF',
                        borderRadius: 8,
                        cursor: 'pointer',
                      }}
                      onClick={() => {
                        form.setFieldsValue({ formSchemaId: schema.id });
                        handleSchemaChange(schema.id);
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Radio value={schema.id}>
                          <Text strong style={{ fontSize: 14 }}>
                            {schema.name}
                          </Text>
                        </Radio>
                        <Space>
                          <Tag color="blue">{schema.category}</Tag>
                          <Tag color="cyan">{schema.componentsCount} chỉ tiêu</Tag>
                        </Space>
                      </div>
                      <div style={{ paddingLeft: 24, marginTop: 4 }}>
                        <Text type="secondary" style={{ fontSize: 13 }}>
                          {schema.description}
                        </Text>
                      </div>
                    </Card>
                  ))}
                </Space>
              </Radio.Group>
            </Form.Item>

            {/* 3. Danh sách các chỉ tiêu trong mẫu & Nút Tùy biến / Sắp xếp */}
            {activeSchemaObj && (
              <Card
                size="small"
                style={{
                  marginBottom: 20,
                  backgroundColor: '#FAFCFF',
                  borderRadius: 8,
                  border: isCustomized ? '1.5px solid #52C41A' : '1px solid #E1EDFA',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <Space>
                    <Text strong style={{ color: '#003A8C' }}>
                      3. Các chỉ tiêu kỹ thuật trong biểu mẫu ({activeSchemaObj.components.length} trường):
                    </Text>
                    {isCustomized && (
                      <Tag color="success" icon={<CheckCircleOutlined />}>
                        Đã tùy biến riêng
                      </Tag>
                    )}
                  </Space>
                  <Button
                    type="primary"
                    ghost
                    icon={<ToolOutlined />}
                    onClick={() => setBuilderOpen(true)}
                    style={{ fontWeight: 600 }}
                  >
                    Kéo thả & Sắp xếp / Chỉnh sửa trường
                  </Button>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {activeSchemaObj.components.map((c, i) => (
                    <Tag key={c.key || i} color={c.validate?.required ? 'magenta' : 'geekblue'}>
                      {i + 1}. {c.label} {c.suffix && `(${c.suffix})`}
                    </Tag>
                  ))}
                </div>
              </Card>
            )}

            {/* 4. Tiêu đề hồ sơ */}
            <Form.Item
              name="title"
              label={<Text strong>4. Tiêu đề hồ sơ nghiệm thu</Text>}
              rules={[{ required: true, message: 'Vui lòng nhập tiêu đề hồ sơ' }]}
            >
              <Input
                size="large"
                placeholder="VD: Nghiệm thu cốt thép cột C12 tầng 3"
                prefix={<AppstoreOutlined style={{ color: '#BFBFBF' }} />}
              />
            </Form.Item>
          </Form>
        </Spin>
      </Modal>

      {/* Modal Form Builder để kéo thả sắp xếp */}
      <FormIoBuilderModal
        visible={builderOpen}
        initialSchema={activeSchemaObj}
        onCancel={() => setBuilderOpen(false)}
        onSave={handleSaveCustomSchema}
      />
    </>
  );
};
