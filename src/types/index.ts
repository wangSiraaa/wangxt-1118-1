export type SampleSource = '执法扣留' | '检验抽样' | '抽查取样'
export type SampleStatus = '待入库' | '在库' | '待检测' | '检测中' | '已检测' | '待处置' | '处置中' | '已处置' | '超期'
export type TestConclusion = '合格' | '不合格' | '需复检'
export type DisposalType = '退样' | '销毁'
export type DisposalStatus = '待审批' | '已审批' | '已执行'
export type WarehouseStatus = '空闲' | '占用' | '待清理'
export type ReminderStatus = '待催办' | '已催办' | '处理中' | '已完结'
export type UserRole = '收样员' | '检测工程师' | '库管' | '管理员'

export interface Sample {
  id: string
  sampleCode: string
  source: SampleSource
  caseNo: string
  sealNo: string
  itemName: string
  quantity: number
  spec: string
  retentionDays: number
  retentionStart: string
  retentionEnd: string
  isInvolved: boolean
  disposalDocNo: string
  status: SampleStatus
  warehouseId: string
  createdAt: string
  createdBy: string
}

export interface TestResult {
  id: string
  sampleId: string
  conclusion: TestConclusion
  testDate: string
  tester: string
  reportFile: string
  createdAt: string
}

export interface Disposal {
  id: string
  sampleId: string
  type: DisposalType
  reason: string
  destination: string
  destroyMethod: string
  witness: string
  disposalDocNo: string
  status: DisposalStatus
  approvedBy: string
  approvedAt: string
  approvalComment: string
  createdAt: string
  createdBy: string
}

export interface FlowTrace {
  id: string
  sampleId: string
  action: string
  operator: string
  operatorRole: string
  comment: string
  createdAt: string
}

export interface Warehouse {
  id: string
  code: string
  name: string
  status: WarehouseStatus
  currentSampleId: string
}

export interface Reminder {
  id: string
  sampleId: string
  overdueDays: number
  status: ReminderStatus
  remindAt: string
  remindBy: string
  createdAt: string
}

export interface CurrentUser {
  name: string
  role: UserRole
}
