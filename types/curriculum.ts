export type DifficultyLevel = 'I' | 'II'

/** 準備中の科目は "coming_soon"。フィールド自体がない場合は利用可能とみなす */
export type SubjectStatus = 'available' | 'coming_soon'

export type UnitItem = {
  chapter: string
  step: string
  title: string
  difficulty?: DifficultyLevel
}

type UnitFields = {
  status?: SubjectStatus
  main: UnitItem[]
  pre_step?: UnitItem[]
}

/** 数学は学年別（中1 / 中2 / 中3）に独立したデータを持つ */
export type MathSubjectData = UnitFields & {
  subject: '数学'
  grade: '中1' | '中2' | '中3'
}

/** 英語・国語・社会・理科は全学年共通（"中学"）*/
export type AllGradeSubjectData = UnitFields & {
  subject: '国語' | '社会' | '理科' | '英語'
  grade: '中学'
}

export type SubjectData = MathSubjectData | AllGradeSubjectData

export type SubjectName = SubjectData['subject']
export type GradeName = SubjectData['grade']

export type ForestaStepData = {
  title: string
  subjects: SubjectData[]
}
