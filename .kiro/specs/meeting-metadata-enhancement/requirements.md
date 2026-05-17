# 要件ドキュメント: 会議メタデータ入力機能の拡張

## はじめに

本機能は、既存の会議メタデータ入力機能（meeting-metadata-input）を拡張し、開催日時に終了時刻を追加し、参加者入力に会社名フィールドを追加する改修である。これにより、会議の時間範囲と参加者の所属情報をより正確に記録できるようになる。

## 用語集

- **Metadata_Form**: アップロード画面内の会議メタデータ入力フォームコンポーネント
- **Start_DateTime**: 開始日時。会議の開始時刻を表すdatetime-local入力欄
- **End_DateTime**: 終了日時。会議の終了時刻を表すdatetime-local入力欄
- **Participant_Entry**: 参加者入力エントリ。会社名と名前の2つのフィールドで構成される1件の参加者情報
- **DynamicInputList**: 動的入力リストコンポーネント。可変長のリスト入力を管理する汎用コンポーネント
- **Minutes_List**: 議事録一覧画面。過去の議事録をリスト表示するUI
- **Minutes_Detail**: 議事録詳細画面。生成された議事録の詳細を表示するUI
- **Upload_Handler**: アップロード処理Lambda。Presigned URL生成とジョブレコード作成を行う

## 要件

### 要件1: 開催日時の開始・終了時刻入力

**ユーザーストーリー:** ユーザーとして、会議の開始時刻と終了時刻の両方を入力したい。それにより、会議の所要時間を正確に記録できる。

#### 受入条件

1. THE Metadata_Form SHALL 開催日時入力欄を「開始日時」と「終了日時」の2つの入力欄に分割して表示する
2. THE Metadata_Form SHALL 開始日時（Start_DateTime）入力欄を必須項目として表示する
3. THE Metadata_Form SHALL 終了日時（End_DateTime）入力欄を任意項目として表示する
4. THE Metadata_Form SHALL 開始日時と終了日時の両方にdatetime-local形式の入力欄を使用する
5. WHEN 終了日時が入力された場合、THE Metadata_Form SHALL 終了日時が開始日時より後であることを検証する
6. IF 終了日時が開始日時より前または同じ場合、THEN THE Metadata_Form SHALL 「終了日時は開始日時より後に設定してください」というエラーメッセージを表示する

### 要件2: 参加者入力の会社名・名前フィールド化

**ユーザーストーリー:** ユーザーとして、参加者の会社名と名前を別々に入力したい。それにより、参加者の所属を明確に記録できる。

#### 受入条件

1. THE Metadata_Form SHALL 各参加者について「会社名」と「名前」の2つの入力フィールドを横並びで表示する
2. THE Metadata_Form SHALL 参加者の「名前」フィールドを必須項目として扱う
3. THE Metadata_Form SHALL 参加者の「会社名」フィールドを任意項目として扱う
4. THE Metadata_Form SHALL 各参加者の「名前」フィールドに最大50文字の制限を設ける
5. THE Metadata_Form SHALL 各参加者の「会社名」フィールドに最大50文字の制限を設ける
6. WHEN ユーザーが参加者の名前フィールドに文字を入力した場合、THE Metadata_Form SHALL 新しい空の参加者入力行を1つ追加する
7. THE Metadata_Form SHALL 空の参加者入力行が既に存在する場合は新しい入力行を追加しない
8. THE Metadata_Form SHALL 各参加者入力行に削除ボタンを表示する（入力行が1つのみの場合を除く）
9. WHEN ユーザーが削除ボタンをクリックした場合、THE Metadata_Form SHALL 対象の参加者入力行を削除する

### 要件3: バリデーションの拡張

**ユーザーストーリー:** ユーザーとして、入力内容に不備がある場合にエラーメッセージを表示してほしい。それにより、正確なデータを登録できる。

#### 受入条件

