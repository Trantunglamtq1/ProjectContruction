import React, { useState, useEffect } from 'react';
import {
  Modal,
  Row,
  Col,
  Card,
  Button,
  Space,
  Typography,
  Tag,
  List,
  Form,
  Input,
  InputNumber,
  Checkbox,
  Tabs,
  Popconfirm,
  Divider,
  message,
  Alert,
} from 'antd';
import {
  HolderOutlined,
  DeleteOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  EditOutlined,
  EyeOutlined,
  CodeOutlined,
  ToolOutlined,
  CheckCircleOutlined,
  FontSizeOutlined,
  NumberOutlined,
  DownSquareOutlined,
  CalendarOutlined,
  CheckSquareOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';
import { DynamicFormIoRenderer } from './DynamicFormIoRenderer';
import type { FormIoComponent, FormIoSchema } from '../../types/inspection';

const { Text, Title } = Typography;

interface FormIoBuilderModalProps {
  visible: boolean;
  initialSchema: FormIoSchema | null;
  onCancel: () => void;
  onSave: (updatedSchema: FormIoSchema) => void;
}

export const FormIoBuilderModal: React.FC<FormIoBuilderModalProps> = ({
  visible,
  initialSchema,
  onCancel,
  onSave,
}) => {
  const [components, setComponents] = useState<FormIoComponent[]>([]);
  const [selectedCompIndex, setSelectedCompIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [editForm] = Form.useForm();
  const [activeTab, setActiveTab] = useState<'designer' | 'preview' | 'json'>('designer');
  const [previewData, setPreviewData] = useState<Record<string, any>>({});

  const handleDropReorder = (fromIndex: number, toIndex: number) => {
    if (isNaN(fromIndex) || fromIndex === toIndex || fromIndex < 0 || fromIndex >= components.length) return;
    const list = [...components];
    const [movedItem] = list.splice(fromIndex, 1);
    list.splice(toIndex, 0, movedItem);
    setComponents(list);
    setSelectedCompIndex(toIndex);
    message.success(`Đã kéo thả "${movedItem.label}" đến vị trí ${toIndex + 1}!`);
  };

  useEffect(() => {
    if (visible) {
      if (initialSchema?.components && initialSchema.components.length > 0) {
        // Flatten panels for easy editing if needed or clone components
        setComponents(JSON.parse(JSON.stringify(initialSchema.components)));
      } else {
        // Default starter components
        setComponents([
          {
            key: 'inspectionTitle',
            label: 'Tiêu đề kiểm tra',
            type: 'textfield',
            validate: { required: true },
            placeholder: 'Nhập tên hạng mục',
          },
          {
            key: 'inspectionResult',
            label: 'Kết quả đánh giá',
            type: 'radio',
            values: [
              { label: 'Đạt yêu cầu', value: 'Pass' },
              { label: 'Không đạt', value: 'Fail' },
            ],
            validate: { required: true },
          },
          {
            key: 'notes',
            label: 'Ghi chú hiện trường',
            type: 'textarea',
            placeholder: 'Nhập nhận xét hoặc kiến nghị',
          },
        ]);
      }
      setSelectedCompIndex(0);
    }
  }, [visible, initialSchema]);

  useEffect(() => {
    if (selectedCompIndex !== null && components[selectedCompIndex]) {
      const comp = components[selectedCompIndex];
      editForm.setFieldsValue({
        label: comp.label,
        key: comp.key,
        placeholder: comp.placeholder,
        suffix: comp.suffix,
        required: comp.validate?.required || false,
        min: comp.validate?.min,
        max: comp.validate?.max,
        options: comp.values ? comp.values.map((v) => `${v.label}:${v.value}`).join('\n') : '',
      });
    }
  }, [selectedCompIndex, components, editForm]);

  // Thêm một trường mới từ Palette
  const handleAddComponent = (type: string) => {
    const timestamp = Date.now().toString().slice(-4);
    let newComp: FormIoComponent;

    switch (type) {
      case 'number':
        newComp = {
          key: `doSut_${timestamp}`,
          label: 'Độ sụt bê tông',
          type: 'number',
          suffix: 'cm',
          placeholder: 'VD: 12',
          validate: { required: true, min: 0, max: 30 },
        };
        break;
      case 'textarea':
        newComp = {
          key: `ghiChu_${timestamp}`,
          label: 'Nhận xét chi tiết',
          type: 'textarea',
          placeholder: 'Nhập ghi chú kỹ thuật',
          rows: 3,
        };
        break;
      case 'select':
        newComp = {
          key: `macBeTong_${timestamp}`,
          label: 'Mác bê tông thiết kế',
          type: 'select',
          values: [
            { label: 'Mác 250 (B20)', value: 'M250' },
            { label: 'Mác 300 (B22.5)', value: 'M300' },
            { label: 'Mác 350 (B25)', value: 'M350' },
            { label: 'Mác 400 (B30)', value: 'M400' },
          ],
          validate: { required: true },
        };
        break;
      case 'radio':
        newComp = {
          key: `ketQua_${timestamp}`,
          label: 'Đánh giá kỹ thuật',
          type: 'radio',
          values: [
            { label: 'Đạt (Pass)', value: 'Pass' },
            { label: 'Không đạt (Fail)', value: 'Fail' },
          ],
          validate: { required: true },
        };
        break;
      case 'datetime':
        newComp = {
          key: `ngayKiemTra_${timestamp}`,
          label: 'Thời gian lấy mẫu',
          type: 'datetime',
          validate: { required: true },
        };
        break;
      case 'checkbox':
        newComp = {
          key: `xacNhan_${timestamp}`,
          label: 'Đã kiểm tra chứng chỉ xuất xưởng',
          type: 'checkbox',
        };
        break;
      default:
        newComp = {
          key: `chiTieu_${timestamp}`,
          label: 'Chỉ tiêu kiểm tra mới',
          type: 'textfield',
          placeholder: 'Nhập giá trị',
        };
        break;
    }

    const updated = [...components, newComp];
    setComponents(updated);
    setSelectedCompIndex(updated.length - 1);
    message.success(`Đã thêm trường "${newComp.label}"`);
  };

  // Cập nhật thuộc tính của component đang chọn
  const handleUpdateProperties = (values: any) => {
    if (selectedCompIndex === null) return;
    const current = components[selectedCompIndex];
    if (!current) return;

    let parsedValues = current.values;
    if (values.options && (current.type === 'select' || current.type === 'radio')) {
      parsedValues = values.options
        .split('\n')
        .map((line: string) => {
          const parts = line.split(':');
          return {
            label: parts[0]?.trim() || line.trim(),
            value: parts[1]?.trim() || parts[0]?.trim() || line.trim(),
          };
        })
        .filter((o: any) => o.label);
    }

    const updatedComp: FormIoComponent = {
      ...current,
      label: values.label,
      key: values.key || current.key,
      placeholder: values.placeholder,
      suffix: values.suffix,
      validate: {
        ...current.validate,
        required: values.required,
        min: values.min,
        max: values.max,
      },
      values: parsedValues,
    };

    const updatedList = [...components];
    updatedList[selectedCompIndex] = updatedComp;
    setComponents(updatedList);
  };

  // Di chuyển trường lên / xuống
  const handleMove = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= components.length) return;

    const list = [...components];
    const temp = list[index];
    list[index] = list[targetIndex];
    list[targetIndex] = temp;

    setComponents(list);
    setSelectedCompIndex(targetIndex);
  };

  // Xóa trường
  const handleDelete = (index: number) => {
    const list = components.filter((_, i) => i !== index);
    setComponents(list);
    if (selectedCompIndex === index) {
      setSelectedCompIndex(list.length > 0 ? 0 : null);
    } else if (selectedCompIndex !== null && selectedCompIndex > index) {
      setSelectedCompIndex(selectedCompIndex - 1);
    }
    message.info('Đã xóa trường.');
  };

  const handleSaveAll = () => {
    if (components.length === 0) {
      message.error('Biểu mẫu phải có ít nhất 1 chỉ tiêu kiểm tra.');
      return;
    }
    const finalSchema: FormIoSchema = {
      display: 'form',
      title: initialSchema?.title || 'Biểu mẫu tùy chỉnh',
      components: components,
    };
    onSave(finalSchema);
    message.success('Đã áp dụng biểu mẫu thành công!');
  };

  const currentComp = selectedCompIndex !== null ? components[selectedCompIndex] : null;

  return (
    <Modal
      title={
        <Space align="center">
          <ToolOutlined style={{ color: '#1677FF', fontSize: 20 }} />
          <Title level={4} style={{ margin: 0 }}>
            Bộ thiết kế Biểu mẫu Nghiệm thu Động (FormIO Visual Builder)
          </Title>
        </Space>
      }
      open={visible}
      onCancel={onCancel}
      width={1040}
      zIndex={1350}
      onOk={handleSaveAll}
      okText="Áp dụng Biểu mẫu này"
      cancelText="Hủy"
      destroyOnClose
    >
      <Tabs
        activeKey={activeTab}
        onChange={(k) => setActiveTab(k as any)}
        items={[
          {
            key: 'designer',
            label: (
              <Space>
                <ToolOutlined />
                <span>Thiết kế & Chỉnh sửa</span>
              </Space>
            ),
            children: (
              <div>
                {/* 1. Thanh Component Palette: Thêm nhanh các trường */}
                <Card
                  size="small"
                  style={{
                    marginBottom: 16,
                    backgroundColor: '#F8FAFC',
                    borderRadius: 8,
                    border: '1px solid #E2E8F0',
                  }}
                >
                  <div style={{ marginBottom: 8 }}>
                    <Text strong style={{ fontSize: 13, color: '#475569' }}>
                      KHO CẤU KIỆN TRƯỜNG (Bấm để thêm vào biểu mẫu):
                    </Text>
                  </div>
                  <Space wrap size={8}>
                    <Button
                      size="small"
                      icon={<FontSizeOutlined />}
                      onClick={() => handleAddComponent('textfield')}
                    >
                      + Văn bản (Text)
                    </Button>
                    <Button
                      size="small"
                      type="primary"
                      ghost
                      icon={<NumberOutlined />}
                      onClick={() => handleAddComponent('number')}
                    >
                      + Số / Độ sụt / Nhiệt độ
                    </Button>
                    <Button
                      size="small"
                      icon={<UnorderedListOutlined />}
                      onClick={() => handleAddComponent('textarea')}
                    >
                      + Ghi chú (TextArea)
                    </Button>
                    <Button
                      size="small"
                      icon={<DownSquareOutlined />}
                      onClick={() => handleAddComponent('select')}
                    >
                      + Danh sách chọn (Select)
                    </Button>
                    <Button
                      size="small"
                      icon={<CheckCircleOutlined />}
                      onClick={() => handleAddComponent('radio')}
                    >
                      + Đạt / Không đạt (Pass/Fail)
                    </Button>
                    <Button
                      size="small"
                      icon={<CalendarOutlined />}
                      onClick={() => handleAddComponent('datetime')}
                    >
                      + Ngày giờ (DateTime)
                    </Button>
                    <Button
                      size="small"
                      icon={<CheckSquareOutlined />}
                      onClick={() => handleAddComponent('checkbox')}
                    >
                      + Xác nhận (Checkbox)
                    </Button>
                  </Space>
                </Card>

                {/* 2. Cột trái: Danh sách các trường - Cột phải: Chỉnh sửa thuộc tính */}
                <Row gutter={16}>
                  <Col span={11}>
                    <Card
                      title={
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Text strong>Các chỉ tiêu trong Form ({components.length})</Text>
                          <Tag color="blue">Kéo/Sắp xếp</Tag>
                        </div>
                      }
                      size="small"
                      style={{ borderRadius: 8, minHeight: 400 }}
                    >
                      <List
                        dataSource={components}
                        renderItem={(item, index) => {
                          const isSelected = selectedCompIndex === index;
                          const isOver = dragOverIndex === index;
                          return (
                            <List.Item
                              draggable
                              onDragStart={(e) => {
                                e.dataTransfer.setData('text/plain', index.toString());
                              }}
                              onDragOver={(e) => {
                                e.preventDefault();
                                if (dragOverIndex !== index) setDragOverIndex(index);
                              }}
                              onDragLeave={() => {
                                setDragOverIndex(null);
                              }}
                              onDrop={(e) => {
                                e.preventDefault();
                                setDragOverIndex(null);
                                const fromIdx = parseInt(e.dataTransfer.getData('text/plain'), 10);
                                handleDropReorder(fromIdx, index);
                              }}
                              style={{
                                padding: '8px 12px',
                                borderRadius: 6,
                                marginBottom: 6,
                                backgroundColor: isOver ? '#E6F4FF' : isSelected ? '#EFF6FF' : '#FFFFFF',
                                border: isOver
                                  ? '2px dashed #1677FF'
                                  : isSelected
                                  ? '1.5px solid #1677FF'
                                  : '1px solid #E5E7EB',
                                cursor: 'grab',
                                transition: 'all 0.15s ease',
                              }}
                              onClick={() => setSelectedCompIndex(index)}
                            >
                              <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Space>
                                  <HolderOutlined style={{ color: '#8C8C8C', cursor: 'grab', fontSize: 14 }} />
                                  <Text strong style={{ color: isSelected ? '#1677FF' : '#1F2937' }}>
                                    {index + 1}. {item.label}
                                  </Text>
                                  <Tag color="cyan" style={{ fontSize: 11 }}>{item.type}</Tag>
                                  {item.validate?.required && <Tag color="error">Bắt buộc</Tag>}
                                  {item.suffix && <Tag color="blue">{item.suffix}</Tag>}
                                </Space>
                                <Space size={2} onClick={(e) => e.stopPropagation()}>
                                  <Button
                                    size="small"
                                    type="text"
                                    icon={<ArrowUpOutlined />}
                                    disabled={index === 0}
                                    onClick={() => handleMove(index, 'up')}
                                  />
                                  <Button
                                    size="small"
                                    type="text"
                                    icon={<ArrowDownOutlined />}
                                    disabled={index === components.length - 1}
                                    onClick={() => handleMove(index, 'down')}
                                  />
                                  <Popconfirm
                                    title="Xóa trường này?"
                                    onConfirm={() => handleDelete(index)}
                                    okText="Xóa"
                                    cancelText="Hủy"
                                  >
                                    <Button size="small" type="text" danger icon={<DeleteOutlined />} />
                                  </Popconfirm>
                                </Space>
                              </div>
                            </List.Item>
                          );
                        }}
                      />
                    </Card>
                  </Col>

                  <Col span={13}>
                    <Card
                      title={
                        <Space>
                          <EditOutlined style={{ color: '#1677FF' }} />
                          <Text strong>
                            Thuộc tính chỉ tiêu: {currentComp?.label || 'Chưa chọn'}
                          </Text>
                        </Space>
                      }
                      size="small"
                      style={{ borderRadius: 8, minHeight: 400 }}
                    >
                      {currentComp ? (
                        <Form
                          form={editForm}
                          layout="vertical"
                          onValuesChange={(_, allVals) => handleUpdateProperties(allVals)}
                        >
                          <Form.Item
                            name="label"
                            label={<Text strong>Tên nhãn hiển thị (Label - vd: Độ sụt, Nhiệt độ...)</Text>}
                            rules={[{ required: true, message: 'Vui lòng nhập tên nhãn' }]}
                          >
                            <Input placeholder="Tên hiển thị trên form" />
                          </Form.Item>

                          <Row gutter={12}>
                            <Col span={12}>
                              <Form.Item
                                name="key"
                                label={<Text strong>Mã dữ liệu (Key)</Text>}
                                rules={[{ required: true, message: 'Vui lòng nhập key' }]}
                              >
                                <Input placeholder="vd: doSut" />
                              </Form.Item>
                            </Col>
                            <Col span={12}>
                              <Form.Item name="suffix" label={<Text strong>Đơn vị tính (Suffix)</Text>}>
                                <Input placeholder="vd: cm, °C, MPa, mm" />
                              </Form.Item>
                            </Col>
                          </Row>

                          <Form.Item name="placeholder" label="Gợi ý nhập liệu (Placeholder)">
                            <Input placeholder="Văn bản mờ hướng dẫn người dùng" />
                          </Form.Item>

                          {currentComp.type === 'number' && (
                            <Row gutter={12}>
                              <Col span={12}>
                                <Form.Item name="min" label="Giá trị tối thiểu (Min)">
                                  <InputNumber style={{ width: '100%' }} />
                                </Form.Item>
                              </Col>
                              <Col span={12}>
                                <Form.Item name="max" label="Giá trị tối đa (Max)">
                                  <InputNumber style={{ width: '100%' }} />
                                </Form.Item>
                              </Col>
                            </Row>
                          )}

                          {(currentComp.type === 'select' || currentComp.type === 'radio') && (
                            <Form.Item
                              name="options"
                              label="Danh sách tùy chọn (Mỗi dòng một mục: Tên:Mã)"
                              extra="Ví dụ: Đạt yêu cầu:Pass hoặc Mác 300:M300"
                            >
                              <Input.TextArea rows={4} placeholder="Tùy chọn 1:Val1&#10;Tùy chọn 2:Val2" />
                            </Form.Item>
                          )}

                          <Divider style={{ margin: '12px 0' }} />

                          <Form.Item name="required" valuePropName="checked">
                            <Checkbox>
                              <Text strong style={{ color: '#DC2626' }}>
                                Bắt buộc phải nhập trước khi nộp hồ sơ (Required)
                              </Text>
                            </Checkbox>
                          </Form.Item>
                        </Form>
                      ) : (
                        <div style={{ textAlign: 'center', padding: '60px 0' }}>
                          <Text type="secondary">Chọn một trường ở cột bên trái để chỉnh sửa thuộc tính.</Text>
                        </div>
                      )}
                    </Card>
                  </Col>
                </Row>
              </div>
            ),
          },
          {
            key: 'preview',
            label: (
              <Space>
                <EyeOutlined />
                <span>Xem trước Giao diện Form (Live Preview)</span>
              </Space>
            ),
            children: (
              <Card style={{ borderRadius: 8, backgroundColor: '#FBFDFF', minHeight: 400 }}>
                <Alert
                  message="Chế độ Xem trước Trực tiếp"
                  description="Dưới đây là giao diện thực tế mà Kỹ sư hiện trường sẽ điền khi tạo hoặc chỉnh sửa đơn nghiệm thu."
                  type="success"
                  showIcon
                  style={{ marginBottom: 16 }}
                />
                <DynamicFormIoRenderer
                  schema={{ display: 'form', components }}
                  initialData={previewData}
                  onChange={setPreviewData}
                />
              </Card>
            ),
          },
          {
            key: 'json',
            label: (
              <Space>
                <CodeOutlined />
                <span>Cấu trúc JSON Schema FormIO</span>
              </Space>
            ),
            children: (
              <Card style={{ borderRadius: 8, backgroundColor: '#1E293B' }}>
                <pre style={{ color: '#38BDF8', fontSize: 13, margin: 0, maxHeight: 420, overflow: 'auto' }}>
                  {JSON.stringify({ display: 'form', components }, null, 2)}
                </pre>
              </Card>
            ),
          },
        ]}
      />
    </Modal>
  );
};
