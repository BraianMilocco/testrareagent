import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { Layout, Menu, Button, Typography, Space, Spin } from 'antd'
import { LogoutOutlined, BugOutlined, BarChartOutlined, FileTextOutlined, PlayCircleOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Project } from '../lib/types'

const { Header, Content, Sider } = Layout

async function fetchProjects(): Promise<Project[]> {
  const { data, error } = await supabase.from('projects').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export default function AppLayout() {
  const navigate = useNavigate()
  const location = useLocation()

  const { data: projects, isLoading } = useQuery({ queryKey: ['projects'], queryFn: fetchProjects })

  // Derive active keys from URL
  const projectIdMatch = location.pathname.match(/\/projects\/([^/]+)/)
  const currentProjectId = projectIdMatch?.[1]
  const isRunPath = location.pathname.includes('/run/')
  const tabParam = new URLSearchParams(location.search).get('tab')

  let selectedKeys: string[] = ['reports']
  if (location.pathname === '/projects') selectedKeys = ['all-projects']
  else if (currentProjectId) {
    if (isRunPath || tabParam === 'runs') selectedKeys = [`p-${currentProjectId}-runs`]
    else selectedKeys = [`p-${currentProjectId}-cases`]
  }

  const openKeys = currentProjectId ? [`p-${currentProjectId}`] : []

  const projectChildren = isLoading
    ? [{ key: 'loading', label: <Spin size="small" />, disabled: true }]
    : !projects?.length
      ? [{ key: 'empty', label: <span style={{ opacity: 0.5, fontSize: 12 }}>Sin proyectos</span>, disabled: true }]
      : projects.map(p => ({
          key: `p-${p.id}`,
          label: <span title={p.name}>{p.name.length > 18 ? `${p.name.slice(0, 18)}…` : p.name}</span>,
          children: [
            {
              key: `p-${p.id}-cases`,
              icon: <FileTextOutlined />,
              label: 'Casos de test',
              onClick: () => navigate(`/projects/${p.id}?tab=cases`),
            },
            {
              key: `p-${p.id}-runs`,
              icon: <PlayCircleOutlined />,
              label: 'Test Runs',
              onClick: () => navigate(`/projects/${p.id}?tab=runs`),
            },
          ],
        }))

  const menuItems = [
    {
      key: 'reports',
      icon: <BarChartOutlined />,
      label: 'Reportes globales',
      onClick: () => navigate('/reports'),
    },
    { type: 'divider' as const },
    {
      type: 'group' as const,
      label: <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, opacity: 0.5 }}>Proyectos</span>,
      children: projectChildren,
    },
  ]

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        width={240}
        style={{ background: '#1e1b4b' }}
        breakpoint="lg"
        collapsedWidth="0"
      >
        <div
          style={{ padding: '20px 16px 16px', borderBottom: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer' }}
          onClick={() => navigate('/projects')}
        >
          <Space>
            <BugOutlined style={{ color: '#a5b4fc', fontSize: 20 }} />
            <Typography.Text strong style={{ color: '#fff', fontSize: 16 }}>Test Manager</Typography.Text>
          </Space>
        </div>
        <Menu
          mode="inline"
          selectedKeys={selectedKeys}
          defaultOpenKeys={openKeys}
          style={{ background: 'transparent', border: 'none', marginTop: 8 }}
          theme="dark"
          items={menuItems}
        />
      </Sider>
      <Layout>
        <Header style={{ background: '#fff', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', borderBottom: '1px solid #f0f0f0' }}>
          <Button icon={<LogoutOutlined />} type="text" onClick={() => supabase.auth.signOut()}>
            Salir
          </Button>
        </Header>
        <Content style={{ padding: 24, background: '#f5f5f5' }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  )
}
