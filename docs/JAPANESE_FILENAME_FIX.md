# 日本語ファイル名のダウンロードエラー修正

## 問題の概要

S3からファイルをダウンロードする際に、日本語ファイル名を含むPresigned URLで以下のエラーが発生していました：

```xml
<Error>
  <Code>InvalidArgument</Code>
  <Message>Header value cannot be represented using ISO-8859-1.</Message>
  <ArgumentName>response-content-disposition</ArgumentName>
  <ArgumentValue>attachment; filename="営業支援AI関連 隔週MTG-20251017_110031-会議の録音_minutes.txt"</ArgumentValue>
</Error>
```

## 原因

HTTPヘッダーの`Content-Disposition`は**ISO-8859-1**（Latin-1）エンコーディングしかサポートしていません。日本語などの非ASCII文字はISO-8859-1で表現できないため、エラーが発生していました。

## 解決方法

**RFC 5987**形式でファイル名をエンコードすることで、日本語ファイル名を安全に使用できるようにしました。

### 修正内容

#### 1. `src/lambdas/download-minutes/index.ts`

ファイル名をRFC 5987形式でエンコードする関数を追加：

```typescript
/**
 * ファイル名をRFC 5987形式でエンコードする
 * 日本語などの非ASCII文字を含むファイル名をHTTPヘッダーで安全に使用できるようにする
 */
function encodeRFC5987(fileName: string): string {
    // RFC 5987: filename*=UTF-8''encoded-filename
    return encodeURIComponent(fileName)
        .replace(/['()]/g, escape) // 特殊文字をエスケープ
        .replace(/\*/g, '%2A');
}
```

Presigned URL生成時に、非ASCII文字を含むファイル名を適切にエンコード：

```typescript
const fullFileName = `${fileName}.${extension}`;

// RFC 5987形式でファイル名をエンコード
// ASCII文字のみの場合は通常のfilename、非ASCII文字がある場合はfilename*を使用
const hasNonAscii = /[^\x00-\x7F]/.test(fullFileName);
const contentDisposition = hasNonAscii
    ? `attachment; filename="${encodeRFC5987(fullFileName)}"; filename*=UTF-8''${encodeRFC5987(fullFileName)}`
    : `attachment; filename="${fullFileName}"`;

const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: s3Key,
    ResponseContentDisposition: contentDisposition,
    ResponseContentType: contentType,
});
```

#### 2. `src/lambdas/download-minutes/__tests__/index.test.ts`

日本語ファイル名のテストケースを追加：

```typescript
it('日本語ファイル名を含むジョブでもダウンロードURLを正常に生成できる', async () => {
    const japaneseJob = {
        ...mockJob,
        videoFileName: '営業支援AI関連 隔週MTG-20251017_110031-会議の録音.mp4',
    };

    dynamoMock.on(GetCommand).resolves({
        Item: japaneseJob,
    });

    const event = createMockEvent(mockJobId, mockUserId);
    const result = await handler(event);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.success).toBe(true);
    expect(body.data.downloadUrl).toBeDefined();
    expect(body.data.fileName).toContain('営業支援AI関連 隔週MTG-20251017_110031-会議の録音_minutes');
});
```

## RFC 5987とは

RFC 5987は、HTTPヘッダーで非ASCII文字を使用するための標準仕様です。

### 形式

```
Content-Disposition: attachment; filename="encoded-name"; filename*=UTF-8''encoded-name
```

- `filename`: ASCII文字のみのフォールバック（古いブラウザ用）
- `filename*`: UTF-8エンコードされたファイル名（RFC 5987形式）

### エンコード例

元のファイル名: `営業支援AI関連 隔週MTG_minutes.md`

エンコード後:
```
Content-Disposition: attachment; filename="%E5%96%B6%E6%A5%AD%E6%94%AF%E6%8F%B4AI%E9%96%A2%E9%80%A3%20%E9%9A%94%E9%80%B1MTG_minutes.md"; filename*=UTF-8''%E5%96%B6%E6%A5%AD%E6%94%AF%E6%8F%B4AI%E9%96%A2%E9%80%A3%20%E9%9A%94%E9%80%B1MTG_minutes.md
```

## テスト結果

すべてのテストが成功しました：

```bash
npm test -- src/lambdas/download-minutes/__tests__/index.test.ts

Test Suites: 1 passed, 1 total
Tests:       15 passed, 15 total
```

## デプロイ

修正をデプロイするには、以下のコマンドを実行してください：

```bash
# Lambda関数をビルド
npm run build:lambdas

# CDKスタックをデプロイ
npx cdk deploy meeting-minutes-generator-compute-dev
```

または、CI/CDパイプラインを使用している場合は、`develop`ブランチにマージすることで自動的にデプロイされます。

## 動作確認

1. 日本語ファイル名を含むMP4ファイルをアップロード
2. 処理が完了するまで待機
3. ダウンロードボタンをクリック
4. ファイルが正常にダウンロードされることを確認

## 参考リンク

- [RFC 5987 - Character Set and Language Encoding for HTTP Header Field Parameters](https://tools.ietf.org/html/rfc5987)
- [MDN - Content-Disposition](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Disposition)
- [AWS S3 - Presigned URLs](https://docs.aws.amazon.com/AmazonS3/latest/userguide/ShareObjectPreSignedURL.html)

## まとめ

この修正により、日本語を含む任意のファイル名でも安全にダウンロードできるようになりました。RFC 5987形式を使用することで、ブラウザの互換性も確保しています。
