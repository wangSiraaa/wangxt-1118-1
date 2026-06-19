export type SampleSource = '执法扣留' | '检验抽样' | '抽查取样'
export type SampleStatus = '待入库' | '在库' | '待检测' | '检测中' | '已检测' | '待处置' | '处置中' | '已处置' | '超期' | '已冻结'
export type TestConclusion = '合格' | '不合格' | '需复检'
export type RecheckConclusion = '无需复检' | '复检合格' | '复检不合格' | '待补录'
export type DisposalType = '退样' | '销毁' | '延期' | '分样' | '冻结' | '解冻'
export type DisposalStatus = '待审批' | '已审批' | '已执行' | '已驳回'
export type WarehouseStatus = '空闲' | '占用' | '待清理'
export type ReminderStatus = '待催办' | '已催办' | '处理中' | '已完结'
export type ReminderCategory = '待批文' | '待复检' | '待库位清点'
export type UserRole = '收样员' | '检测工程师' | '库管' | '管理员'
export type FreezeStatus = '未冻结' | '已冻结' | '已解冻'

export interface CaseInfo {
  id: string
  caseNo: string
  caseName: string
  caseType: string
  handler: string
  handlerDept: string
  createdAt: string
  createdBy: string
}

export interface SampleCase {
  id: string
  sampleId: string
  caseId: string
  caseNo: string
  isPrimary: boolean
  assignedAt: string
  assignedBy: string
}

export interface SealVersion {
  id: string
  sampleId: string
  version: number
  sealNo: string
  changeReason: string
  changedAt: string
  changedBy: string
}

export interface Extension {
  id: string
  sampleId: string
  originalEndDate: string
  extendedDays: number
  newEndDate: string
  reason: string
  approvalDoc: string
  status: '待审批' | '已审批' | '已驳回'
  approvedBy: string
  approvedAt: string
  createdAt: string
  createdBy: string
}

export interface SplitSample {
  id: string
  parentSampleId: string
  childSampleId: string
  splitQuantity: number
  splitReason: string
  splitDate: string
  status: '待审批' | '已审批' | '已执行'
  approvedBy: string
  approvedAt: string
  createdAt: string
  createdBy: string
}

export interface FreezeRecord {
  id: string
  sampleId: string
  freezeType: '司法冻结' | '海关冻结' | '其他冻结'
  freezeOrderNo: string
  freezeReason: string
  freezeStartDate: string
  freezeEndDate: string
  status: '已冻结' | '已解冻'
  unfreezeReason: string
  unfreezeDate: string
  approvedBy: string
  createdAt: string
  createdBy: string
}

export interface Sample {
  id: string
  sampleCode: string
  source: SampleSource
  caseNo: string
  sealNo: string
  sealVersion: number
  itemName: string
  quantity: number
  spec: string
  retentionDays: number
  retentionStart: string
  retentionEnd: string
  isInvolved: boolean
  disposalDocNo: string
  freezeStatus: FreezeStatus
  reviewClosed: boolean
  parentSampleId: string
  status: SampleStatus
  warehouseId: string
  createdAt: string
  createdBy: string
}

export interface TestResult {
  id: string
  sampleId: string
  conclusion: TestConclusion
  recheckConclusion: RecheckConclusion
  recheckDate: string
  recheckTester: string
  recheckReportFile: string
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
  extendedDays: number
  newRetentionEnd: string
  splitQuantity: number
  splitToSampleCode: string
  freezeType: string
  freezeOrderNo: string
  freezeEndDate: string
  status: DisposalStatus
  approvedBy: string
  approvedAt: string
  approvalComment: string
  validationRetentionPassed: boolean
  validationDocPassed: boolean
  validationReviewPassed: boolean
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
  category: ReminderCategory
  status: ReminderStatus
  responsiblePerson: string
  remindAt: string
  remindBy: string
  createdAt: string
}

export interface CurrentUser {
  name: string
  role: UserRole
}