1. WHEN ユーザーがアップロードボタンをクリックし開始日時が未入力の場合、THE Metadata_Form SHALL 「開始日時を入力してください」というエラーメッセージを表示する
2. WHEN ユーザーがアップロードボタンをクリックし参加者の名前が1名も入力されていない場合、THE Metadata_Form SHALL 「参加者を1名以上入力してください」というエラーメッセージを表示する
3. WHEN 終了日時が入力されており開始日時以前の場合、THE Metadata_Form SHALL 「終了日時は開始日時より後に設定してください」というエラーメッセージを表示する
4. WHILE 必須項目が未入力または終了日時バリデーションエラーの状態、THE Metadata_Form SHALL アップロード処理を実行しない
5. WHEN すべてのバリデーションが通過した場合、THE Metadata_Form SHALL アップロード処理を実行可能にする

### 要件4: バックエンドのメタデータ保存拡張

**ユーザーストーリー:** ユーザーとして、入力した終了日時と参加者の会社名がバックエンドに保存されてほしい。それにより、議事録表示時に正確な情報を利用できる。

#### 受入条件

1. WHEN アップロードが実行された場合、THE Upload_Handler SHALL 開始日時・終了日時・参加者（会社名と名前のペア）をAPIリクエストに含めて送信する
2. THE Upload_Handler SHALL 参加者リストから名前が空の入力行を除外して保存する
3. THE Upload_Handler SHALL 参加者データを `{ company: string, name: string }` の配列形式で保存する
4. THE Upload_Handler SHALL 終了日時をISO 8601形式の文字列として `meetingEndDate` フィールドに保存する
5. THE Upload_Handler SHALL 終了日時が未入力の場合は `meetingEndDate` フィールドを保存しない

### 要件5: 議事録詳細画面の表示拡張

**ユーザーストーリー:** ユーザーとして、議事録詳細画面に開催時間帯と参加者の会社名が表示されてほしい。それにより、会議の詳細情報を一目で確認できる。

#### 受入条件

1. WHEN 開始日時と終了日時の両方が存在する場合、THE Minutes_Detail SHALL 開催日時を「YYYY/MM/DD HH:MM 〜 HH:MM」の形式で表示する
2. WHEN 開始日時のみ存在する場合、THE Minutes_Detail SHALL 開催日時を「YYYY/MM/DD HH:MM」の形式で表示する
3. WHEN 参加者データに会社名が含まれる場合、THE Minutes_Detail SHALL 参加者を「会社名 / 名前」の形式で表示する
4. WHEN 参加者データに会社名が含まれない場合、THE Minutes_Detail SHALL 参加者を名前のみで表示する
5. THE Minutes_Detail SHALL 過去の議事録（文字列配列形式の参加者データ）に対して従来通りの表示を維持する

### 要件6: 議事録一覧の日時表示拡張

**ユーザーストーリー:** ユーザーとして、議事録一覧に開催時間帯が表示されてほしい。それにより、会議の時間情報を一覧で確認できる。

#### 受入条件

1. WHEN 開始日時と終了日時の両方が存在する場合、THE Minutes_List SHALL 日時表示を「YYYY/MM/DD HH:MM 〜 HH:MM」の形式で表示する
2. WHEN 開始日時のみ存在する場合、THE Minutes_List SHALL 日時表示を「YYYY/MM/DD HH:MM」の形式で表示する
3. WHEN 開催日時が設定されていない過去の議事録の場合、THE Minutes_List SHALL 従来通りの作成日時（createdAt）を表示する

### 要件7: 後方互換性の維持

**ユーザーストーリー:** ユーザーとして、既存の議事録データが正しく表示され続けてほしい。それにより、過去のデータが失われない。

#### 受入条件

1. THE Upload_Handler SHALL 参加者データが文字列配列形式（旧形式）で保存されている既存レコードを正常に読み取る
2. THE Minutes_Detail SHALL 参加者データが文字列配列形式の場合、各文字列をそのまま参加者名として表示する
3. THE Minutes_List SHALL meetingEndDate が存在しない既存レコードに対して、開始日時のみの表示形式を使用する
4. THE Metadata_Form SHALL 既存のバリデーションルール（会議名必須、最大100文字）を維持する
