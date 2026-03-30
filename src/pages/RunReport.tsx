import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Typography, Card, Row, Col, Table, Tag, Space, Button,
  Statistic, Progress, Select, Spin,
} from 'antd'
import { ArrowLeftOutlined, PlayCircleOutlined } from '@ant-design/icons'
import { useState } from 'react'
import { supabase } from '../lib/supabase'
import type { TestStatus } from '../lib/types'

type RunWithRole = {
  id: string; name: string; status: string; project_id: string
  role_filter_id: string | null; created_at: string; completed_at: string | null
  app_roles: { id: string; name: string; color: string } | null
}

async function fetchReport(projectId: string, runId: string) {
  const [run, results, cases, stories, roles, roleLinks] = await Promise.all([
    supabase.from('test_runs').select('*, app_roles(*)').eq('id', runId).single() as unknown as Promise<{ data: RunWithRole; error: unknown }>,
    supabase.from('test_results').select('*').eq('test_run_id', runId),
    supabase.from('test_cases').select('*').eq('project_id', projectId),
    supabase.from('user_stories').select('*').eq('project_id', projectId),
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

const STATUS_LABEL: Record<TestStatus, string> = {
  pending: 'Pendiente', pass: 'Pasó', fail: 'Falló', blocked: 'Bloqueado', skipped: 'Omitido',
}
const STATUS_COLOR: Record<TestStatus, string> = {
  pending: 'default', pass: 'success', fail: 'error', blocked: 'warning', skipped: 'default',
}

export default function RunReport() {
  const { projectId, runId } = useParams<{ projectId: string; runId: string }>()
  const navigate = useNavigate()
  const [filterStatus, setFilterStatus] = useState<string | null>(null)
  const [filterRole, setFilterRole] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['report', runId],
    queryFn: () => fetchReport(projectId!, runId!),
    enabled: !!runId && !!projectId,
  })

  if (isLoading) return <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>
  if (!data) return null

  const { run, results, cases, stories, roles, roleLinks } = data

  const caseMap = Object.fromEntries(cases.map(c => [c.id, c]))
  const storyMap = Object.fromEntries(stories.map(s => [s.id, s]))
  const roleMap = Object.fromEntries(roles.map(r => [r.id, r]))
  const caseRoles = roleLinks.reduce<Record<string, string[]>>((acc, l) => {
    acc[l.test_case_id] = [...(acc[l.test_case_id] ?? []), l.app_role_id]
    return acc
  }, {})

  const total = results.length
  const passed = results.filter(r => r.status === 'pass').length
  const failed = results.filter(r => r.status === 'fail').length
  const blocked = results.filter(r => r.status === 'blocked').length
  const skipped = results.filter(r => r.status === 'skipped').length
  const pending = results.filter(r => r.status === 'pending').length
  const passRate = total ? Math.round((passed / (total - pending)) * 100) || 0 : 0

  const tableData = results
    .filter(r => !filterStatus || r.status === filterStatus)
    .filter(r => {
      if (!filterRole) return true
      const tc = caseMap[r.test_case_id]
      return tc ? (caseRoles[tc.id] ?? []).includes(filterRole) : false
    })
    .map(r => {
      const tc = caseMap[r.test_case_id]
      const story = tc ? storyMap[tc.user_story_id] : null
      return { ...r, tc, story }
    })

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(`/projects/${projectId}`)}>Volver</Button>
        <Typography.Title level={3} style={{ margin: 0, flex: 1 }}>
          Reporte: {run.name}
        </Typography.Title>
        {run.status !== 'completed' && (
          <Button type="primary" icon={<PlayCircleOutlined />} onClick={() => navigate(`/projects/${projectId}/run/${runId}`)}>
            Continuar ejecución
          </Button>
        )}
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic title="Pasaron" value={passed} valueStyle={{ color: '#52c41a' }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic title="Fallaron" value={failed} valueStyle={{ color: '#ff4d4f' }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic title="Bloqueados" value={blocked} valueStyle={{ color: '#fa8c16' }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic title="Omitidos / Pendientes" value={`${skipped} / ${pending}`} />
          </Card>
        </Col>
      </Row>

      <Card style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
          <div>
            <Typography.Text type="secondary">Pass rate (sobre ejecutados)</Typography.Text>
            <Typography.Title level={2} style={{ margin: 0, color: passRate >= 80 ? '#52c41a' : passRate >= 50 ? '#fa8c16' : '#ff4d4f' }}>
              {passRate}%
            </Typography.Title>
          </div>
          <Progress
            type="circle"
            percent={passRate}
            strokeColor={passRate >= 80 ? '#52c41a' : passRate >= 50 ? '#fa8c16' : '#ff4d4f'}
            size={80}
          />
          <div style={{ flex: 1 }}>
            <Progress
              percent={Math.round((passed / total) * 100)}
              success={{ percent: 0 }}
              strokeColor="#52c41a"
              format={() => `${passed} pasaron`}
            />
            <Progress percent={Math.round(((passed + failed) / total) * 100)} strokeColor="#ff4d4f" format={() => `${failed} fallaron`} style={{ marginTop: 8 }} />
          </div>
        </div>
      </Card>

      <Card>
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
          <Select
            allowClear
            placeholder="Filtrar por estado"
            style={{ minWidth: 160 }}
            onChange={v => setFilterStatus(v ?? null)}
            options={Object.entries(STATUS_LABEL).map(([v, l]) => ({ value: v, label: l }))}
          />
          <Select
            allowClear
            placeholder="Filtrar por rol"
            style={{ minWidth: 160 }}
            onChange={v => setFilterRole(v ?? null)}
            options={roles.map(r => ({ value: r.id, label: r.name }))}
          />
        </div>

        <Table
          dataSource={tableData}
          rowKey="id"
          size="small"
          pagination={{ pageSize: 20 }}
          columns={[
            {
              title: 'Historia',
              dataIndex: ['story', 'title'],
              width: 180,
              ellipsis: true,
            },
            {
              title: 'Caso de test',
              dataIndex: ['tc', 'title'],
              ellipsis: true,
            },
            {
              title: 'Roles',
              width: 180,
              render: (_, row) => (
                <Space size={4} wrap>
                  {(caseRoles[row.test_case_id] ?? []).map(rid => {
                    const role = roleMap[rid]
                    return role ? <Tag key={rid} color={role.color} style={{ fontSize: 11 }}>{role.name}</Tag> : null
                  })}
                </Space>
              ),
            },
            {
              title: 'Estado',
              dataIndex: 'status',
              width: 110,
              render: (s: TestStatus) => <Tag color={STATUS_COLOR[s]}>{STATUS_LABEL[s]}</Tag>,
            },
            {
              title: 'Comentario',
              dataIndex: 'comment',
              ellipsis: true,
              render: (c: string | null) => c || <Typography.Text type="secondary">—</Typography.Text>,
            },
          ]}
        />
      </Card>
    </>
  )
}
