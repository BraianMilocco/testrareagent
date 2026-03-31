import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Typography, Card, Table, Tag, Select, Space, Button,
  Statistic, Row, Col, Progress, Spin, Empty,
} from 'antd'
import { BarChartOutlined, ArrowRightOutlined } from '@ant-design/icons'
import { supabase } from '../lib/supabase'
import type { TestStatus } from '../lib/types'

async function fetchAllReports() {
  const [projects, runs, results, roles] = await Promise.all([
    supabase.from('projects').select('id, name').order('name'),
    supabase.from('test_runs').select('*').order('created_at', { ascending: false }),
    supabase.from('test_results').select('test_run_id, status'),
    supabase.from('app_roles').select('id, name, color, project_id'),
  ])
  return {
    projects: projects.data ?? [],
    runs: runs.data ?? [],
    results: results.data ?? [],
    roles: roles.data ?? [],
  }
}

const STATUS_COLOR: Record<TestStatus, string> = {
  pass: '#52c41a', fail: '#ff4d4f', blocked: '#fa8c16', skipped: '#8c8c8c', pending: '#d9d9d9',
}

export default function Reports() {
  const navigate = useNavigate()
  const [filterProject, setFilterProject] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<string | null>(null)

  const { data, isLoading } = useQuery({ queryKey: ['all-reports'], queryFn: fetchAllReports })

  if (isLoading) return <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>
  if (!data) return null

  const { projects, runs, results, roles } = data
  const projectMap = Object.fromEntries(projects.map(p => [p.id, p.name]))
  const roleMap = Object.fromEntries(roles.map(r => [r.id, r]))

  // Aggregate result counts per run
  const runStats: Record<string, Record<string, number>> = {}
  for (const r of results) {
    if (!runStats[r.test_run_id]) runStats[r.test_run_id] = { pass: 0, fail: 0, blocked: 0, skipped: 0, pending: 0, total: 0 }
    runStats[r.test_run_id][r.status] = (runStats[r.test_run_id][r.status] ?? 0) + 1
    runStats[r.test_run_id].total++
  }

  // Global summary
  const totalRuns = runs.length
  const totalExecuted = results.filter(r => r.status !== 'pending').length
  const totalPassed = results.filter(r => r.status === 'pass').length
  const globalPassRate = totalExecuted ? Math.round((totalPassed / totalExecuted) * 100) : 0

  // Filtered runs
  const filteredRuns = runs.filter(r => {
    if (filterProject && r.project_id !== filterProject) return false
    if (filterStatus && r.status !== filterStatus) return false
    return true
  })

  const tableData = filteredRuns.map(run => {
    const stats = runStats[run.id] ?? { pass: 0, fail: 0, blocked: 0, skipped: 0, pending: 0, total: 0 }
    const executed = stats.total - stats.pending
    const passRate = executed ? Math.round((stats.pass / executed) * 100) : 0
    const role = run.role_filter_id ? roleMap[run.role_filter_id] : null
    return { ...run, stats, passRate, role, projectName: projectMap[run.project_id] ?? '—' }
  })

  return (
    <>
      <div style={{ marginBottom: 24 }}>
        <Typography.Title level={3} style={{ margin: 0 }}>
          <BarChartOutlined style={{ marginRight: 8, color: '#4f46e5' }} />
          Reportes globales
        </Typography.Title>
        <Typography.Text type="secondary">Historial de todos los test runs en todos los proyectos</Typography.Text>
      </div>

      {/* Summary stats */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic title="Total de runs" value={totalRuns} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="Runs completados"
              value={runs.filter(r => r.status === 'completed').length}
              suffix={`/ ${totalRuns}`}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic title="Casos ejecutados" value={totalExecuted} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="Pass rate global"
              value={globalPassRate}
              suffix="%"
              valueStyle={{ color: globalPassRate >= 80 ? '#52c41a' : globalPassRate >= 50 ? '#fa8c16' : '#ff4d4f' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Filters */}
      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          <Select
            allowClear
            placeholder="Filtrar por proyecto"
            style={{ minWidth: 200 }}
            onChange={v => setFilterProject(v ?? null)}
            options={projects.map(p => ({ value: p.id, label: p.name }))}
          />
          <Select
            allowClear
            placeholder="Filtrar por estado"
            style={{ minWidth: 180 }}
            onChange={v => setFilterStatus(v ?? null)}
            options={[
              { value: 'in_progress', label: 'En progreso' },
              { value: 'completed', label: 'Completado' },
            ]}
          />
          <Typography.Text type="secondary">{filteredRuns.length} runs encontrados</Typography.Text>
        </Space>
      </Card>

      {/* Table */}
      {filteredRuns.length === 0 ? (
        <Empty description="No hay runs que coincidan con los filtros" />
      ) : (
        <Card>
          <Table
            dataSource={tableData}
            rowKey="id"
            size="small"
            pagination={{ pageSize: 15, showSizeChanger: false }}
            columns={[
              {
                title: 'Proyecto',
                dataIndex: 'projectName',
                width: 160,
                ellipsis: true,
                render: (name: string) => <Typography.Text strong>{name}</Typography.Text>,
              },
              {
                title: 'Run',
                dataIndex: 'name',
                ellipsis: true,
              },
              {
                title: 'Fecha',
                dataIndex: 'created_at',
                width: 110,
                render: (d: string) => new Date(d).toLocaleDateString('es-AR'),
                sorter: (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
                defaultSortOrder: 'ascend',
              },
              {
                title: 'Rol',
                width: 110,
                render: (_, row) => row.role
                  ? <Tag color={row.role.color}>{row.role.name}</Tag>
                  : <Typography.Text type="secondary" style={{ fontSize: 12 }}>Todos</Typography.Text>,
              },
              {
                title: 'Resultados',
                width: 260,
                render: (_, row) => {
                  const { stats } = row
                  if (!stats.total) return <Typography.Text type="secondary">Sin casos</Typography.Text>
                  return (
                    <Space size={4} wrap>
                      {stats.pass > 0 && <Tag color="success">✓ {stats.pass}</Tag>}
                      {stats.fail > 0 && <Tag color="error">✗ {stats.fail}</Tag>}
                      {stats.blocked > 0 && <Tag color="warning">⊘ {stats.blocked}</Tag>}
                      {stats.skipped > 0 && <Tag color="default">— {stats.skipped}</Tag>}
                      {stats.pending > 0 && <Tag color="default">● {stats.pending} pend.</Tag>}
                    </Space>
                  )
                },
              },
              {
                title: 'Pass rate',
                width: 130,
                render: (_, row) => {
                  if (!row.stats.total) return '—'
                  const executed = row.stats.total - row.stats.pending
                  if (!executed) return <Typography.Text type="secondary">Sin ejecutar</Typography.Text>
                  const color = row.passRate >= 80 ? '#52c41a' : row.passRate >= 50 ? '#fa8c16' : '#ff4d4f'
                  return (
                    <Space direction="vertical" size={2} style={{ width: '100%' }}>
                      <Typography.Text strong style={{ color }}>{row.passRate}%</Typography.Text>
                      <Progress
                        percent={row.passRate}
                        strokeColor={color}
                        showInfo={false}
                        size="small"
                        style={{ margin: 0 }}
                      />
                    </Space>
                  )
                },
                sorter: (a, b) => a.passRate - b.passRate,
              },
              {
                title: 'Estado',
                dataIndex: 'status',
                width: 120,
                render: (s: string) => (
                  <Tag color={s === 'completed' ? 'success' : 'processing'}>
                    {s === 'completed' ? 'Completado' : 'En progreso'}
                  </Tag>
                ),
              },
              {
                title: '',
                width: 60,
                render: (_, row) => (
                  <Button
                    type="text"
                    icon={<ArrowRightOutlined />}
                    onClick={() => navigate(`/projects/${row.project_id}/run/${row.id}/report`)}
                  />
                ),
              },
            ]}
          />
        </Card>
      )}
    </>
  )
}
