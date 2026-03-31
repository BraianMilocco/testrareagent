import { useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Typography, Progress, Button, Tag, Space, Card, Input,
  Spin, Badge, Collapse, Modal, message,
} from 'antd'
import {
  CheckCircleFilled, CloseCircleFilled, MinusCircleFilled,
  StopFilled, BarChartOutlined, ArrowLeftOutlined,
} from '@ant-design/icons'
import { supabase } from '../lib/supabase'
import type { TestStatus } from '../lib/types'

type RunWithRole = {
  id: string; name: string; status: string; project_id: string
  role_filter_id: string | null; created_at: string; completed_at: string | null
  app_roles: { id: string; name: string; color: string } | null
}

async function fetchRunData(projectId: string, runId: string) {
  const [run, results, cases, stories, roles, roleLinks] = await Promise.all([
    supabase.from('test_runs').select('*, app_roles(*)').eq('id', runId).single() as unknown as Promise<{ data: RunWithRole; error: unknown }>,
    supabase.from('test_results').select('*').eq('test_run_id', runId),
    supabase.from('test_cases').select('*').eq('project_id', projectId).order('order'),
    supabase.from('user_stories').select('*').eq('project_id', projectId).order('order'),
    supabase.from('app_roles').select('*').eq('project_id', projectId),
    supabase.from('test_case_roles').select('*'),
  ])
  if (run.error) throw run.error as Error
  return {
    run: run.data,
    results: results.data ?? [],
    cases: cases.data ?? [],
    stories: stories.data ?? [],
    roles: roles.data ?? [],
    roleLinks: roleLinks.data ?? [],
  }
}

const STATUS_CONFIG: Record<TestStatus, { label: string; color: string; icon: React.ReactNode }> = {
  pending: { label: 'Pendiente', color: 'default', icon: null },
  pass: { label: 'Pasó', color: '#52c41a', icon: <CheckCircleFilled style={{ color: '#52c41a' }} /> },
  fail: { label: 'Falló', color: '#ff4d4f', icon: <CloseCircleFilled style={{ color: '#ff4d4f' }} /> },
  blocked: { label: 'Bloqueado', color: '#fa8c16', icon: <StopFilled style={{ color: '#fa8c16' }} /> },
  skipped: { label: 'Omitido', color: '#8c8c8c', icon: <MinusCircleFilled style={{ color: '#8c8c8c' }} /> },
}

