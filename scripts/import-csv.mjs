/**
 * CSV Import Script — Test Manager
 *
 * Usage:
 *   node scripts/import-csv.mjs <project_id> <csv_file>
 *
 * CSV format (first row = headers):
 *   user_story,title,description,steps,expected_result,roles
 *
 * - user_story: nombre de la historia (se crea si no existe)
 * - title: título del caso de test (requerido)
 * - description: descripción opcional
 * - steps: pasos separados por \n (usar \n literal en el CSV)
 * - expected_result: resultado esperado
 * - roles: roles separados por coma, ej: "Cajero,Supervisor" (se crean si no existen)
 *
 * Example CSV row:
 *   "Login","Login exitoso","Usuario puede ingresar","1. Ir a /login\n2. Ingresar credenciales","Redirige al dashboard","Cajero,Admin"
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// ── Config ────────────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://eymcnzvqsegsoooznsen.supabase.co'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY // needs service role key for bypassing RLS

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌  Falta SUPABASE_SERVICE_KEY en las variables de entorno.')
  console.error('   Exportala así: export SUPABASE_SERVICE_KEY=tu_service_role_key')
  process.exit(1)
}

const [, , projectId, csvPath] = process.argv
if (!projectId || !csvPath) {
  console.error('❌  Uso: node scripts/import-csv.mjs <project_id> <csv_file>')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// ── CSV Parser ────────────────────────────────────────────────────────────────
function parseCSV(content) {
  const lines = content.trim().split('\n')
  const headers = parseCSVLine(lines[0])
  return lines.slice(1).filter(l => l.trim()).map(line => {
    const values = parseCSVLine(line)
    return Object.fromEntries(headers.map((h, i) => [h.trim(), (values[i] ?? '').trim()]))
  })
}

function parseCSVLine(line) {
  const result = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"' && !inQuotes) { inQuotes = true; continue }
    if (ch === '"' && inQuotes && line[i + 1] === '"') { current += '"'; i++; continue }
    if (ch === '"' && inQuotes) { inQuotes = false; continue }
    if (ch === ',' && !inQuotes) { result.push(current); current = ''; continue }
    current += ch
  }
  result.push(current)
  return result
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n📂 Importando CSV: ${csvPath}`)
  console.log(`📁 Proyecto: ${projectId}\n`)

  // Verify project exists
  const { data: project, error: projErr } = await supabase.from('projects').select('id, name').eq('id', projectId).single()
  if (projErr || !project) {
    console.error('❌  Proyecto no encontrado:', projectId)
    process.exit(1)
  }
  console.log(`✅ Proyecto: ${project.name}`)

  const content = readFileSync(resolve(csvPath), 'utf-8')
  const rows = parseCSV(content)
  console.log(`📋 Filas encontradas: ${rows.length}\n`)

  // Cache to avoid duplicate inserts
  const storyCache = {}
  const roleCache = {}

  // Load existing stories and roles
  const { data: existingStories } = await supabase.from('user_stories').select('id, title').eq('project_id', projectId)
  const { data: existingRoles } = await supabase.from('app_roles').select('id, name').eq('project_id', projectId)

  existingStories?.forEach(s => { storyCache[s.title.toLowerCase()] = s.id })
  existingRoles?.forEach(r => { roleCache[r.name.toLowerCase()] = r.id })

  const ROLE_COLORS = ['#4f46e5', '#0891b2', '#059669', '#d97706', '#dc2626', '#7c3aed', '#db2777']
  let colorIdx = existingRoles?.length ?? 0

  let imported = 0
  let skipped = 0
  let storyOrder = existingStories?.length ?? 0

  for (const [i, row] of rows.entries()) {
    const rowNum = i + 2
    const { user_story, title, description, steps, expected_result, roles } = row

    if (!title) {
      console.warn(`⚠️  Fila ${rowNum}: sin título, se omite.`)
      skipped++
      continue
    }

    // Get or create user story
    const storyKey = (user_story || 'Sin historia').toLowerCase()
    let storyId = storyCache[storyKey]

    if (!storyId) {
      const { data, error } = await supabase
        .from('user_stories')
        .insert({ project_id: projectId, title: user_story || 'Sin historia', order: storyOrder++ })
        .select('id')
        .single()
      if (error) { console.error(`❌  Fila ${rowNum}: error creando historia:`, error.message); skipped++; continue }
      storyId = data.id
      storyCache[storyKey] = storyId
      console.log(`  📖 Historia creada: "${user_story}"`)
    }

    // Get or create roles
    const roleNames = roles ? roles.split(',').map(r => r.trim()).filter(Boolean) : []
    const roleIds = []
    for (const roleName of roleNames) {
      const roleKey = roleName.toLowerCase()
      let roleId = roleCache[roleKey]
      if (!roleId) {
        const { data, error } = await supabase
          .from('app_roles')
          .insert({ project_id: projectId, name: roleName, color: ROLE_COLORS[colorIdx % ROLE_COLORS.length] })
          .select('id')
          .single()
        if (error) { console.warn(`⚠️  Fila ${rowNum}: error creando rol "${roleName}":`, error.message); continue }
        roleId = data.id
        roleCache[roleKey] = roleId
        colorIdx++
        console.log(`  🏷️  Rol creado: "${roleName}"`)
      }
      roleIds.push(roleId)
    }

    // Create test case
    const stepsFormatted = steps ? steps.replace(/\\n/g, '\n') : null
    const { data: tc, error: tcErr } = await supabase
      .from('test_cases')
      .insert({
        project_id: projectId,
        user_story_id: storyId,
        title,
        description: description || null,
        steps: stepsFormatted,
        expected_result: expected_result || null,
        order: i,
      })
      .select('id')
      .single()

    if (tcErr) { console.error(`❌  Fila ${rowNum}: error creando caso "${title}":`, tcErr.message); skipped++; continue }

    // Link roles
    if (roleIds.length) {
      await supabase.from('test_case_roles').insert(roleIds.map(rid => ({ test_case_id: tc.id, app_role_id: rid })))
    }

    console.log(`  ✅ [${rowNum}] ${title}`)
    imported++
  }

  console.log(`\n🎉 Importación completada: ${imported} casos importados, ${skipped} omitidos.\n`)
}

main().catch(err => { console.error('Error fatal:', err); process.exit(1) })
