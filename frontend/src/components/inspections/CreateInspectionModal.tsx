import React, { useState, useEffect } from 'react';
import {
  Modal,
  Form,
  Select,
  Input,
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
  CheckSquareOutlined,
} from '@ant-design/icons';
import { inspectionApi } from '../../services/inspectionApi';
import { checklistApi } from '../../services/checklistApi';
import { FormIoBuilderModal } from '../formio/FormIoBuilderModal';
import { InspectionImageGallery } from './InspectionImageGallery';
import type {
  InspectionDto,
  ConstructionObjectDto,
  FormIoSchema,
  InspectionAttachmentDto,
} from '../../types/inspection';
import type { ChecklistDto } from '../../types/checklist';

const { Text, Title } = Typography;

interface CreateInspectionModalProps {
  visible: boolean;
  onCancel: () => void;
  onSuccess: (newInspection: InspectionDto) => void;
  preselectedObjectId?: string;
  preselectedChecklistId?: string;
  preselectedChecklistItemId?: string;
}

export const CreateInspectionModal: React.FC<CreateInspectionModalProps> = ({
  visible,
  onCancel,
  onSuccess,
  preselectedObjectId,
  preselectedChecklistId,
  preselectedChecklistItemId,
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [objects, setObjects] = useState<ConstructionObjectDto[]>([]);
  
  // Danh sách Checklist của cấu kiện đã chọn
  const [objectChecklists, setObjectChecklists] = useState<ChecklistDto[]>([]);
  const [loadingChecklists, setLoadingChecklists] = useState(false);
  const [selectedChecklist, setSelectedChecklist] = useState<ChecklistDto | null>(null);

  // Schema tùy biến & Modal Form Builder
  const [activeSchemaObj, setActiveSchemaObj] = useState<FormIoSchema | null>(null);
  const [isCustomized, setIsCustomized] = useState(false);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [attachments, setAttachments] = useState<InspectionAttachmentDto[]>([]);

  useEffect(() => {
    if (visible) {
      loadInitialObjects();
    }
  }, [visible]);

  const loadInitialObjects = async () => {
    setLoading(true);
    try {
      const objsData = await inspectionApi.getObjects();
      setObjects(objsData);

      const targetObjId = preselectedObjectId || (objsData.length > 0 ? objsData[0].id : undefined);
      if (targetObjId) {
        form.setFieldsValue({ objectId: targetObjId });
        await loadChecklistsForObject(targetObjId);
      }
    } catch {
      message.error('Không thể tải danh sách Cấu kiện.');
    } finally {
      setLoading(false);
    }
  };

  const loadChecklistsForObject = async (objId: string) => {
    setLoadingChecklists(true);
    try {
      const chks = await checklistApi.getChecklists({ objectId: objId });
      // Lọc các Checklist ở trạng thái đã được duyệt (Approved / InProgress)
      const approvedChks = chks.filter((c) => c.status === 'Approved' || c.status === 'InProgress');
      setObjectChecklists(approvedChks);

      if (approvedChks.length > 0) {
        const chosenChk = preselectedChecklistId 
          ? approvedChks.find((c) => c.id === preselectedChecklistId) || approvedChks[0]
          : approvedChks[0];

        setSelectedChecklist(chosenChk);
        form.setFieldsValue({ checklistId: chosenChk.id });

        const items = chosenChk.items || [];
        if (items.length > 0) {
          const chosenItem = preselectedChecklistItemId
            ? items.find((i) => i.id === preselectedChecklistItemId) || items[0]
            : items[0];

          form.setFieldsValue({ checklistItemId: chosenItem.id });
          parseAndSetSchema(chosenItem.formSchemaJson, chosenItem.name);
        } else {
          form.setFieldsValue({ checklistItemId: undefined });
          setActiveSchemaObj(null);
        }
      } else {
        setSelectedChecklist(null);
        form.setFieldsValue({ checklistId: undefined, checklistItemId: undefined });
        setActiveSchemaObj(null);
      }
    } catch {
      message.error('Không thể tải danh sách Checklist của cấu kiện.');
    } finally {
      setLoadingChecklists(false);
    }
  };

  const parseAndSetSchema = (schemaJson?: string, itemName?: string) => {
    if (!schemaJson || schemaJson === '{}') {
      const fallback: FormIoSchema = {
        display: 'form',
        components: [
          {
            type: 'textfield',
            key: 'inspectionTitle',
            label: 'Nội dung kiểm tra / Hạng mục',
            placeholder: `Nghiệm thu: ${itemName || ''}`,
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
            type: 'textarea',
            key: 'notes',
            label: 'Ghi chú kỹ thuật & Nhật ký hiện trường',
          },
        ],
      };
      setActiveSchemaObj(fallback);
      form.setFieldsValue({ title: `Nghiệm thu: ${itemName || ''}` });
      return;
    }

    try {
      const parsed = JSON.parse(schemaJson);
      setActiveSchemaObj(parsed);
      form.setFieldsValue({ title: `Nghiệm thu: ${itemName || ''}` });
    } catch {
      setActiveSchemaObj(null);
    }
  };

  const handleObjectChange = async (objId: string) => {
    await loadChecklistsForObject(objId);
  };

  const handleChecklistChange = (chkId: string) => {
    const chk = objectChecklists.find((c) => c.id === chkId);
    setSelectedChecklist(chk || null);

    const items = chk?.items || [];
    if (items.length > 0) {
      form.setFieldsValue({ checklistItemId: items[0].id });
      parseAndSetSchema(items[0].formSchemaJson, items[0].name);
    } else {
      form.setFieldsValue({ checklistItemId: undefined });
      setActiveSchemaObj(null);
    }
  };

  const handleItemChange = (itemId: string) => {
    const item = selectedChecklist?.items?.find((i) => i.id === itemId);
    if (item) {
      parseAndSetSchema(item.formSchemaJson, item.name);
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
      if (!values.checklistId || !values.checklistItemId) {
        message.warning('Phiếu nghiệm thu phải gắn liền với 1 Checklist và 1 Tiêu chí cụ thể.');
        return;
      }

      setSubmitting(true);

      const formDataPayload: Record<string, any> = {
        inspectionTitle: values.title,
        attachments: attachments,
      };

      if (isCustomized && activeSchemaObj) {
        formDataPayload._customSchema = activeSchemaObj;
      }

      const newInspection = await inspectionApi.createInspection({
        checklistId: values.checklistId,
        checklistItemId: values.checklistItemId,
        objectId: values.objectId,
        formDataJson: JSON.stringify(formDataPayload),
        submitImmediately: false,
      });

      message.success('Khởi tạo hồ sơ nghiệm thu thành công! Trạng thái: Bản nháp (Draft).');
      form.resetFields();
      setAttachments([]);
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
              Khởi tạo Phiếu Nghiệm Thu Hiện Trường
            </Title>
          </Space>
        }
        open={visible}
        onCancel={onCancel}
        onOk={handleSubmit}
        okText="Khởi tạo phiếu (Draft)"
        cancelText="Hủy bỏ"
        confirmLoading={submitting}
        width={720}
        destroyOnClose
      >
        <Spin spinning={loading || loadingChecklists}>
          <Alert
            message="Quy tắc nghiệp vụ cốt lõi"
            description="Mỗi phiếu nghiệm thu là một tiêu chí (ChecklistItem) nằm trong Kế hoạch Checklist đã được Giám sát phê duyệt. Không được phép tạo phiếu nghiệm thu đứng riêng lẻ."
            type="info"
            showIcon
            icon={<InfoCircleOutlined />}
            style={{ marginBottom: 20, borderRadius: 6 }}
          />

          <Form form={form} layout="vertical" requiredMark="optional">
            {/* 1. Chọn Cấu kiện (Object) */}
            <Form.Item
              name="objectId"
              label={<Text strong>1. Chọn Cấu kiện / Hạng mục (Object từ bản vẽ)</Text>}
              rules={[{ required: true, message: 'Vui lòng chọn cấu kiện kiểm tra' }]}
            >
              <Select
                placeholder="Chọn cấu kiện đã khoanh vùng trên bản vẽ..."
                size="middle"
                onChange={handleObjectChange}
                showSearch
                filterOption={(input, option) =>
                  (option?.label ?? '').toString().toLowerCase().includes(input.toLowerCase())
                }
                options={objects.map((obj) => ({
                  value: obj.id,
                  label: `${obj.name} (Bản vẽ trang ${obj.pageNumber})`,
                }))}
              />
            </Form.Item>

            {/* 2. Chọn Checklist đã được phê duyệt */}
            <Form.Item
              name="checklistId"
              label={<Text strong>2. Kế hoạch Checklist đã phê duyệt (Approved / InProgress)</Text>}
              rules={[{ required: true, message: 'Vui lòng chọn Kế hoạch Checklist!' }]}
            >
              {objectChecklists.length === 0 ? (
                <Alert
                  type="warning"
                  showIcon
                  message="Cấu kiện này chưa có Checklist nào được phê duyệt"
                  description="Theo quy trình 2 giai đoạn, Kỹ sư phải vào màn xem bản vẽ để Lập Checklist và gửi Giám sát duyệt trước khi tiến hành nghiệm thu."
                />
              ) : (
                <Select
                  placeholder="Chọn Checklist đã phê duyệt..."
                  size="middle"
                  onChange={handleChecklistChange}
                  options={objectChecklists.map((chk) => ({
                    value: chk.id,
                    label: `${chk.name} (${chk.itemsCount} tiêu chí • Trạng thái: ${chk.status})`,
                  }))}
                />
              )}
            </Form.Item>

            {/* 3. Chọn Tiêu chí / ChecklistItem */}
            {selectedChecklist && (
              <Form.Item
                name="checklistItemId"
                label={<Text strong>3. Tiêu chí kiểm tra trong Checklist (ChecklistItem)</Text>}
                rules={[{ required: true, message: 'Vui lòng chọn tiêu chí kiểm tra!' }]}
              >
                <Select
                  placeholder="Chọn tiêu chí cần nghiệm thu..."
                  size="middle"
                  onChange={handleItemChange}
                  options={(selectedChecklist.items || []).map((item) => ({
                    value: item.id,
                    label: `${item.orderIndex}. ${item.name} ${item.isRequired ? '(Bắt buộc)' : ''} - Trạng thái: ${item.status}`,
                  }))}
                />
              </Form.Item>
            )}

            {/* 4. Xem / Tùy biến Schema của ChecklistItem */}
            {activeSchemaObj && (
              <Card
                size="small"
                style={{
                  marginBottom: 16,
                  backgroundColor: '#FAFCFF',
                  borderRadius: 8,
                  border: isCustomized ? '1.5px solid #52C41A' : '1px solid #E1EDFA',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <Space>
                    <CheckSquareOutlined style={{ color: '#1677ff' }} />
                    <Text strong style={{ color: '#003A8C' }}>
                      Cấu trúc biểu mẫu của tiêu chí ({activeSchemaObj.components.length} trường):
                    </Text>
                    {isCustomized && (
                      <Tag color="success" icon={<CheckCircleOutlined />}>
                        Đã chỉnh sửa
                      </Tag>
                    )}
                  </Space>
                  <Button
                    type="primary"
                    ghost
                    size="small"
                    icon={<ToolOutlined />}
                    onClick={() => setBuilderOpen(true)}
                  >
                    Xem / Sửa trường
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

            {/* 5. Tiêu đề hồ sơ */}
            <Form.Item
              name="title"
              label={<Text strong>4. Tiêu đề hồ sơ nghiệm thu</Text>}
              rules={[{ required: true, message: 'Vui lòng nhập tiêu đề hồ sơ' }]}
            >
              <Input
                size="middle"
                placeholder="VD: Nghiệm thu cốt thép cột C12 tầng 3"
                prefix={<AppstoreOutlined style={{ color: '#BFBFBF' }} />}
              />
            </Form.Item>

            {/* 6. Tải lên ảnh hiện trường */}
            <div style={{ marginTop: 8, marginBottom: 8 }}>
              <InspectionImageGallery
                attachments={attachments}
                onChange={setAttachments}
                readonly={false}
              />
            </div>
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
