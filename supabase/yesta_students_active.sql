-- 生徒の「非表示（アーカイブ）」対応: 在籍フラグ列を追加
-- 退塾した生徒は active=false にして一覧から隠す（学習履歴・ABCクエスト記録は残す）。
--
-- ⚠️ このテーブルは別アプリ ABCクエスト（../abc-quest）の生徒選択でも参照している。
--    ABCクエスト側の生徒取得クエリにも .eq('active', true) を入れる修正が別途必要。
--
-- Supabase の SQL Editor でこのファイルを実行してください。

alter table yesta_students
  add column if not exists active boolean not null default true;

-- 既存の全生徒は在籍中として扱う（default true が既存行にも適用される）
