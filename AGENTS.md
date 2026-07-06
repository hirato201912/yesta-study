<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# ABCクエスト連動（2026-07 追加）

- `/abc-quest` ページ: 先生用。生徒別のプレイ履歴サマリーと「アルファベット別の定着マップ」（correct_letters/wrong_lettersから正解率を算出、緑=定着/黄=練習中/赤=要復習/灰=未着手）
- データ元テーブル: `abc_quest_records`（DDLは abc-quest リポジトリの supabase/abc_quest_records.sql）。書き込むのは別アプリ ABCクエスト（../abc-quest, Vite+React, https://github.com/hirato201912/abc-quest）
- 生徒マスタ `yesta_students` をABCクエストの生徒選択でも参照している。列変更時は両アプリに影響
- 型は `types/index.ts` の `AbcQuestRecord`

# 生徒の追加・編集・退塾（2026-07 追加）

- `/students` ページで生徒を追加（名前＋学年）・編集（名前/学年）・退塾（`active=false` で一覧から非表示）できる
- 退塾は物理削除ではなく `yesta_students.active` フラグ。学習履歴・ABCクエスト記録は残す。DDLは `supabase/yesta_students_active.sql`（Supabase SQL Editorで要実行）
- ⚠️ `active` 列追加に伴い、ABCクエスト（../abc-quest）の生徒取得クエリにも `.eq('active', true)` を入れる修正が別途必要（未対応だと退塾生がABC側に残る）
