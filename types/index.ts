export * from './curriculum'

export type LoggedInTeacher = {
  id: string
  name: string
  code: number
}

export type Student = {
  id: string
  name: string
  grade: '小1' | '小2' | '小3' | '小4' | '小5' | '小6' | '中1' | '中2' | '中3'
}

export type StudyRecord = {
  id: string
  date: string
  time_slot: string
  student_id: string
  subject: string
  unit: string
  comprehension: string
  teacher_comment: string
  teacher_id: string | null
  created_at: string
}

export type StudyRecordWithStudent = StudyRecord & {
  student: Student
}
