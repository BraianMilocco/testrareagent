import { useState } from 'react'
import { Card, Form, Input, Button, Typography, Alert, Space } from 'antd'
import { BugOutlined } from '@ant-design/icons'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onFinish = async ({ email, password }: { email: string; password: string }) => {
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    setLoading(false)
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f2f5' }}>
      <Card style={{ width: 380, boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
        <Space direction="vertical" style={{ width: '100%', marginBottom: 24 }} align="center">
          <BugOutlined style={{ fontSize: 40, color: '#4f46e5' }} />
          <Typography.Title level={3} style={{ margin: 0 }}>Test Manager</Typography.Title>
          <Typography.Text type="secondary">Ingresá con tu cuenta</Typography.Text>
        </Space>
        {error && <Alert message={error} type="error" showIcon style={{ marginBottom: 16 }} />}
        <Form layout="vertical" onFinish={onFinish}>
          <Form.Item label="Email" name="email" rules={[{ required: true, type: 'email' }]}>
            <Input size="large" autoComplete="email" />
          </Form.Item>
          <Form.Item label="Contraseña" name="password" rules={[{ required: true }]}>
            <Input.Password size="large" autoComplete="current-password" />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0 }}>
            <Button type="primary" htmlType="submit" size="large" block loading={loading}>
              Ingresar
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  )
}
