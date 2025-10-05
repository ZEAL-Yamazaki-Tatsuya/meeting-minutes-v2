# デプロイメントガイド

このガイドでは、議事録自動生成システムのインフラストラクチャをAWSにデプロイする手順を説明します。

## クイックスタート（Windows）

初めてデプロイする場合は、以下の手順に従ってください：

1. **PowerShellを管理者として開く**

2. **自動セットアップを実行**
   ```powershell
   .\scripts\setup.ps1
   ```

3. **.envファイルを編集**
   ```powershell
   notepad .env
   ```
   AWS_ACCOUNT_IDとAWS_REGIONを設定

4. **CDKをブートストラップ**
   ```powershell
   cdk bootstrap aws://YOUR_ACCOUNT_ID/us-east-1
   ```

5. **デプロイ**
   ```powershell
   cdk deploy --all
   ```

詳細な手順は以下をご覧ください。

## 前提条件

### 必須ソフトウェア

1. **Node.js**: バージョン18以上
   - [Node.js公式サイト](https://nodejs.org/)からダウンロード
   - インストール後、コマンドプロンプトで確認：
     ```cmd
     node --version
     npm --version
     ```

2. **AWS CLI**: バージョン2推奨
   - [AWS CLI for Windows](https://aws.amazon.com/cli/)からダウンロード
   - インストール後、認証情報を設定：
     ```cmd
     aws configure
     ```
   - 以下を入力：
     - AWS Access Key ID
     - AWS Secret Access Key
     - Default region name (例: us-east-1)
     - Default output format (json推奨)

3. **AWS CDK**: グローバルにインストール
   ```cmd
   npm install -g aws-cdk
   ```
   - インストール確認：
     ```cmd
     cdk --version
     ```

4. **AWSアカウント**: 適切な権限を持つAWSアカウントが必要です

### Windows環境の注意事項

- **PowerShell実行ポリシー**: スクリプト実行のため、PowerShellの実行ポリシーを変更する必要がある場合があります：
  ```powershell
  Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
  ```

- **管理者権限**: グローバルパッケージのインストールには管理者権限が必要な場合があります

- **パスの区切り文字**: Windowsではバックスラッシュ（`\`）を使用しますが、Node.jsとCDKは自動的に処理します

## 初期セットアップ

### 自動セットアップ（推奨）

Windows PowerShellで自動セットアップスクリプトを実行：

```powershell
.\scripts\setup.ps1
```

このスクリプトは以下を自動的に実行します：
- Node.js、npm、AWS CLI、CDKのチェック
- 依存関係のインストール
- .envファイルの作成
- プロジェクトのビルド

### 手動セットアップ

自動セットアップを使用しない場合は、以下の手順を実行してください。

### 1. 依存関係のインストール

```cmd
npm install
```

### 2. 環境設定

サンプルファイルから`.env`ファイルを作成します：

**Windows (コマンドプロンプト):**
```cmd
copy .env.example .env
```

**Windows (PowerShell):**
```powershell
Copy-Item .env.example .env
```

`.env`ファイルを編集して、以下の値を設定してください：

```env
AWS_ACCOUNT_ID=123456789012
AWS_REGION=us-east-1
ENVIRONMENT=dev
APP_NAME=meeting-minutes-generator
```

### 3. CDKのブートストラップ（初回のみ）

AWSアカウントとリージョンでCDKをブートストラップします：

```cmd
cdk bootstrap aws://アカウントID/リージョン
```

例：
```cmd
cdk bootstrap aws://123456789012/us-east-1
```

`アカウントID`と`リージョン`は実際の値に置き換えてください。

## デプロイ手順

### 1. プロジェクトのビルド

```cmd
npm run build
```

### 2. 変更内容の確認（オプション）

デプロイされる内容を確認します：

```cmd
cdk diff
```

### 3. インフラストラクチャのデプロイ

すべてのスタックをデプロイ：

```cmd
cdk deploy --all
```

または、スタックを個別にデプロイ：

```cmd
REM まずストレージリソースをデプロイ
cdk deploy meeting-minutes-generator-storage-dev

REM 次にコンピュートリソースをデプロイ
cdk deploy meeting-minutes-generator-compute-dev
```

### 4. 出力値の確認

デプロイ後、CDKは重要な値を出力します：

```
Outputs:
meeting-minutes-generator-storage-dev.InputBucketName = meeting-minutes-generator-input-dev-123456789012
meeting-minutes-generator-storage-dev.OutputBucketName = meeting-minutes-generator-output-dev-123456789012
meeting-minutes-generator-storage-dev.JobsTableName = meeting-minutes-generator-jobs-dev
meeting-minutes-generator-compute-dev.LambdaExecutionRoleArn = arn:aws:iam::...
```

これらの値は、Lambda関数やフロントエンドの設定に使用するため保存してください。

## 環境別デプロイ

### 開発環境

**Windows (コマンドプロンプト):**
```cmd
set ENVIRONMENT=dev
cdk deploy --all
```

**Windows (PowerShell):**
```powershell
$env:ENVIRONMENT="dev"
cdk deploy --all
```

### ステージング環境

**Windows (コマンドプロンプト):**
```cmd
set ENVIRONMENT=staging
cdk deploy --all
```

**Windows (PowerShell):**
```powershell
$env:ENVIRONMENT="staging"
cdk deploy --all
```

### 本番環境

**Windows (コマンドプロンプト):**
```cmd
set ENVIRONMENT=prod
cdk deploy --all
```

**Windows (PowerShell):**
```powershell
$env:ENVIRONMENT="prod"
cdk deploy --all
```

**注意**: 本番環境のデプロイには追加の保護機能があります：
- S3バケットはスタック削除時に保持されます
- DynamoDBはポイントインタイムリカバリが有効です
- リソースは自動削除されません

## デプロイの確認

### 1. S3バケットの確認

**Windows (コマンドプロンプト):**
```cmd
aws s3 ls | findstr meeting-minutes
```

**Windows (PowerShell):**
```powershell
aws s3 ls | Select-String meeting-minutes
```

### 2. DynamoDBテーブルの確認

```cmd
aws dynamodb describe-table --table-name meeting-minutes-generator-jobs-dev
```

### 3. IAMロールの確認

**Windows (コマンドプロンプト):**
```cmd
aws iam list-roles | findstr meeting-minutes
```

**Windows (PowerShell):**
```powershell
aws iam list-roles | Select-String meeting-minutes
```

## インフラストラクチャの更新

インフラストラクチャコードを変更した場合：

1. プロジェクトをビルド：
   ```cmd
   npm run build
   ```

2. 変更内容を確認：
   ```cmd
   cdk diff
   ```

3. 更新をデプロイ：
   ```cmd
   cdk deploy --all
   ```

## ロールバック

デプロイをロールバックする必要がある場合：

1. コードの変更を元に戻す
2. 再ビルドして再デプロイ：
   ```cmd
   npm run build
   cdk deploy --all
   ```

## クリーンアップ

デプロイされたすべてのリソースを削除するには：

```cmd
cdk destroy --all
```

**警告**: これにより以下が削除されます：
- すべてのS3バケットとその内容（開発/ステージング環境）
- DynamoDBテーブルとデータ（開発/ステージング環境）
- IAMロールとポリシー
- CloudWatchログ

本番環境のリソースは安全のためデフォルトで保持されます。

## トラブルシューティング

### CDKブートストラップの問題

ブートストラップエラーが発生した場合：

```cmd
cdk bootstrap aws://アカウントID/リージョン --force
```

### 権限エラー

AWS認証情報に以下の権限があることを確認してください：
- CloudFormation（フルアクセス）
- S3（バケットの作成/削除）
- DynamoDB（テーブルの作成/削除）
- IAM（ロールとポリシーの作成/削除）
- Lambda（関数の作成/更新）

### スタック削除の失敗

S3バケットが空でないためスタック削除に失敗する場合：

```cmd
REM まずバケットを空にする
aws s3 rm s3://バケット名 --recursive

REM その後、削除を再試行
cdk destroy
```

## コスト見積もり

使用量レベル別の月額コスト概算：

### 低使用量（月10ジョブ）
- S3: 約$1
- DynamoDB: 約$1
- Lambda: 約$1
- Transcribe: 約$6
- Bedrock: 約$2
- **合計**: 約$11/月

### 中使用量（月100ジョブ）
- S3: 約$5
- DynamoDB: 約$5
- Lambda: 約$10
- Transcribe: 約$60
- Bedrock: 約$20
- **合計**: 約$100/月

### 高使用量（月1000ジョブ）
- S3: 約$50
- DynamoDB: 約$50
- Lambda: 約$100
- Transcribe: 約$600
- Bedrock: 約$200
- **合計**: 約$1000/月

## モニタリング

デプロイ後、リソースを監視します：

1. **CloudWatchダッシュボード**: メトリクスとログを表示
2. **Cost Explorer**: 支出を追跡
3. **CloudTrail**: API呼び出しを監査

## 次のステップ

インフラストラクチャのデプロイ後：

1. Lambda関数のデプロイ（タスク2-8）
2. Step Functionsワークフローの作成（タスク5）
3. フロントエンドアプリケーションのデプロイ（タスク9-13）
4. モニタリングとアラートの設定（タスク19）
5. CI/CDパイプラインの構成（タスク18）

## セキュリティのベストプラクティス

### デプロイ前のチェックリスト

- [ ] `.env`ファイルが`.gitignore`に含まれている
- [ ] AWS認証情報がコードにハードコードされていない
- [ ] IAMロールが最小権限の原則に従っている
- [ ] S3バケットのパブリックアクセスがブロックされている
- [ ] すべてのリソースで保存時の暗号化が有効
- [ ] CORS設定が適切に構成されている

### 本番環境の追加設定

本番環境では以下を検討してください：

1. **AWS WAF**: API Gatewayの保護
2. **CloudFront**: フロントエンドのCDN配信
3. **Route 53**: カスタムドメイン設定
4. **Certificate Manager**: SSL/TLS証明書
5. **GuardDuty**: 脅威検出
6. **Config**: コンプライアンス監視

## バックアップと復旧

### バックアップ戦略

- **S3**: 出力バケットでバージョニング有効
- **DynamoDB**: ポイントインタイムリカバリ（本番環境）
- **インフラストラクチャ**: CDKコードでInfrastructure as Code

### 復旧手順

1. CDKコードからインフラストラクチャを再デプロイ
2. 必要に応じてDynamoDBをバックアップから復元
3. S3データは保持される（本番環境でスタック削除時）

## CI/CDパイプライン

### GitHub Actionsの例

```yaml
name: Deploy Infrastructure

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run build
      - run: npm test
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1
      - run: cdk deploy --all --require-approval never
```

## よくある質問

### Q: デプロイにどのくらい時間がかかりますか？

A: 初回デプロイは5-10分程度です。更新は変更内容により1-5分程度です。

### Q: 複数の環境を同じAWSアカウントにデプロイできますか？

A: はい、`ENVIRONMENT`変数を変更することで、dev、staging、prodを同じアカウントにデプロイできます。

### Q: リージョンを変更できますか？

A: はい、`.env`ファイルの`AWS_REGION`を変更してください。ただし、Bedrockは一部のリージョンでのみ利用可能です。

### Q: コストを削減するにはどうすればよいですか？

A: 
- 開発環境では使用しない時にリソースを削除
- S3ライフサイクルポリシーを調整
- DynamoDBのオンデマンドモードを使用
- Lambda関数のメモリを最適化

## サポート

問題や質問がある場合：
- CloudWatchログでエラーメッセージを確認
- AWSコンソールでCloudFormationイベントを確認
- IAM権限を確認
- すべての環境変数が正しく設定されているか確認

## 参考リンク

- [AWS CDK ドキュメント](https://docs.aws.amazon.com/cdk/)
- [AWS Transcribe ドキュメント](https://docs.aws.amazon.com/transcribe/)
- [Amazon Bedrock ドキュメント](https://docs.aws.amazon.com/bedrock/)
- [AWS Well-Architected Framework](https://aws.amazon.com/architecture/well-architected/)

## 変更履歴

- **v1.0.0** (2025-10-05): 初期リリース
  - ストレージスタック（S3、DynamoDB）
  - コンピュートスタック（IAMロール）
  - 基本的な設定管理
