import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, Button, Typography, Row, Col, Modal, Form, Input, Empty, Spin, Tag, Space, Popconfirm } from 'antd'
import { PlusOutlined, FolderOutlined, ArrowRightOutlined, DeleteOutlined } from '@ant-design/icons'
import { supabase } from '../lib/supabase'
import type { Project } from '../lib/types'

async function fetchProjects(): Promise<Project[]> {
  const { data, error } = await supabase.from('projects').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export default function Projects() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [form] = Form.useForm()

  const { data: projects, isLoading } = useQuery({ queryKey: ['projects'], queryFn: fetchProjects })

  const deleteProject = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('projects').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }),
  })

  const create = useMutation({
    mutationFn: async (values: { name: string; description: string }) => {
      const { error } = await supabase.from('projects').insert(values)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] })
      setOpen(false)
      form.resetFields()
    },
  })

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Typography.Title level={3} style={{ margin: 0 }}>Proyectos</Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>
          Nuevo proyecto
        </Button>
      </div>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>
      ) : !projects?.length ? (
        <Empty description="No hay proyectos aún. ¡Creá el primero!" />
      ) : (
        <Row gutter={[16, 16]}>
          {projects.map(p => (
            <Col xs={24} sm={12} lg={8} key={p.id}>
              <Card
                hoverable
                onClick={() => navigate(`/projects/${p.id}`)}
                style={{ height: '100%' }}
                actions={[
                  <Button
                    key="open"
                    type="link"
                    icon={<ArrowRightOutlined />}
                    onClick={e => { e.stopPropagation(); navigate(`/projects/${p.id}`) }}
                  >
                    Abrir
                  </Button>,
                  <Popconfirm
                    key="del"
                    title="¿Eliminar este proyecto?"
                    description="Se eliminarán todas las historias, casos y runs asociados."
                    onConfirm={e => { e?.stopPropagation(); deleteProject.mutate(p.id) }}
                    onCancel={e => e?.stopPropagation()}
                    okText="Sí, eliminar"
                    cancelText="Cancelar"
                    okButtonProps={{ danger: true }}
                  >
                    <Button
                      key="del-btn"
                      type="text"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={e => e.stopPropagation()}
                    />
                  </Popconfirm>,
                ]}
              >
                <Space>
                  <FolderOutlined style={{ fontSize: 24, color: '#4f46e5' }} />
                  <Typography.Title level={5} style={{ margin: 0 }}>{p.name}</Typography.Title>
                </Space>
                {p.description && (
                  <Typography.Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
                    {p.description}
                  </Typography.Text>
                )}
                <Tag color="purple" style={{ marginTop: 12 }}>
                  {new Date(p.created_at).toLocaleDateString('es-AR')}
                </Tag>
              </Card>
            </Col>
          ))}
        </Row>
      )}

      <Modal
        title="Nuevo proyecto"
        open={open}
        onCancel={() => { setOpen(false); form.resetFields() }}
        onOk={() => form.submit()}
        confirmLoading={create.isPending}
        okText="Crear"
        cancelText="Cancelar"
      >
        <Form form={form} layout="vertical" onFinish={values => create.mutate(values)}>
          <Form.Item label="Nombre" name="name" rules={[{ required: true }]}>
            <Input placeholder="Ej: Sistema de Caja" />
          </Form.Item>
          <Form.Item label="Descripción" name="description">
            <Input.TextArea rows={3} placeholder="Descripción opcional del proyecto" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}
