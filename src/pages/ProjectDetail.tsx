import { useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Tabs, Typography, Button, Space, Tag, Card, Collapse, List,
  Modal, Form, Input, Select, Empty, Spin, Badge, Tooltip, Popconfirm, Checkbox,
} from 'antd'
import {
  PlusOutlined, PlayCircleOutlined, CheckCircleOutlined,
  CloseCircleOutlined, TagOutlined, DeleteOutlined,
} from '@ant-design/icons'
import { supabase } from '../lib/supabase'
import type { Project, AppRole, UserStory, TestCase, TestRun } from '../lib/types'

const ROLE_COLORS = ['#4f46e5', '#0891b2', '#059669', '#d97706', '#dc2626', '#7c3aed', '#db2777']

async function fetchProject(id: string) {
  const [proj, roles, stories, cases, runs] = await Promise.all([
    supabase.from('projects').select('*').eq('id', id).single(),
    supabase.from('app_roles').select('*').eq('project_id', id).order('name'),
    supabase.from('user_stories').select('*').eq('project_id', id).order('order'),
    supabase.from('test_cases').select('*, test_case_roles(app_role_id)').eq('project_id', id).order('order'),
    supabase.from('test_runs').select('*').eq('project_id', id).order('created_at', { ascending: false }),
  ])
  if (proj.error) throw proj.error
  return {
    project: proj.data as Project,
    roles: (roles.data ?? []) as AppRole[],
    stories: (stories.data ?? []) as UserStory[],
    cases: (cases.data ?? []) as (TestCase & { test_case_roles: { app_role_id: string }[] })[],
    runs: (runs.data ?? []) as TestRun[],
  }
}

