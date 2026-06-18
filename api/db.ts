import initSqlJs from 'sql.js'
import path from 'path'
import fs from 'fs'

const SQL = await initSqlJs({
  locateFile: (file: string) =>
    path.join(process.cwd(), 'node_modules', 'sql.js', 'dist', file),
})

const DB_DIR = path.join(process.cwd(), 'data')
const DB_PATH = path.join(DB_DIR, 'sample.db')

let db: InstanceType<typeof SQL.Database>

if (fs.existsSync(DB_PATH)) {
  const buffer = fs.readFileSync(DB_PATH)
  db = new SQL.Database(buffer)
} else {
  db = new SQL.Database()
}

db.run(`
  CREATE TABLE IF NOT EXISTS samples (
    id TEXT PRIMARY KEY,
    sample_code TEXT NOT NULL UNIQUE,
    source TEXT NOT NULL CHECK(source IN ('执法扣留','检验抽样','抽查取样')),
    case_no TEXT NOT NULL,
    seal_no TEXT NOT NULL,
    item_name TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    spec TEXT DEFAULT '',
    retention_days INTEGER NOT NULL DEFAULT 90,
    retention_start TEXT NOT NULL,
    retention_end TEXT NOT NULL,
    is_involved INTEGER NOT NULL DEFAULT 0,
    disposal_doc_no TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT '待入库' CHECK(status IN ('待入库','在库','待检测','检测中','已检测','待处置','处置中','已处置','超期')),
    warehouse_id TEXT DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    created_by TEXT NOT NULL DEFAULT 'system'
  )
`)

db.run(`
  CREATE TABLE IF NOT EXISTS test_results (
    id TEXT PRIMARY KEY,
    sample_id TEXT NOT NULL,
    conclusion TEXT NOT NULL CHECK(conclusion IN ('合格','不合格','需复检')),
    test_date TEXT NOT NULL,
    tester TEXT NOT NULL,
    report_file TEXT DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (sample_id) REFERENCES samples(id)
  )
`)

db.run(`
  CREATE TABLE IF NOT EXISTS disposals (
    id TEXT PRIMARY KEY,
    sample_id TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('退样','销毁')),
    reason TEXT DEFAULT '',
    destination TEXT DEFAULT '',
    destroy_method TEXT DEFAULT '',
    witness TEXT DEFAULT '',
    disposal_doc_no TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT '待审批' CHECK(status IN ('待审批','已审批','已执行')),
    approved_by TEXT DEFAULT '',
    approved_at TEXT DEFAULT '',
    approval_comment TEXT DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    created_by TEXT NOT NULL DEFAULT 'system',
    FOREIGN KEY (sample_id) REFERENCES samples(id)
  )
`)

db.run(`
  CREATE TABLE IF NOT EXISTS flow_traces (
    id TEXT PRIMARY KEY,
    sample_id TEXT NOT NULL,
    action TEXT NOT NULL,
    operator TEXT NOT NULL,
    operator_role TEXT NOT NULL,
    comment TEXT DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (sample_id) REFERENCES samples(id)
  )
`)

db.run(`
  CREATE TABLE IF NOT EXISTS warehouses (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT '空闲' CHECK(status IN ('空闲','占用','待清理')),
    current_sample_id TEXT DEFAULT ''
  )
`)

db.run(`
  CREATE TABLE IF NOT EXISTS reminders (
    id TEXT PRIMARY KEY,
    sample_id TEXT NOT NULL,
    overdue_days INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT '待催办' CHECK(status IN ('待催办','已催办','处理中','已完结')),
    remind_at TEXT DEFAULT '',
    remind_by TEXT DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (sample_id) REFERENCES samples(id)
  )
`)

db.run(`CREATE INDEX IF NOT EXISTS idx_samples_status ON samples(status)`)
db.run(`CREATE INDEX IF NOT EXISTS idx_samples_seal_no ON samples(seal_no)`)
db.run(`CREATE INDEX IF NOT EXISTS idx_samples_retention_end ON samples(retention_end)`)
db.run(`CREATE INDEX IF NOT EXISTS idx_flow_traces_sample_id ON flow_traces(sample_id)`)
db.run(`CREATE INDEX IF NOT EXISTS idx_reminders_status ON reminders(status)`)

const warehouseCount = db.exec('SELECT COUNT(*) FROM warehouses')
if (!warehouseCount[0] || (warehouseCount[0].values[0][0] as number) === 0) {
  db.run(`INSERT INTO warehouses (id, code, name, status) VALUES
    ('w001', 'A-01-01', 'A区1排1号', '空闲'),
    ('w002', 'A-01-02', 'A区1排2号', '空闲'),
    ('w003', 'A-02-01', 'A区2排1号', '空闲'),
    ('w004', 'A-02-02', 'A区2排2号', '空闲'),
    ('w005', 'B-01-01', 'B区1排1号', '空闲'),
    ('w006', 'B-01-02', 'B区1排2号', '空闲'),
    ('w007', 'B-02-01', 'B区2排1号', '空闲'),
    ('w008', 'B-02-02', 'B区2排2号', '空闲')
  `)
}

saveDb()

function toCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())
}

export function saveDb() {
  const data = db.export()
  const buffer = Buffer.from(data)
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true })
  }
  fs.writeFileSync(DB_PATH, buffer)
}

export function all<T>(sql: string, params?: unknown[]): T[] {
  const stmt = db.prepare(sql)
  if (params && params.length > 0) stmt.bind(params)
  const results: T[] = []
  while (stmt.step()) {
    const row = stmt.getAsObject()
    const obj: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(row)) {
      obj[toCamelCase(key)] = value
    }
    results.push(obj as T)
  }
  stmt.free()
  return results
}

export function get<T>(sql: string, params?: unknown[]): T | undefined {
  return all<T>(sql, params)[0]
}

export function run(sql: string, params?: unknown[]) {
  db.run(sql, params)
  saveDb()
}