export default function RunExecution() {
  const { projectId, runId } = useParams<{ projectId: string; runId: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [comments, setComments] = useState<Record<string, string>>({})
  const [savingComment, setSavingComment] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['run', runId],
    queryFn: () => fetchRunData(projectId!, runId!),
    enabled: !!runId && !!projectId,
  })

  const updateResult = useMutation({
    mutationFn: async ({ resultId, status, comment }: { resultId: string; status: TestStatus; comment?: string }) => {
      const { error } = await supabase
        .from('test_results')
        .update({ status, comment: comment ?? null, updated_at: new Date().toISOString() })
        .eq('id', resultId)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['run', runId] }),
  })

  const completeRun = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('test_runs')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', runId!)
      if (error) throw error
    },
    onSuccess: () => navigate(`/projects/${projectId}/run/${runId}/report`),
  })

  const saveComment = useCallback(async (resultId: string) => {
    setSavingComment(resultId)
    const comment = comments[resultId] ?? ''
    await supabase.from('test_results').update({ comment, updated_at: new Date().toISOString() }).eq('id', resultId)
    setSavingComment(null)
    message.success('Comentario guardado')
  }, [comments])

  if (isLoading) return <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>
  if (!data) return null

  const { run, results, cases, stories, roles, roleLinks } = data

  const resultMap = Object.fromEntries(results.map(r => [r.test_case_id, r]))
  const roleMap = Object.fromEntries(roles.map(r => [r.id, r]))
  const caseRoles = roleLinks.reduce<Record<string, string[]>>((acc, l) => {
    acc[l.test_case_id] = [...(acc[l.test_case_id] ?? []), l.app_role_id]
    return acc
  }, {})

  // Only cases that have a result in this run
  const runCaseIds = new Set(results.map(r => r.test_case_id))
  const runCases = cases.filter(c => runCaseIds.has(c.id))

  const total = results.length
  const done = results.filter(r => r.status !== 'pending').length
  const passed = results.filter(r => r.status === 'pass').length
  const failed = results.filter(r => r.status === 'fail').length
  const percent = total ? Math.round((done / total) * 100) : 0

  const confirmComplete = () => {
    const pending = results.filter(r => r.status === 'pending').length
    if (pending > 0) {
      Modal.confirm({
        title: `Quedan ${pending} casos pendientes`,
        content: '¿Querés completar el run de todas formas?',
        okText: 'Sí, completar',
        cancelText: 'Cancelar',
        onOk: () => completeRun.mutate(),
      })
    } else {
      completeRun.mutate()
    }
  }

  return (
    <>
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(`/projects/${projectId}`)}>Volver</Button>
        <Typography.Title level={3} style={{ margin: 0, flex: 1 }}>{run.name}</Typography.Title>
        <Button icon={<BarChartOutlined />} onClick={() => navigate(`/projects/${projectId}/run/${runId}/report`)}>
          Ver reporte
        </Button>
        {run.status !== 'completed' && (
          <Button type="primary" onClick={confirmComplete} loading={completeRun.isPending}>
            Completar run
          </Button>
        )}
      </div>

      <Card style={{ marginBottom: 20 }}>
        <Space style={{ width: '100%', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <Space size="large">
            <span><Badge color="#52c41a" /> Pasaron: <strong>{passed}</strong></span>
            <span><Badge color="#ff4d4f" /> Fallaron: <strong>{failed}</strong></span>
            <span><Badge color="#d9d9d9" /> Pendientes: <strong>{total - done}</strong></span>
            <span>Total: <strong>{total}</strong></span>
          </Space>
          {run.role_filter_id && <Tag color={run.app_roles?.color}>{run.app_roles?.name}</Tag>}
        </Space>
        <Progress percent={percent} strokeColor={{ '0%': '#4f46e5', '100%': '#52c41a' }} style={{ marginTop: 12 }} />
      </Card>

      <Collapse
        defaultActiveKey={stories.map(s => s.id)}
        items={stories.flatMap(story => {
          const storyCases = runCases.filter(c => c.user_story_id === story.id)
          if (!storyCases.length) return []
          const storyDone = storyCases.filter(c => resultMap[c.id]?.status !== 'pending').length

          return {
            key: story.id,
            label: (
              <Space>
                <strong>{story.title}</strong>
                <Tag>{storyDone}/{storyCases.length} completados</Tag>
              </Space>
            ),
            children: (
              <Space direction="vertical" style={{ width: '100%' }} size={12}>
                {storyCases.map(tc => {
                  const result = resultMap[tc.id]
                  if (!result) return null
                  const status = result.status as TestStatus
                  const conf = STATUS_CONFIG[status]
                  const localComment = comments[result.id] ?? result.comment ?? ''

                  return (
                    <Card
                      key={tc.id}
                      size="small"
                      style={{
                        borderLeft: `4px solid ${status === 'pending' ? '#d9d9d9' : conf.color}`,
                        background: status === 'pass' ? '#f6ffed' : status === 'fail' ? '#fff2f0' : '#fff',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                        <div style={{ flex: 1 }}>
                          <Space align="center" style={{ marginBottom: 4 }}>
                            {conf.icon}
                            <Typography.Text strong>{tc.title}</Typography.Text>
                          </Space>
                          {tc.description && <Typography.Text type="secondary" style={{ display: 'block', fontSize: 13 }}>{tc.description}</Typography.Text>}
                          {tc.steps && (
                            <div style={{ marginTop: 6 }}>
                              <Typography.Text type="secondary" style={{ fontSize: 12, fontWeight: 600 }}>Pasos:</Typography.Text>
                              <pre style={{ margin: '2px 0 0', fontSize: 12, whiteSpace: 'pre-wrap', color: '#555', lineHeight: 1.5 }}>{tc.steps}</pre>
                            </div>
                          )}
                          {tc.expected_result && (
                            <div style={{ marginTop: 4 }}>
                              <Typography.Text type="secondary" style={{ fontSize: 12, fontWeight: 600 }}>Esperado: </Typography.Text>
                              <Typography.Text style={{ fontSize: 12 }}>{tc.expected_result}</Typography.Text>
                            </div>
                          )}
                          <Space size={4} wrap style={{ marginTop: 6 }}>
                            {(caseRoles[tc.id] ?? []).map(rid => {
                              const role = roleMap[rid]
                              return role ? <Tag key={rid} color={role.color} style={{ fontSize: 11 }}>{role.name}</Tag> : null
                            })}
                          </Space>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 260 }}>
                          <Space wrap>
                            {(['pass', 'fail', 'blocked', 'skipped'] as TestStatus[]).map(s => {
                              const sc = STATUS_CONFIG[s]
                              return (
                                <Button
                                  key={s}
                                  size="middle"
                                  type={status === s ? 'primary' : 'default'}
                                  style={status === s ? { background: sc.color, borderColor: sc.color } : {}}
                                  onClick={() => updateResult.mutate({ resultId: result.id, status: s, comment: localComment })}
                                >
                                  {sc.label}
                                </Button>
                              )
                            })}
                          </Space>
                          <div>
                            <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
                              Notas / observaciones
                            </Typography.Text>
                            <Input.TextArea
                              placeholder="Describí el problema, el comportamiento observado, pasos para reproducirlo..."
                              value={localComment}
                              onChange={e => setComments(prev => ({ ...prev, [result.id]: e.target.value }))}
                              rows={4}
                              style={{ fontSize: 13, resize: 'vertical' }}
                            />
                          </div>
                          {comments[result.id] !== undefined && comments[result.id] !== (result.comment ?? '') && (
                            <Button
                              size="small"
                              loading={savingComment === result.id}
                              onClick={() => saveComment(result.id)}
                              style={{ alignSelf: 'flex-end' }}
                            >
                              Guardar nota
                            </Button>
                          )}
                        </div>
                      </div>
                    </Card>
                  )
                })}
              </Space>
            ),
          }
        })}
      />
    </>
  )
}