export default function ProjectDetail() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = searchParams.get('tab') ?? 'cases'
  const qc = useQueryClient()
  const [filterRole, setFilterRole] = useState<string | null>(null)
  const [storyModal, setStoryModal] = useState(false)
  const [caseModal, setCaseModal] = useState<string | null>(null) // user_story_id
  const [roleModal, setRoleModal] = useState(false)
  const [runModal, setRunModal] = useState(false)
  const [storyForm] = Form.useForm()
  const [caseForm] = Form.useForm()
  const [roleForm] = Form.useForm()
  const [runForm] = Form.useForm()

  const { data, isLoading } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => fetchProject(projectId!),
    enabled: !!projectId,
  })

  const createStory = useMutation({
    mutationFn: async (v: { title: string; description: string; priority: string }) => {
      const { error } = await supabase.from('user_stories').insert({ ...v, project_id: projectId! })
      if (error) throw error
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['project', projectId] }); setStoryModal(false); storyForm.resetFields() },
  })

  const createCase = useMutation({
    mutationFn: async (v: { title: string; description: string; steps: string; expected_result: string; role_ids: string[] }) => {
      const { role_ids, ...rest } = v
      const { data, error } = await supabase.from('test_cases').insert({ ...rest, project_id: projectId!, user_story_id: caseModal! }).select().single()
      if (error) throw error
      if (role_ids?.length) {
        await supabase.from('test_case_roles').insert(role_ids.map(r => ({ test_case_id: data.id, app_role_id: r })))
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['project', projectId] }); setCaseModal(null); caseForm.resetFields() },
  })

  const createRole = useMutation({
    mutationFn: async (v: { name: string; description: string; color: string }) => {
      const { error } = await supabase.from('app_roles').insert({ ...v, project_id: projectId! })
      if (error) throw error
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['project', projectId] }); setRoleModal(false); roleForm.resetFields() },
  })

  const createRun = useMutation({
    mutationFn: async (v: { name: string; role_filter_id?: string; skip_passed: boolean }) => {
      const { skip_passed, ...runData } = v
      const { data: run, error } = await supabase.from('test_runs').insert({ ...runData, project_id: projectId! }).select().single()
      if (error) throw error

      // Filter by role
      let casesToInclude = data!.cases
      if (v.role_filter_id) {
        casesToInclude = casesToInclude.filter(c => c.test_case_roles.some(r => r.app_role_id === v.role_filter_id))
      }

      // Exclude cases that already passed in a previous run
      if (skip_passed) {
        const { data: passedResults } = await supabase
          .from('test_results')
          .select('test_case_id')
          .eq('status', 'pass')
          .in('test_case_id', casesToInclude.map(c => c.id))
        const passedIds = new Set((passedResults ?? []).map(r => r.test_case_id))
        casesToInclude = casesToInclude.filter(c => !passedIds.has(c.id))
      }

      if (casesToInclude.length) {
        const { error: resErr } = await supabase.from('test_results').insert(
          casesToInclude.map(c => ({ test_run_id: run.id, test_case_id: c.id, status: 'pending' }))
        )
        if (resErr) throw resErr
      }
      return run
    },
    onSuccess: (run) => {
      qc.invalidateQueries({ queryKey: ['project', projectId] })
      setRunModal(false)
      runForm.resetFields()
      navigate(`/projects/${projectId}/run/${run.id}`)
    },
  })

  const deleteRun = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('test_runs').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['project', projectId] }),
  })

  const deleteStory = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('user_stories').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['project', projectId] }),
  })

  const deleteCase = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('test_cases').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['project', projectId] }),
  })

  const deleteRole = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('app_roles').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['project', projectId] }),
  })

  if (isLoading) return <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>
  if (!data) return null

  const { project, roles, stories, cases, runs } = data

  const filteredCases = filterRole
    ? cases.filter(c => c.test_case_roles.some(r => r.app_role_id === filterRole))
    : cases

  const roleMap = Object.fromEntries(roles.map(r => [r.id, r]))

  const priorityColor: Record<string, string> = { high: 'red', medium: 'orange', low: 'blue' }
  const priorityLabel: Record<string, string> = { high: 'Alta', medium: 'Media', low: 'Baja' }

  return (
    <>
      <div style={{ marginBottom: 24 }}>
        <Typography.Title level={3} style={{ margin: 0 }}>{project.name}</Typography.Title>
        {project.description && <Typography.Text type="secondary">{project.description}</Typography.Text>}
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={key => setSearchParams({ tab: key })}
        items={[
          {
            key: 'cases',
            label: 'Casos de test',
            children: (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
                  <Space wrap>
                    <span style={{ fontWeight: 500 }}>Filtrar por rol:</span>
                    <Select
                      allowClear
                      placeholder="Todos los roles"
                      style={{ minWidth: 180 }}
                      onChange={v => setFilterRole(v ?? null)}
                      options={roles.map(r => ({ value: r.id, label: r.name }))}
                    />
                  </Space>
                  <Space>
                    <Button icon={<TagOutlined />} onClick={() => setRoleModal(true)}>
                      Roles ({roles.length})
                    </Button>
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => setStoryModal(true)}>
                      Historia de usuario
                    </Button>
                  </Space>
                </div>

                {stories.length === 0 ? (
                  <Empty description="No hay historias aún. Creá la primera." />
                ) : (
                  <Collapse
                    defaultActiveKey={stories.map(s => s.id)}
                    items={stories.map(story => {
                      const storyCases = filteredCases.filter(c => c.user_story_id === story.id)
                      return {
                        key: story.id,
                        label: (
                          <Space>
                            <span style={{ fontWeight: 600 }}>{story.title}</span>
                            <Tag color={priorityColor[story.priority]}>{priorityLabel[story.priority]}</Tag>
                            <Tag>{storyCases.length} casos</Tag>
                          </Space>
                        ),
                        extra: (
                          <Space onClick={e => e.stopPropagation()}>
                            <Button
                              size="small"
                              icon={<PlusOutlined />}
                              onClick={() => setCaseModal(story.id)}
                            >
                              Agregar caso
                            </Button>
                            <Popconfirm
                              title="¿Eliminar esta historia?"
                              description="Se eliminarán todos sus casos de test."
                              onConfirm={() => deleteStory.mutate(story.id)}
                              okText="Sí, eliminar"
                              cancelText="Cancelar"
                              okButtonProps={{ danger: true }}
                            >
                              <Button size="small" danger icon={<DeleteOutlined />} />
                            </Popconfirm>
                          </Space>
                        ),
                        children: storyCases.length === 0 ? (
                          <Empty description="Sin casos de test" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                        ) : (
                          <List
                            dataSource={storyCases}
                            renderItem={tc => (
                              <List.Item
                                style={{ background: '#fafafa', marginBottom: 8, borderRadius: 8, padding: '12px 16px' }}
                                actions={[
                                  <Popconfirm
                                    key="del"
                                    title="¿Eliminar este caso?"
                                    onConfirm={() => deleteCase.mutate(tc.id)}
                                    okText="Sí"
                                    cancelText="No"
                                    okButtonProps={{ danger: true }}
                                  >
                                    <Button size="small" danger icon={<DeleteOutlined />} />
                                  </Popconfirm>,
                                ]}
                              >
                                <List.Item.Meta
                                  title={<span style={{ fontWeight: 600 }}>{tc.title}</span>}
                                  description={
                                    <Space direction="vertical" style={{ width: '100%' }} size={4}>
                                      {tc.description && <Typography.Text type="secondary">{tc.description}</Typography.Text>}
                                      {tc.steps && (
                                        <div>
                                          <Typography.Text strong style={{ fontSize: 12 }}>Pasos:</Typography.Text>
                                          <pre style={{ margin: 0, fontSize: 12, whiteSpace: 'pre-wrap', color: '#555' }}>{tc.steps}</pre>
                                        </div>
                                      )}
                                      {tc.expected_result && (
                                        <div>
                                          <Typography.Text strong style={{ fontSize: 12 }}>Resultado esperado: </Typography.Text>
                                          <Typography.Text style={{ fontSize: 12 }}>{tc.expected_result}</Typography.Text>
                                        </div>
                                      )}
                                      <Space size={4} wrap>
                                        {tc.test_case_roles.map(r => {
                                          const role = roleMap[r.app_role_id]
                                          return role ? <Tag key={r.app_role_id} color={role.color}>{role.name}</Tag> : null
                                        })}
                                      </Space>
                                    </Space>
                                  }
                                />
                              </List.Item>
                            )}
                          />
                        ),
                      }
                    })}
                  />
                )}
              </>
            ),
          },
          {
            key: 'runs',
            label: `Test Runs (${runs.length})`,
            children: (
              <>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
                  <Button type="primary" icon={<PlayCircleOutlined />} onClick={() => setRunModal(true)}>
                    Nuevo Run
                  </Button>
                </div>
                {runs.length === 0 ? (
                  <Empty description="No hay runs aún. Creá el primero para empezar a testear." />
                ) : (
                  <List
                    dataSource={runs}
                    renderItem={run => {
                      const filterRole = run.role_filter_id ? roleMap[run.role_filter_id] : null
                      return (
                        <List.Item
                          actions={[
                            <Button
                              key="exec"
                              type="primary"
                              size="small"
                              icon={<PlayCircleOutlined />}
                              onClick={() => navigate(`/projects/${projectId}/run/${run.id}`)}
                            >
                              {run.status === 'completed' ? 'Ver reporte' : 'Ejecutar'}
                            </Button>,
                            <Popconfirm
                              key="del"
                              title="¿Eliminar este run?"
                              onConfirm={() => deleteRun.mutate(run.id)}
                              okText="Sí"
                              cancelText="No"
                            >
                              <Button size="small" icon={<DeleteOutlined />} danger />
                            </Popconfirm>,
                          ]}
                        >
                          <List.Item.Meta
                            title={
                              <Space>
                                {run.name}
                                <Badge
                                  status={run.status === 'completed' ? 'success' : 'processing'}
                                  text={run.status === 'completed' ? 'Completado' : 'En progreso'}
                                />
                              </Space>
                            }
                            description={
                              <Space>
                                <span>{new Date(run.created_at).toLocaleDateString('es-AR')}</span>
                                {filterRole && <Tag color={filterRole.color}>{filterRole.name}</Tag>}
                              </Space>
                            }
                          />
                        </List.Item>
                      )
                    }}
                  />
                )}
              </>
            ),
          },
        ]}
      />

      {/* Story modal */}
      <Modal title="Nueva historia de usuario" open={storyModal} onCancel={() => { setStoryModal(false); storyForm.resetFields() }} onOk={() => storyForm.submit()} confirmLoading={createStory.isPending} okText="Crear" cancelText="Cancelar">
        <Form form={storyForm} layout="vertical" onFinish={v => createStory.mutate(v)}>
          <Form.Item label="Título" name="title" rules={[{ required: true }]}>
            <Input placeholder="Ej: Gestión de caja" />
          </Form.Item>
          <Form.Item label="Descripción" name="description">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item label="Prioridad" name="priority" initialValue="medium">
            <Select options={[{ value: 'high', label: 'Alta' }, { value: 'medium', label: 'Media' }, { value: 'low', label: 'Baja' }]} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Case modal */}
      <Modal title="Nuevo caso de test" open={!!caseModal} onCancel={() => { setCaseModal(null); caseForm.resetFields() }} onOk={() => caseForm.submit()} confirmLoading={createCase.isPending} okText="Crear" cancelText="Cancelar" width={600}>
        <Form form={caseForm} layout="vertical" onFinish={v => createCase.mutate(v)}>
          <Form.Item label="Título" name="title" rules={[{ required: true }]}>
            <Input placeholder="Ej: Login con credenciales correctas" />
          </Form.Item>
          <Form.Item label="Descripción" name="description">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item label="Pasos" name="steps">
            <Input.TextArea rows={4} placeholder={"1. Ir a /login\n2. Ingresar email y contraseña\n3. Click en Ingresar"} />
          </Form.Item>
          <Form.Item label="Resultado esperado" name="expected_result">
            <Input.TextArea rows={2} placeholder="Ej: Redirige al dashboard" />
          </Form.Item>
          <Form.Item label="Roles" name="role_ids">
            <Select mode="multiple" placeholder="Seleccioná los roles" options={roles.map(r => ({ value: r.id, label: r.name }))} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Role modal */}
      <Modal title="Roles del sistema" open={roleModal} onCancel={() => { setRoleModal(false); roleForm.resetFields() }} footer={null} width={500}>
        <List
          dataSource={roles}
          locale={{ emptyText: 'Sin roles aún' }}
          renderItem={r => (
            <List.Item
              actions={[
                <Popconfirm
                  key="del"
                  title="¿Eliminar este rol?"
                  description="Se quitará de todos los casos asociados."
                  onConfirm={() => deleteRole.mutate(r.id)}
                  okText="Sí"
                  cancelText="No"
                  okButtonProps={{ danger: true }}
                >
                  <Button size="small" danger icon={<DeleteOutlined />} />
                </Popconfirm>,
              ]}
            >
              <Tag color={r.color} style={{ fontSize: 14 }}>{r.name}</Tag>
              {r.description && <Typography.Text type="secondary">{r.description}</Typography.Text>}
            </List.Item>
          )}
        />
        <Form form={roleForm} layout="inline" onFinish={v => createRole.mutate(v)} style={{ marginTop: 16 }}>
          <Form.Item name="color" initialValue={ROLE_COLORS[roles.length % ROLE_COLORS.length]}>
            <Input type="color" style={{ width: 48, padding: 2 }} />
          </Form.Item>
          <Form.Item name="name" rules={[{ required: true }]} style={{ flex: 1 }}>
            <Input placeholder="Nombre del rol (ej: Cajero)" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" icon={<PlusOutlined />} loading={createRole.isPending}>Agregar</Button>
          </Form.Item>
        </Form>
      </Modal>

      {/* Run modal */}
      <Modal title="Nuevo Test Run" open={runModal} onCancel={() => { setRunModal(false); runForm.resetFields() }} onOk={() => runForm.submit()} confirmLoading={createRun.isPending} okText="Crear y ejecutar" cancelText="Cancelar">
        <Form form={runForm} layout="vertical" onFinish={v => createRun.mutate(v)}>
          <Form.Item label="Nombre del run" name="name" rules={[{ required: true }]}>
            <Input placeholder="Ej: Sprint 12 - Regresión" />
          </Form.Item>
          <Form.Item label="Filtrar por rol (opcional)" name="role_filter_id">
            <Select allowClear placeholder="Todos los roles" options={roles.map(r => ({ value: r.id, label: r.name }))} />
          </Form.Item>
          <Form.Item name="skip_passed" valuePropName="checked" initialValue={true}>
            <Checkbox>Excluir casos que ya aprobaron en runs anteriores</Checkbox>
          </Form.Item>
          <Tooltip title="Si está marcado, los casos que ya tienen 'Pasó' en cualquier run anterior no se incluyen en este run.">
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              Sin filtro de rol = se incluyen todos los roles del proyecto.
            </Typography.Text>
          </Tooltip>
        </Form>
      </Modal>
    </>
  )
}
