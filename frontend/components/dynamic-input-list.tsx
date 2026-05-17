'use client';

/**
 * 動的入力リストコンポーネント
 *
 * 参加者・論点など、可変長の文字列リストを入力するための汎用コンポーネント。
 * 入力欄に文字が入力されると自動的に新しい空の入力欄が追加され、
 * 削除ボタンで不要な入力欄を削除できる。
 */

interface DynamicInputListProps {
  /** 入力値の配列 */
  values: string[];
  /** 値が変更されたときのコールバック */
  onChange: (values: string[]) => void;
  /** 各入力欄のプレースホルダー */
  placeholder: string;
  /** ラベルテキスト */
  label: string;
  /** 必須項目かどうか */
  required?: boolean;
  /** 各入力欄の最大文字数 */
  maxLength?: number;
}

export default function DynamicInputList({
  values,
  onChange,
  placeholder,
  label,
  required = false,
  maxLength,
}: DynamicInputListProps) {
  /**
   * 入力値が変更されたときの処理
   * - 対象のインデックスの値を更新
   * - 空の入力欄が存在しなければ新しい空の入力欄を追加
   */
  const handleInputChange = (index: number, newValue: string) => {
    const updatedValues = [...values];
    updatedValues[index] = newValue;

    // 空の入力欄が存在するかチェック
    const hasEmptyField = updatedValues.some((v) => v === '');

    // 空の入力欄が存在しなければ新しい空の入力欄を追加
    if (!hasEmptyField) {
      updatedValues.push('');
    }

    onChange(updatedValues);
  };

  /**
   * 入力欄を削除する
   * - 対象のインデックスの要素を配列から除去
   */
  const handleRemove = (index: number) => {
    const updatedValues = values.filter((_, i) => i !== index);
    onChange(updatedValues);
  };

  // 削除ボタンを表示するかどうか（入力欄が2つ以上の場合のみ表示）
  const showRemoveButton = values.length > 1;

  return (
    <div className="space-y-2">
      {/* ラベル */}
      <label className="block text-sm font-medium text-gray-700">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>

      {/* 入力欄リスト */}
      <div className="space-y-2">
        {values.map((value, index) => (
          <div key={index} className="flex items-center gap-2">
            {/* テキスト入力欄 */}
            <input
              type="text"
              value={value}
              onChange={(e) => handleInputChange(index, e.target.value)}
              placeholder={placeholder}
              maxLength={maxLength}
              className="flex-1 p-2 border border-gray-300 rounded text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-500 touch-manipulation"
              data-testid={`dynamic-input-${index}`}
            />

            {/* 削除ボタン（入力欄が1つのみの場合は非表示） */}
            {showRemoveButton && (
              <button
                type="button"
                onClick={() => handleRemove(index)}
                className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 active:bg-red-100 rounded transition-colors touch-manipulation flex-shrink-0"
                title="削除"
                aria-label={`${label}の${index + 1}番目を削除`}
                data-testid={`dynamic-input-remove-${index}`}
              >
                <svg
                  className="w-4 h-4 sm:w-5 sm:h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}
          </div>
        ))}
      </div>

      {/* 最大文字数の表示（maxLengthが指定されている場合） */}
      {maxLength && (
        <p className="text-xs text-gray-500">
          各項目最大{maxLength}文字
        </p>
      )}
    </div>
  );
}
