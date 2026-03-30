import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { Layout, Menu, Button, Typography, Space, Spin } from 'antd'
import { FolderOutlined, LogoutOutlined, BugOutlined, AppstoreOutlined } from '@ant-design/icons'
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

  // Derive selected keys from current path
  const projectIdMatch = location.pathname.match(/\/projects\/([^/]+)/)
  const currentProjectId = projectIdMatch?.[1]
  const selectedKeys = currentProjectId ? [`project-${currentProjectId}`] : ['all-projects']
  const openKeys = currentProjectId ? ['projects-group'] : []

  const menuItems = [
    {
      key: 'all-projects',
      icon: <AppstoreOutlined />,
      label: 'Todos los proyectos',
      onClick: () => navigate('/projects'),
    },
    {
      key: 'projects-group',
      icon: <FolderOutlined />,
      label: 'Proyectos',
      children: isLoading
        ? [{ key: 'loading', label: <Spin size="small" />, disabled: true }]
        : !projects?.length
          ? [{ key: 'empty', label: <span style={{ opacity: 0.5, fontSize: 12 }}>Sin proyectos</span>, disabled: true }]
          : projects.map(p => ({
              key: `project-${p.id}`,
              label: (
                <span style={{ fontSize: 13 }} title={p.name}>
                  {p.name.length > 20 ? `${p.name.slice(0, 20)}…` : p.name}
                </span>
              ),
              onClick: () => navigate(`/projects/${p.id}`),
            })),
    },
  ]

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        width={230}
        style={{ background: '#1e1b4b' }}
        breakpoint="lg"
        collapsedWidth="0"
      >
        <div style={{ padding: '20px 16px 16px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <Space>
            <BugOutlined style={{ color: '#a5b4fc', fontSize: 20 }} />
            <Typography.Text strong style={{ color: '#fff', fontSize: 16 }}>
              Test Manager
            </Typography.Text>
          </Space>
        </div>
        <Menu
          mode="inline"
          selectedKeys={selectedKeys}
          defaultOpenKeys={['projects-group']}
          style={{ background: 'transparent', border: 'none', marginTop: 8 }}
          theme="dark"
          items={menuItems}
        />
      </Sider>
      <Layout>
        <Header style={{ background: '#fff', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', borderBottom: '1px solid #f0f0f0' }}>
          <Button
            icon={<LogoutOutlined />}
            type="text"
            onClick={() => supabase.auth.signOut()}
          >
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
